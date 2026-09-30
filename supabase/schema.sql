-- ===== 청라에너지 마케팅 AI코파일럿 — 공유 저장소 · 권한 =====
-- Supabase 대시보드 → SQL Editor → New query 에 통째로 붙여 넣고 Run.
-- 여러 번 실행해도 안전하다(이미 있으면 건너뛰거나 다시 만든다).
--
-- 원칙
--  · 원본 엑셀(고객명·이메일·접수내용)은 서버에 올리지 않는다. 담당자 PC 브라우저 안에서만 처리.
--  · 서버에는 화면을 그리는 데 필요한 요약·가명 처리된 값만 둔다.
--  · 권한은 화면 버튼이 아니라 이 규칙(RLS)에서 막는다.
--
-- 역할
--  admin   관리자     : 전체 업로드 · 계정 역할 지정
--  arrears 연체 담당  : 연체·미납 업로드
--  voc     민원 담당  : 민원 업로드
--  viewer  조회자     : 조회만 (새 계정의 기본값)

-- ---------- 1. 사용자 역할 ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null default '',
  role       text not null default 'viewer' check (role in ('admin','arrears','voc','viewer')),
  created_at timestamptz not null default now()
);

-- 계정이 만들어지면 역할 행을 자동으로 만든다(기본 조회자)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 이미 만들어 둔 계정이 있으면 역할 행을 채워 둔다
insert into public.profiles(id, name)
  select id, split_part(email,'@',1) from auth.users
  on conflict (id) do nothing;

-- 지금 로그인한 사람의 역할 (규칙 안에서 쓴다)
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ---------- 2. 공유 데이터 ----------
-- key 하나에 화면 하나가 쓰는 값 하나. domain이 곧 '누가 올릴 수 있는가'.
create table if not exists public.shared_data (
  key             text primary key,
  domain          text not null check (domain in ('arrears','voc')),
  data            jsonb not null,
  updated_by      uuid references auth.users(id),
  updated_by_name text,
  updated_at      timestamptz not null default now()
);

-- 올린 사람·시각은 서버가 채운다(화면에서 남의 이름으로 올릴 수 없게)
create or replace function public.stamp_shared_data() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_by := auth.uid();
  new.updated_by_name := (select name from public.profiles where id = auth.uid());
  new.updated_at := now();
  return new;
end $$;

-- 기록은 저장이 끝난 뒤 한 번만 남긴다(덮어쓰기는 insert 시도 → update로 바뀌므로 before에서 남기면 두 번 남는다)
create or replace function public.log_shared_data() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.upload_log(key, domain, uploaded_by, uploaded_by_name, size_bytes)
    values (new.key, new.domain, new.updated_by, new.updated_by_name, octet_length(new.data::text));
  return null;
end $$;

-- ---------- 3. 업로드 기록 (누가 언제 무엇을 올렸는지) ----------
create table if not exists public.upload_log (
  id               bigserial primary key,
  key              text not null,
  domain           text not null,
  uploaded_by      uuid,
  uploaded_by_name text,
  size_bytes       int,
  created_at       timestamptz not null default now()
);

drop trigger if exists shared_data_stamp on public.shared_data;
create trigger shared_data_stamp before insert or update on public.shared_data
  for each row execute function public.stamp_shared_data();
drop trigger if exists shared_data_log on public.shared_data;
create trigger shared_data_log after insert or update on public.shared_data
  for each row execute function public.log_shared_data();

-- ---------- 4. 권한 규칙 (RLS) ----------
alter table public.profiles    enable row level security;
alter table public.shared_data enable row level security;
alter table public.upload_log  enable row level security;

-- 로그인하지 않은 접근(anon)은 아무것도 못 한다
revoke all on public.profiles, public.shared_data, public.upload_log from anon;

-- profiles: 내 행은 내가 보고, 관리자는 전부 보고 역할을 바꾼다. 스스로 역할을 올릴 수는 없다.
drop policy if exists profiles_read  on public.profiles;
drop policy if exists profiles_admin on public.profiles;
create policy profiles_read  on public.profiles for select to authenticated
  using (id = auth.uid() or public.my_role() = 'admin');
create policy profiles_admin on public.profiles for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- shared_data: 로그인한 사람은 모두 조회. 올리기는 관리자 또는 그 업무 담당만.
drop policy if exists shared_read   on public.shared_data;
drop policy if exists shared_insert on public.shared_data;
drop policy if exists shared_update on public.shared_data;
drop policy if exists shared_delete on public.shared_data;
create policy shared_read   on public.shared_data for select to authenticated using (public.my_role() is not null);
create policy shared_insert on public.shared_data for insert to authenticated
  with check (public.my_role() = 'admin' or public.my_role() = domain);
create policy shared_update on public.shared_data for update to authenticated
  using (public.my_role() = 'admin' or public.my_role() = domain)
  with check (public.my_role() = 'admin' or public.my_role() = domain);
create policy shared_delete on public.shared_data for delete to authenticated
  using (public.my_role() = 'admin');

-- upload_log: 로그인한 사람은 조회만. 기록은 위 트리거만 남긴다.
drop policy if exists log_read on public.upload_log;
create policy log_read on public.upload_log for select to authenticated using (public.my_role() is not null);

-- ---------- 5. 역할 지정 예시 (계정을 만든 뒤, 이메일만 바꿔서 실행) ----------
-- update public.profiles set role = 'admin',   name = '홍길동' where id = (select id from auth.users where email = 'admin@example.com');
-- update public.profiles set role = 'arrears', name = '김연체' where id = (select id from auth.users where email = 'arrears@example.com');
-- update public.profiles set role = 'voc',     name = '이민원' where id = (select id from auth.users where email = 'voc@example.com');
