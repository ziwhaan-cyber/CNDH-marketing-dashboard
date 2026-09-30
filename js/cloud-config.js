// 공유 저장소(Supabase) 연결 정보 — Supabase 대시보드 → Project Settings → API 에서 복사
// url 과 'anon public' 키만 넣는다. anon 키는 화면에 넣도록 만든 공개용 키이고,
// 실제 권한은 supabase/schema.sql 의 규칙(RLS)이 막는다.
// ★ 'service_role' 키는 절대 여기에 넣지 않는다(모든 규칙을 무시하는 관리자 키).
// 두 값이 비어 있으면 공유 기능 없이 지금처럼 이 PC 안에서만 동작한다.
window.CLOUD_CONFIG = {
  url: 'https://ojeklhggfjtmjtktcgou.supabase.co',
  anonKey: 'sb_publishable_6FullXky-FZ1NQFfh1j6Hw_Tt4IC91R'
};
