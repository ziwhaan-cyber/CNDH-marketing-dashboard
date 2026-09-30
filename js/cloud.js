// 공유 저장소(Supabase) — 로그인 · 역할별 권한 · 올린 결과 자동 공유
// ─────────────────────────────────────────────────────────────
// 기존 화면은 전부 이 PC의 브라우저 저장소(localStorage)에서 읽고 쓴다. 이 파일은 그 옆에 붙는 '동기화 층'이다.
//  · 열 때  : 서버의 최신 자료를 받아 브라우저 저장소에 채운다 → 기존 화면이 그대로 그린다
//  · 올릴 때: 담당자가 엑셀을 올려 저장소가 바뀌면, 그 결과를 서버에도 올린다
// 원본 엑셀(고객명·이메일·접수내용)은 서버로 보내지 않는다. 연체는 원래 집계값만, 민원은 가명 처리해서 보낸다.
// 권한은 화면에서 버튼을 숨기는 것과 별개로 서버 규칙(supabase/schema.sql)이 막는다.
// 설정(js/cloud-config.js)이 비어 있거나 시연 모드(?demo=1)면 아무것도 하지 않는다 → 지금처럼 이 PC 안에서만 동작.
(function(){
  var CFG = window.CLOUD_CONFIG || {};
  var DEMO_ON = /[?&]demo=1(&|$)/.test(location.search);
  var ON = !!(CFG.url && CFG.anonKey) && !DEMO_ON;
  var ROLE_LABEL = { admin:'관리자', arrears:'연체 담당', voc:'민원 담당', viewer:'조회자' };
  // [v2] 시연 모드에서 조회자 화면 미리보기 — 주소에 &view=viewer. 데이터는 그대로 시연용 가상 데이터
  var DEMO_VIEWER = DEMO_ON && /[?&]view=viewer(&|$)/.test(location.search);

  // 다른 화면 코드가 권한을 물어볼 때 쓴다. 공유 기능이 꺼져 있으면 모든 권한이 있는 것으로 본다(지금과 같게).
  var CLOUD = window.CLOUD = {
    on: ON, role: null, name: '', meta: {},
    can: function(domain){ if (DEMO_VIEWER) return false; return !ON || CLOUD.role === 'admin' || CLOUD.role === domain; }
  };
  var html = document.documentElement;
  if (DEMO_ON){
    if (DEMO_VIEWER){ CLOUD.role = 'viewer'; html.classList.add('cloud-on', 'demo-viewer'); applyRole(); }
    whenReady(demoViewSwitch);
    return;
  }
  if (!ON) return;

  html.classList.add('cloud-on', 'cloud-wait');   // 로그인·자료 확인이 끝날 때까지 화면을 가린다

  // 시연 모드 오른쪽 위 — 담당자 화면 ↔ 조회자 화면 전환
  function demoViewSwitch(){
    var nav = document.querySelector('.page-nav'); if (!nav || document.getElementById('cloud-user')) return;
    var b = document.createElement('div'); b.id = 'cloud-user';
    b.innerHTML = DEMO_VIEWER
      ? '<span class="cu-dot"></span><b>시연</b><span class="cu-role">조회자 화면</span><a class="demo-view-btn" href="?demo=1">담당자 화면으로</a>'
      : '<a class="demo-view-btn" href="?demo=1&amp;view=viewer" title="로그인한 조회자(전사)에게 보이는 화면 — 업로드 · 출력 버튼이 빠진다">조회자 화면으로 보기</a>';
    nav.insertBefore(b, document.getElementById('btn-clear-uploaded-data') || null);
  }

  // 공유하는 값 — 브라우저 저장 이름(ls) ↔ 서버 이름(key), 올릴 수 있는 업무(domain)
  var ITEMS = [
    { ls:'r9_arrearsRows',  key:'arrearsRows',     domain:'arrears' },   // 연체 현황 표(개월별 개소·금액 합계)
    { ls:'r9_arrearsYmd',   key:'arrearsYmd',      domain:'arrears' },
    { ls:'minap_summary',   key:'minap_summary',   domain:'arrears' },   // 미납관리 요약(건수·금액·구간) — 그 화면이 저장
    { ls:'r9_vocRawRows',   key:'vocRows',         domain:'voc', deid:true }, // 민원 접수 기록 — 가명 처리해서 올림
    { ls:'voc_im_summary',  key:'voc_im_summary',  domain:'voc' },       // 이슈 모니터링 요약 — 그 화면이 저장
    { ls:'voc_im_aiResult', key:'voc_im_aiResult', domain:'voc' },       // AI 분석 결과(월별)
    // 메모 칸 — 한 저장값(mdData)에 연체 · 민원 메모가 같이 있어, 업무별로 나눠 올리고 받을 때 합친다
    { ls:'r9_mdData', key:'md_arrears', domain:'arrears', part:['short','mid','long'] },            // 연체 관리 현황 메모
    { ls:'r9_mdData', key:'md_voc',     domain:'voc',     part:['voc-note-a','voc-note-b','voc-note-c'] } // 민원 메모
  ];
  var byLs = {}, byKey = {};
  ITEMS.forEach(function(it){ (byLs[it.ls] = byLs[it.ls] || []).push(it); byKey[it.key] = it; });
  function pick(obj, part){ var o = {}; part.forEach(function(k){ if (obj && obj[k] != null) o[k] = obj[k]; }); return o; }
  // 이 PC에 있는 값(나눠 올리는 값은 그 부분만). 없으면 undefined
  function localData(it){ var raw = lsGet(it.ls); if (raw === null) return undefined;
    try{ var d = JSON.parse(raw); return it.part ? pick(d, it.part) : d; }catch(e){ return undefined; } }

  var STAMP_LS = 'cloud_stamp';          // 이 PC가 마지막으로 받은/올린 서버 시각(값마다)
  var OWN_VOC_LS = 'cloud_own_vocRows';  // 이 PC에서 올린 민원이면 원본을 그대로 둔다(가명본으로 덮지 않음)
  var DIRTY_LS = 'cloud_dirty';          // 올리다 실패한 값 — 다음에 열 때 서버의 예전 값으로 덮지 않고 다시 올린다

  var sb = null, hydrating = false, timers = {}, lastSent = {};

  // ---------- 작은 도구 ----------
  var origSet = Storage.prototype.setItem, origRemove = Storage.prototype.removeItem;
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k, v){ try{ origSet.call(localStorage, k, v); }catch(e){} }
  function lsDel(k){ try{ origRemove.call(localStorage, k); }catch(e){} }
  function stamps(){ try{ return JSON.parse(lsGet(STAMP_LS) || '{}'); }catch(e){ return {}; } }
  function saveStamps(s){ lsSet(STAMP_LS, JSON.stringify(s)); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function when(iso){
    var d = new Date(iso); if (isNaN(d)) return '';
    return (d.getMonth()+1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }
  // 비교용 — 저장할 때마다 바뀌는 시각(at)은 빼고 본다(내용이 같으면 다시 올리지 않음)
  function sameAs(raw){ try{ var o = JSON.parse(raw); if (o && typeof o === 'object' && !Array.isArray(o)) delete o.at; return JSON.stringify(o); }catch(e){ return raw; } }
  function toast(msg, bad, onClick){
    var t = document.getElementById('cloud-toast');
    if (!t){ t = document.createElement('div'); t.id = 'cloud-toast'; document.body.appendChild(t); }
    t.className = bad ? 'bad' : ''; t.textContent = msg; t.onclick = onClick || null;
    t.style.cursor = onClick ? 'pointer' : 'default';
    t.classList.add('show'); clearTimeout(t._h);
    if (!onClick) t._h = setTimeout(function(){ t.classList.remove('show'); }, bad ? 6000 : 2500);
  }
  function whenReady(fn){ if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }

  // ---------- 민원 가명 처리 ----------
  // 고객명: 단지(건물)면 그대로 — 개인정보가 아니고 단지별 다발 감지에 필요.
  //         개인이면 '고객 0001', 판단이 안 되면 '미분류 0001'(이번에 올리는 자료 안에서만 같은 사람 = 같은 번호).
  // 접수내용: 비움. 처리내용: 입력 여부만('처리'). 단지명은 16번째 칸에 따로 넣는다.
  // 단지·개인 판단은 이슈 모니터링 화면의 규칙(고객명 분류 지정값 포함)을 그대로 빌려 쓴다.
  function monitorWin(){
    return new Promise(function(resolve, reject){
      var f = document.getElementById('voc-monitor-frame');
      if (!f) return reject(new Error('이슈 모니터링 화면이 없습니다'));
      if (typeof loadEmbedFrame === 'function') loadEmbedFrame('voc-monitor-frame');
      var t0 = Date.now();
      (function wait(){
        var w = null; try{ w = f.contentWindow; }catch(e){}
        if (w && typeof w.siteOfRow === 'function' && typeof w.guessNameKind === 'function' && typeof w.isPlaceholderName === 'function') return resolve(w);
        if (Date.now() - t0 > 20000) return reject(new Error('이슈 모니터링 화면을 불러오지 못해 가명 처리를 못 했습니다'));
        setTimeout(wait, 200);
      })();
    });
  }
  function pad4(n){ return String(n).padStart(4, '0'); }
  function deidVoc(rows){
    return monitorWin().then(function(w){
      var map = {}; try{ map = w.siteMapLoad ? w.siteMapLoad() : {}; }catch(e){}
      var ids = {}, np = 0, nu = 0;
      return (rows || []).filter(Array.isArray).map(function(a){
        var name = String(a[1] || '').trim(), route = String(a[6] || '').trim();
        var site = null; try{ site = w.siteOfRow({ name:name, route:route }); }catch(e){}
        var out = name;
        if (site) out = site;
        else if (!w.isPlaceholderName(name)){
          if (!ids[name]){
            var kind = (map[name] && map[name].kind) || w.guessNameKind(name);
            ids[name] = kind === 'person' ? '고객 ' + pad4(++np) : '미분류 ' + pad4(++nu);
          }
          out = ids[name];
        }
        var b = a.slice(0, 15); while (b.length < 15) b.push('');
        b[1] = out; b[2] = ''; b[3] = String(a[3] || '').trim() ? '처리' : ''; b[15] = site || '';
        return b;
      });
    });
  }

  // ---------- 올리기 ----------
  function schedulePush(it){
    if (!CLOUD.role || !CLOUD.can(it.domain)) return;
    clearTimeout(timers[it.key]);
    timers[it.key] = setTimeout(function(){ push(it); }, 800);
  }
  function dirty(){ try{ return JSON.parse(lsGet(DIRTY_LS) || '{}'); }catch(e){ return {}; } }
  function setDirty(key, on){ var d = dirty(); if (on) d[key] = 1; else delete d[key]; lsSet(DIRTY_LS, JSON.stringify(d)); }
  // 민원 기록에서 가장 최근 달(YYYY-MM)
  function latestVocMonth(){ var m = ''; try{ (JSON.parse(lsGet('r9_vocRawRows') || '[]') || []).forEach(function(a){ var k = String((a && (a[13] || a[0])) || '').slice(0,7); if (/^\d{4}-\d{2}$/.test(k) && k > m) m = k; }); }catch(e){} return m; }
  function push(it){
    var d0 = localData(it); if (d0 === undefined) return;
    // 이슈 모니터링 요약은 보고 있는 달 기준으로 저장된다 — 담당자가 지난달을 열어 봐도 모두의 현황이 지난달로 바뀌지 않게 최신 달일 때만 올린다
    if (it.key === 'voc_im_summary'){ var lm = latestVocMonth(); if (d0 && d0.month && lm && d0.month !== lm) return; }
    var cmp = sameAs(JSON.stringify(d0));
    if (lastSent[it.key] === cmp) return;
    if (it.deid) toast('민원 자료를 가명 처리해서 공유하는 중…');
    (it.deid ? deidVoc(d0) : Promise.resolve(d0)).then(function(d){
      return sb.from('shared_data').upsert({ key:it.key, domain:it.domain, data:d }).select('updated_at,updated_by_name').single();
    }).then(function(res){
      if (res.error) throw res.error;
      lastSent[it.key] = cmp; setDirty(it.key, false);
      var st = stamps(); st[it.key] = res.data.updated_at; saveStamps(st);
      if (it.deid) lsSet(OWN_VOC_LS, res.data.updated_at);
      CLOUD.meta[it.key] = { by:res.data.updated_by_name, at:res.data.updated_at };
      renderBadge();
      if (it.key === 'arrearsRows' || it.key === 'vocRows' || it.key === 'minap_summary') toast('공유했습니다 — 다른 사람 화면에도 반영됩니다');
    }).catch(function(e){
      setDirty(it.key, true);
      toast('공유하지 못했습니다: ' + ((e && e.message) || '알 수 없는 오류') + ' — 이 PC에는 저장되어 있습니다', true);
    });
  }
  // 이 창에서 저장하면(연체·민원 엑셀 업로드, 메모 입력) 바로 올린다
  Storage.prototype.setItem = function(k, v){
    origSet.apply(this, arguments);
    if (hydrating || this !== window.localStorage) return;
    (byLs[k] || []).forEach(schedulePush);
  };
  // 끼워 넣은 화면(미납관리 · 이슈 모니터링)이 저장하면 이 창에는 storage 알림이 온다
  window.addEventListener('storage', function(e){ (byLs[e.key] || []).forEach(schedulePush); });

  // ---------- 받기 ----------
  // 바뀐 값이 있으면 true — 화면을 다시 그려야 한다
  function pull(){
    return sb.from('shared_data').select('key,data,updated_at,updated_by_name').then(function(res){
      if (res.error) throw res.error;
      var st = stamps(), changed = false, seen = {};
      (res.data || []).forEach(function(row){
        var it = byKey[row.key]; if (!it) return;
        seen[row.key] = true;
        CLOUD.meta[row.key] = { by:row.updated_by_name, at:row.updated_at };
        if (dirty()[row.key] && CLOUD.can(it.domain) && lsGet(it.ls) !== null){ schedulePush(it); return; }       // 못 올린 새 값이 이 PC에 있음 — 덮지 않고 다시 올림
        if (st[row.key] === row.updated_at && lsGet(it.ls) !== null) return;           // 이미 받은 것
        if (it.deid && lsGet(OWN_VOC_LS) === row.updated_at && lsGet(it.ls) !== null){ st[row.key] = row.updated_at; return; } // 이 PC가 올린 원본 유지
        hydrating = true;
        try{
          if (it.part){   // 나눠 올린 값은 이 PC의 나머지 부분과 합친다
            var cur = {}; try{ cur = JSON.parse(lsGet(it.ls) || '{}') || {}; }catch(e){}
            var add = pick(row.data || {}, it.part); Object.keys(add).forEach(function(k){ cur[k] = add[k]; });
            lsSet(it.ls, JSON.stringify(cur));
          } else lsSet(it.ls, JSON.stringify(row.data));
        } finally { hydrating = false; }
        lastSent[it.key] = sameAs(JSON.stringify(localData(it)));
        st[row.key] = row.updated_at; changed = true;
      });
      // 서버에 없는 값 — 올릴 권한이 없는 사람의 PC에 남은 예전 사본은 지운다(옛 자료가 공유 자료처럼 보이지 않게)
      ITEMS.forEach(function(it){
        if (seen[it.key]) return;
        if (!it.part && lsGet(it.ls) !== null && !CLOUD.can(it.domain)){ lsDel(it.ls); changed = true; }
        delete st[it.key];
      });
      saveStamps(st);
      return changed;
    });
  }

  // ---------- 화면 ----------
  function applyRole(){
    html.classList.add('role-' + CLOUD.role);
    html.classList.toggle('can-arrears', CLOUD.can('arrears'));
    html.classList.toggle('can-voc', CLOUD.can('voc'));
    whenReady(function(){
      // 미납관리는 고객별 원본 엑셀이 있어야 하는 담당자 화면 — 권한이 없으면 안내만 보인다
      if (!CLOUD.can('arrears')){
        var of = document.getElementById('overdue-frame');
        if (of){
          if (ON) of.setAttribute('data-src', 'about:blank');   // 시연에서는 뒤에서 샘플을 올려야 하므로 불러 두고 가리기만

          if (!document.getElementById('cloud-overdue-note')){
            var n = document.createElement('div'); n.id = 'cloud-overdue-note'; n.className = 'cloud-note';
            n.innerHTML = '<b>미납관리는 연체 담당 전용 화면입니다</b><span>고객별 원본 엑셀이 필요해 담당자 PC에서만 열립니다. 미납 요약은 현황 · 연체 현황 탭에서 볼 수 있습니다.</span>';
            of.parentNode.insertBefore(n, of);
          }
        }
      }
      // 끼워 넣은 화면에도 권한 표시를 붙여, 그 안의 업로드·AI 실행 버튼을 숨긴다(theme.css)
      ['overdue-frame', 'voc-monitor-frame'].forEach(function(id){
        var f = document.getElementById(id); if (!f) return;
        var mark = function(){ try{ var d = f.contentDocument.documentElement;
          d.classList.add('cloud-on'); d.classList.toggle('no-voc', !CLOUD.can('voc')); d.classList.toggle('no-arrears', !CLOUD.can('arrears')); }catch(e){} };
        f.addEventListener('load', mark); mark();
      });
      // 메모 칸 — 역할이 정해졌으니 편집 가능 여부를 다시 그린다(js/household-voc.js)
      if (typeof renderAllMd === 'function') renderAllMd();
      if (ON) renderBadge();
    });
  }
  var BADGE_KEYS = [['arrearsRows','연체 현황'], ['minap_summary','미납관리'], ['vocRows','민원']];
  function renderBadge(){
    var nav = document.querySelector('.page-nav'); if (!nav || !CLOUD.role) return;
    var b = document.getElementById('cloud-user');
    if (!b){
      b = document.createElement('div'); b.id = 'cloud-user';
      var reset = document.getElementById('btn-clear-uploaded-data');
      nav.insertBefore(b, reset || null);
    }
    var tip = BADGE_KEYS.map(function(p){ var m = CLOUD.meta[p[0]];
      return p[1] + ' — ' + (m ? (m.by || '담당자') + ' · ' + when(m.at) : '아직 올린 자료 없음'); }).join('\n');
    b.title = '마지막으로 올린 자료\n' + tip;
    b.innerHTML = '<span class="cu-dot"></span><b>' + esc(CLOUD.name || '사용자') + '</b><span class="cu-role">' + esc(ROLE_LABEL[CLOUD.role] || CLOUD.role) + '</span>'
      + '<button type="button" id="cloud-logout">로그아웃</button>';
    document.getElementById('cloud-logout').onclick = logout;
  }

  // ---------- 로그인 ----------
  function loginBox(mode, msg){
    whenReady(function(){
      var box = document.getElementById('cloud-login');
      if (!box){ box = document.createElement('div'); box.id = 'cloud-login'; document.body.appendChild(box); }
      var setPw = mode === 'setpw';
      box.innerHTML = '<form class="cl-card" autocomplete="on">'
        + '<div class="cl-brand">청라에너지 마케팅 AI코파일럿</div>'
        + '<div class="cl-sub">' + (setPw ? '새 비밀번호를 정해 주세요' : '사내 계정으로 로그인하세요') + '</div>'
        + (setPw ? '' : '<label>이메일<input type="email" name="email" autocomplete="username" required></label>')
        + '<label>' + (setPw ? '새 비밀번호 (8자 이상)' : '비밀번호') + '<input type="password" name="pw" minlength="' + (setPw ? 8 : 1) + '" autocomplete="' + (setPw ? 'new-password' : 'current-password') + '" required></label>'
        + '<div class="cl-err">' + esc(msg || '') + '</div>'
        + '<button type="submit">' + (setPw ? '비밀번호 저장' : '로그인') + '</button>'
        + '<div class="cl-note">계정은 관리자에게 요청하세요. 비밀번호를 잊었으면 관리자에게 재설정 메일을 요청하세요.</div>'
        + '</form>';
      var form = box.querySelector('form'), err = box.querySelector('.cl-err'), btn = box.querySelector('button');
      var first = form.querySelector('input'); if (first) first.focus();
      form.onsubmit = function(ev){
        ev.preventDefault(); err.textContent = ''; btn.disabled = true;
        var pw = form.pw.value;
        var p = setPw ? sb.auth.updateUser({ password:pw })
                      : sb.auth.signInWithPassword({ email:form.email.value.trim(), password:pw });
        p.then(function(res){
          btn.disabled = false;
          if (res.error){ err.textContent = setPw ? '저장하지 못했습니다: ' + res.error.message : '이메일 또는 비밀번호가 맞지 않습니다'; return; }
          history.replaceState(null, '', location.pathname + location.search);   // 메일 링크의 토큰을 주소에서 지운다
          box.remove(); start(true);
        });
      };
    });
  }
  function logout(){
    if (Object.keys(dirty()).length && !confirm('아직 공유되지 않은 자료가 있습니다. 로그아웃하면 이 PC의 사본이 지워집니다.\n그래도 로그아웃할까요? (취소하면 다시 공유를 시도합니다)')){
      ITEMS.forEach(function(it){ if (dirty()[it.key]) schedulePush(it); }); return;
    }
    lsDel(DIRTY_LS);
    sb.auth.signOut().finally(function(){
      // 이 PC에 남은 공유 자료 사본도 지운다(다음 사람이 로그인 없이 보지 못하게)
      ITEMS.forEach(function(it){ lsDel(it.ls); });
      [STAMP_LS, OWN_VOC_LS, 'home_daily', 'home_done'].forEach(lsDel);
      location.reload();
    });
  }

  // 로그인된 상태에서: 역할 확인 → 자료 받기 → 바뀌었으면 한 번 새로 그림
  function start(justLoggedIn){
    sb.auth.getSession().then(function(r){
      var s = r.data && r.data.session;
      if (!s) return loginBox('login');
      return sb.from('profiles').select('name,role').eq('id', s.user.id).single().then(function(p){
        if (p.error || !p.data || !ROLE_LABEL[p.data.role]){
          sb.auth.signOut(); return loginBox('login', '역할이 지정되지 않은 계정입니다. 관리자에게 요청하세요.');
        }
        CLOUD.role = p.data.role; CLOUD.name = p.data.name;
        applyRole();
        return pull().then(function(changed){
          // 화면은 이미 이전 사본으로 그려졌으므로, 새 자료가 왔으면 한 번만 다시 연다(화면이 가려진 동안이라 깜빡임 없음)
          if ((changed || justLoggedIn) && !sessionStorage.getItem('cloud_reloaded')){
            sessionStorage.setItem('cloud_reloaded', '1'); location.reload(); return;
          }
          sessionStorage.removeItem('cloud_reloaded');
          html.classList.remove('cloud-wait');
          watch();
        });
      });
    }).catch(function(e){
      html.classList.remove('cloud-wait');
      toast('공유 서버에 연결하지 못했습니다 — 이 PC에 저장된 마지막 자료를 보여줍니다 (' + ((e && e.message) || '네트워크') + ')', true);
    });
  }
  // 열어 둔 동안 다른 담당자가 새로 올리면 알려준다(자동으로 바꾸면 보던 화면이 갑자기 바뀌므로 누르면 새로고침)
  function watch(){
    var check = function(){
      pull().then(function(changed){
        if (changed) toast('새 자료가 올라왔습니다 — 눌러서 새로고침', false, function(){ location.reload(); });
        renderBadge();
      }).catch(function(){});
    };
    setInterval(check, 5 * 60 * 1000);
    window.addEventListener('focus', function(){ if (Date.now() - (watch._t || 0) > 60000){ watch._t = Date.now(); check(); } });
  }

  // ---------- 시작 ----------
  if (!window.supabase || !window.supabase.createClient){
    whenReady(function(){ loginBox('login', '로그인 모듈을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침하세요.');
      var b = document.querySelector('#cloud-login button'); if (b) b.disabled = true; });
    return;
  }
  sb = window.supabase.createClient(CFG.url, CFG.anonKey, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
  // 관리자가 보낸 초대·비밀번호 재설정 메일의 링크로 들어오면 새 비밀번호부터 정한다
  var linkType = (location.hash.match(/type=(invite|recovery)/) || [])[1];
  if (linkType){
    sb.auth.onAuthStateChange(function(ev){ if (ev === 'SIGNED_IN' || ev === 'PASSWORD_RECOVERY') loginBox('setpw'); });
    setTimeout(function(){ sb.auth.getSession().then(function(r){ if (r.data && r.data.session) loginBox('setpw'); else loginBox('login', '링크가 만료되었습니다. 관리자에게 다시 요청하세요.'); }); }, 1500);
  } else {
    start(false);
  }
})();
