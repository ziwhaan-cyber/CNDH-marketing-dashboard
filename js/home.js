// 현황(첫 화면) · 시연 모드 — index.html 안에 있던 스크립트를 그대로 옮김
/* [추가] 개요 화면 — 각 업무 화면이 저장해 둔 요약값을 읽어 보여준다.
   요약에는 집계 숫자만 들어 있고 고객명·접수 내용은 들어 있지 않다. */
function homeRead(key){ try{ return JSON.parse(localStorage.getItem(DEMO_PFX+key)||'null'); }catch(e){ return null; } }
function homeWon(n){
  if(n>=100000000) return (n/100000000).toFixed(1)+'억';
  if(n>=10000) return Math.round(n/10000).toLocaleString()+'만';
  return n.toLocaleString();
}
function homeSpark(vals,color){
  if(!vals||vals.length<2) return '<div class="home-chart-empty">추이는 며칠 쌓이면 표시됩니다</div>';
  var w=100,h=28,max=Math.max.apply(null,vals),min=Math.min.apply(null,vals),rng=(max-min)||1;
  var pts=vals.map(function(v,i){ return [(i/(vals.length-1))*w, h-2-((v-min)/rng)*(h-6)]; });
  var d=pts.map(function(p,i){ return (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1); }).join(' ');
  var area=d+' L'+w+' '+h+' L0 '+h+' Z';
  var last=pts[pts.length-1];
  return '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'
    +'<path d="'+area+'" fill="'+color+'" opacity="0.10"></path>'
    +'<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"></path>'
    +'<circle cx="'+last[0].toFixed(1)+'" cy="'+last[1].toFixed(1)+'" r="1.8" fill="'+color+'"></circle></svg>';
}
function homeBars(items,color,opt){
  opt=opt||{};
  if(!items||!items.length) return '<div class="home-chart-empty">데이터가 쌓이면 표시됩니다</div>';
  var w=100,h=28,n=items.length,gap=opt.gap||3,bwMax=opt.maxW||4.5;
  var bw=Math.min(bwMax,(w-gap*(n-1))/n);
  var span=bw*n+gap*(n-1), off=(w-span)/2;
  var max=Math.max.apply(null,items.map(function(o){return o.v;}))||1;
  var bars=items.map(function(o,i){
    var bh=Math.max(1.5,(o.v/max)*(h-6)), x=off+i*(bw+gap), y=h-bh;
    var op=(i===n-1)?'1':'0.45';
    return '<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+bh.toFixed(1)+'" rx="0.6" fill="'+color+'" opacity="'+op+'"></rect>';
  }).join('');
  return '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+bars+'</svg>';
}
// 민원 영업일 최근 7일 — 주말은 빼고 접수일 기준으로 센다
function homeVocWorkdays(n){
  try{
    var raw=JSON.parse(localStorage.getItem(LS_PREFIX+'vocRawRows')||'null');
    if(!Array.isArray(raw)||!raw.length) return [];
    var cnt={};
    raw.forEach(function(r){
      var d=String(r&&r[0]||''), m=/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(d);
      if(!m){ var s2=Number(d); if(s2>20000&&s2<80000){ var dt=new Date(Date.UTC(1899,11,30+Math.floor(s2)));
        m=[null,String(dt.getUTCFullYear()),String(dt.getUTCMonth()+1),String(dt.getUTCDate())]; } }
      if(!m) return;
      var key=m[1]+'-'+String(Number(m[2])).padStart(2,'0')+'-'+String(Number(m[3])).padStart(2,'0');
      var w=new Date(key+'T00:00:00').getDay();
      if(w===0||w===6) return;                 // 주말 제외
      cnt[key]=(cnt[key]||0)+1;
    });
    return Object.keys(cnt).sort().slice(-n).map(function(k){
      var dt=new Date(k+'T00:00:00');
      return {k:(dt.getMonth()+1)+'.'+dt.getDate(), v:cnt[k]};
    });
  }catch(e){ return []; }
}
// 민원 월별 건수 — 대시보드 데이터 탭에 올린 원본에서 직접 센다
function homeVocMonths(n){
  try{
    var raw=JSON.parse(localStorage.getItem(LS_PREFIX+'vocRawRows')||'null');
    if(!Array.isArray(raw)||!raw.length) return [];
    var cnt={};
    raw.forEach(function(r){
      var d=String(r&&r[0]||'');
      var m=/^(\d{4})[-./](\d{1,2})/.exec(d);
      if(!m){ var n2=Number(d); if(n2>20000&&n2<80000){ var dt=new Date(Date.UTC(1899,11,30+Math.floor(n2)));
        m=[null,String(dt.getUTCFullYear()),String(dt.getUTCMonth()+1)]; } }
      if(!m) return;
      var key=m[1]+'-'+String(Number(m[2])).padStart(2,'0');
      cnt[key]=(cnt[key]||0)+1;
    });
    return Object.keys(cnt).sort().slice(-n).map(function(k){ return {k:k,v:cnt[k]}; });
  }catch(e){ return []; }
}
// 데일리 체크 항목을 눌러 확인 표시 — 날짜가 바뀌면 자동으로 초기화된다
function homeToggleDone(el){
  el.classList.toggle('done');
  var now=new Date();
  var ymd=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  var keys=[].slice.call(document.querySelectorAll('.home-todo-row.done')).map(function(r){ return r.dataset.key; });
  try{ localStorage.setItem('home_done',JSON.stringify({date:ymd,keys:keys})); }catch(e){}
}
function renderHome(){
  var v=homeRead('voc_im_summary'), m=homeRead('minap_summary');
  // 데이터 탭 원본이 없으면 예전 요약이 남아 있어도 표시하지 않는다(숫자와 화면이 어긋나지 않게)
  var hasVocRaw=false;
  try{ var raw=JSON.parse(localStorage.getItem(LS_PREFIX+'vocRawRows')||'null'); hasVocRaw=Array.isArray(raw)&&raw.length>0; }catch(e){}
  if(!hasVocRaw) v=null;

  // ── 날짜 제목 · 기준일
  var now=new Date(), wd=['일','월','화','수','목','금','토'][now.getDay()];
  document.getElementById('home-title').textContent=(now.getMonth()+1)+'월 '+now.getDate()+'일 ('+wd+') 현황';
  var when=[];
  if(m&&m.asOf) when.push('미납 '+m.asOf);
  if(v&&v.asOf) when.push('민원 '+v.asOf);
  document.getElementById('home-asof').textContent = when.length
    ? ('데이터 기준일 · '+when.join(' / '))
    : '각 화면에서 엑셀을 올리면 이 자리에 현황이 모입니다.';

  // ── 어제 값 (변화 표시용)
  var ymd=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  var hist={}; try{ hist=JSON.parse(localStorage.getItem(DEMO_PFX+'home_daily')||'{}'); }catch(e){ hist={}; }
  var days=Object.keys(hist).sort();
  var prevDays=days.filter(function(d){ return d<ymd; });
  var prev=prevDays.length?hist[prevDays[prevDays.length-1]]:null;
  var prevLabel=prevDays.length?prevDays[prevDays.length-1].slice(5).replace('-','.'):'';

  // ── 연체·미납 카드
  var mEl=document.getElementById('home-minap');
  // 미납 화면은 데이터를 저장하지 않으므로, 요약이 오래되면 '지난 업로드 기준'임을 분명히 한다
  var mAgeDays = m&&m.at ? Math.floor((Date.now()-m.at)/86400000) : null;
  var mStale = (mAgeDays!=null && mAgeDays>=1);
  if(m){
    var amtSeries=days.map(function(d){ return hist[d] && hist[d].amount; }).filter(function(x){ return typeof x==='number'; });
    if(typeof m.amount==='number') amtSeries=amtSeries.concat([m.amount]);
    mEl.className='home-kpi'+(mStale?' stale':'');
    mEl.innerHTML='<div class="home-kpi-h"><span class="home-kpi-t">연체 · 미납</span>'
      +'<span class="home-kpi-s">'+(mStale
          ? (mAgeDays+'일 전 업로드 기준 · 다시 올려주세요')
          : ((m.asOf||'')+' 기준'))+'</span></div>'
      +'<div class="home-nums">'
      +'<div class="home-num"><div class="v">'+m.count+'<small>개소</small></div><div class="k">미납 고객</div></div>'
      +'<div class="home-num"><div class="v">'+homeWon(m.amount)+'<small>원</small></div><div class="k">미납 금액</div></div>'
      +'<div class="home-num"><div class="v point">'+m.longTerm+'<small>개소</small></div><div class="k">3개월 이상</div></div>'
      +'</div>'
      +'<div class="home-chart">'
      +((amtSeries.length>2)
        ? '<div class="home-chart-h"><span>미납 금액 추이</span><span>'+amtSeries.length+'일</span></div>'+homeSpark(amtSeries.slice(-7),'#236B7A')
        : '<div class="home-chart-h"><span>연체 개월 구간별 고객 수</span><span>단위: 개소</span></div>'
          +homeBars((m.buckets||[]).map(function(b){return {k:b.k,v:b.v};}),'#236B7A',{gap:3.4,maxW:4.5}))
      +'</div>'
      +'<div class="home-foot-row"><span></span><span class="home-link" onclick="goHome(\'page-arrears\',\'arr\',\'arr-tab-overdue\')">미납관리 열기 →</span></div>';
  }else{
    mEl.className='home-kpi';
    mEl.innerHTML='<div class="home-kpi-h"><span class="home-kpi-t">연체 · 미납</span></div>'
      +'<div class="home-empty">미납 화면은 보안을 위해 데이터를 저장하지 않습니다.<br>엑셀을 올리면 이 자리에 현황이 표시됩니다.</div>'
      +'<div class="home-foot-row"><span></span><span class="home-link" onclick="goHome(\'page-arrears\',\'arr\',\'arr-tab-overdue\')">미납관리 열기 →</span></div>';
  }

  // ── 민원 카드
  var vocEl=document.getElementById('home-voc');
  if(v){
    var pct=(v.pct==null)?'—':((v.pct>0?'+':'')+v.pct+'%');
    var cls=(v.pct>0)?'up':(v.pct<0?'dn':'');
    var days7=homeVocWorkdays(7);
    vocEl.innerHTML='<div class="home-kpi-h"><span class="home-kpi-t">민원</span>'
      +'<span class="home-kpi-s">'+(v.month||'')+(v.mode==='mid'?' 진행 중':' 확정')+'</span></div>'
      +'<div class="home-nums">'
      +'<div class="home-num"><div class="v">'+v.count+'<small>건</small></div><div class="k">접수</div></div>'
      +'<div class="home-num"><div class="v '+cls+'">'+pct+'</div><div class="k">전월 대비</div></div>'
      +'<div class="home-num"><div class="v">'+v.issues+'<small>건</small></div><div class="k">뜬 이슈</div></div>'
      +'<div class="home-num"><div class="v">'+v.unresolved+'<small>건</small></div><div class="k">미처리</div></div>'
      +'</div>'
      +'<div class="home-chart"><div class="home-chart-h"><span>영업일 최근 7일 접수</span><span>'
      +(days7.length?days7[0].k+' ~ '+days7[days7.length-1].k:'')+'</span></div>'
      + homeBars(days7,'#B45309',{gap:3,maxW:4.5})+'</div>'
      +'<div class="home-foot-row"><span></span><span class="home-link" onclick="goHome(\'page-voc\',\'voc\',\'voc-monitor\')">이슈 모니터링 열기 →</span></div>';
  }else{
    vocEl.innerHTML='<div class="home-kpi-h"><span class="home-kpi-t">민원</span></div>'
      +'<div class="home-empty">데이터 탭에 엑셀을 올리면 이 자리에 현황이 표시됩니다.</div>'
      +'<div class="home-foot-row"><span></span><span class="home-link" onclick="goHome(\'page-voc\',\'voc\',\'voc-monitor\')">이슈 모니터링 열기 →</span></div>';
  }

  // ── [v2] AI 인사이트 — 규칙이 판정한 이슈를 AI가 읽고 정리한 결과. 샘플 예시면 그렇다고 밝힌다
  var aiEl=document.getElementById('home-ai'), ai=v&&v.ai;
  if(!v){ aiEl.hidden=true; }
  else if(!ai){
    aiEl.hidden=false;
    aiEl.innerHTML='<div class="home-ai-h"><span class="home-ai-ic">✦</span>AI 인사이트</div>'
      +'<div class="home-ai-empty">이슈 모니터링에서 <b>AI 분석 실행</b>을 누르면 원인·리스크·조치 요약이 여기에 표시됩니다.'
      +' <span class="home-link" onclick="goHome(\'page-voc\',\'voc\',\'voc-monitor\')">이슈 모니터링 열기 →</span></div>';
  }else{
    var esc=function(s){ return String(s||'').replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
    var row=function(lbl,o,ev){ return o&&(o.point||o.text) ?'<div class="home-ai-it"><span class="home-ai-lbl">'+lbl+'</span>'
      +'<b>'+esc(o.point||o.text)+'</b>'+(ev&&o.evidence?'<p>'+esc(o.evidence)+'</p>':'')+'</div>' : ''; };
    var meta=(ai.sample?'샘플 예시 · 실제 AI 호출 아님':('Gemini'+(ai.at?' · '+new Date(ai.at).toLocaleDateString('ko-KR'):'')))
      +(ai.conf?' · 신뢰도 '+esc(ai.conf):'');
    aiEl.hidden=false;
    aiEl.innerHTML='<div class="home-ai-h"><span class="home-ai-ic">✦</span>AI 인사이트'
      +'<span class="home-ai-meta">'+meta+'</span></div>'
      +'<div class="home-ai-sub">규칙이 찾은 이슈 '+(v.issues||0)+'건 중 AI가 <b>'+(ai.confirmed||0)+'건</b>을 실제 사안으로 확인'
      +(ai.unrelated?', '+ai.unrelated+'건은 무관한 문의 겹침으로 판정':'')+'</div>'
      +row('원인',ai.cause,true)+row('리스크',ai.risk,true)
      +(ai.action?'<div class="home-ai-it"><span class="home-ai-lbl">조치 · '+esc(ai.action.theme)+'</span><b>'+esc(ai.action.text)+'</b></div>':'')
      +'<div class="home-ai-foot"><span class="home-link" onclick="goHome(\'page-voc\',\'voc\',\'voc-monitor\')">AI 분석 전체 보기 →</span></div>';
  }

  // ── 데일리 체크 (중요도 정렬 + 어제 대비)
  var items=[];
  var add=function(o){ items.push(o); };
  if(m&&!mStale){
    if(m.longTerm) add({tag:'미납',key:'longTerm',v:m.longTerm,unit:'개소',w:100,go:['page-arrears','arr','arr-tab-overdue'],
      text:'3개월 이상 장기 미납 <b>'+m.longTerm+'개소</b> · 법적조치 검토 대상'});
    if(m.big) add({tag:'미납',key:'big',v:m.big,unit:'개소',w:90,go:['page-arrears','arr','arr-tab-overdue'],
      text:'미납 1,000만원 이상 <b>'+m.big+'개소</b> · 개별 안내 필요'});
    if(m.newly) add({tag:'미납',key:'newly',v:m.newly,unit:'개소',w:60,go:['page-arrears','arr','arr-tab-overdue'],
      text:'이번 달 새로 밀린 곳 <b>'+m.newly+'개소</b> · 1차 안내 대상'});
  }
  if(v){
    if(v.topIssue) add({tag:'민원',key:'issues',v:v.issues,unit:'건',w:95,go:['page-voc','voc','voc-monitor'],
      text:'뜬 이슈 <b>'+v.issues+'건</b> · '+v.topIssue});
    if(v.sites) add({tag:'민원',key:'sites',v:1,unit:'',w:80,go:['page-voc','voc','voc-monitor'],
      text:'다발 단지 · <b>'+v.sites+'</b>'});
    if(v.aged) add({tag:'민원',key:'aged',v:v.aged,unit:'건',w:85,go:['page-voc','voc','voc-monitor'],
      text:'처리내용 미입력 중 <b>'+v.aged+'건</b>이 7일 이상 경과'});
    else if(v.unresolved) add({tag:'민원',key:'unresolved',v:v.unresolved,unit:'건',w:50,go:['page-voc','voc','voc-monitor'],
      text:'처리내용 미입력 <b>'+v.unresolved+'건</b>'});
    if(v.lagging) add({tag:'민원',key:'lagging',v:1,unit:'',w:45,go:['page-voc','voc','voc-monitor'],
      text:'<b>'+v.lagging+'</b> 자료 미유입 · 0건을 감소로 보지 말 것'});
    if(v.unmapped) add({tag:'민원',key:'unmapped',v:v.unmapped,unit:'건',w:30,go:['page-voc','voc','voc-monitor'],
      text:'테마에 없는 새 키워드 <b>'+v.unmapped+'건</b> · 분류 확인'});
  }
  items.sort(function(a,b){ return (b.w+Math.min(20,b.v))-(a.w+Math.min(20,a.v)); });

  var doneKeys=[]; try{ var dn=JSON.parse(localStorage.getItem('home_done')||'{}'); if(dn.date===ymd) doneKeys=dn.keys||[]; }catch(e){}
  var rows=items.map(function(it){
    var delta='';
    if(prev&&prev[it.key]!=null&&it.unit){
      var d=it.v-prev[it.key];
      if(d>0) delta='<span class="delta up">'+prevLabel+' 대비 +'+d+it.unit+'</span>';
      else if(d<0) delta='<span class="delta dn">'+prevLabel+' 대비 '+d+it.unit+'</span>';
      else delta='<span class="delta same">'+prevLabel+'과 같음</span>';
    }
    var cls=(it.tag==='미납')?'t-minap':'t-voc';
    return '<div class="home-todo-row'+(doneKeys.indexOf(it.key)>=0?' done':'')+'" data-key="'+it.key+'" onclick="homeToggleDone(this)">'
      +'<span class="mark"></span><span class="tag '+cls+'">'+it.tag+'</span>'
      +'<span class="todo-text">'+it.text+'</span>'+delta
      +'<span class="go" title="해당 화면 열기" onclick="event.stopPropagation();goHome(\''+it.go[0]+'\',\''+it.go[1]+'\',\''+it.go[2]+'\')">i</span></div>';
  });
  if(!rows.length) rows.push('<div class="home-todo-row"><span class="todo-text">각 화면에서 데이터를 올리면 조치할 항목이 여기에 모입니다.</span></div>');
  var todoEl=document.getElementById('home-todo');
  todoEl.innerHTML=rows.join('');
  // 스크롤 없이 보이도록, 칸에 들어가는 만큼만 남기고 나머지는 건수로 알린다
  requestAnimationFrame(function(){
    var box=todoEl.clientHeight, list=[].slice.call(todoEl.children), used=0, cut=-1;
    for(var i=0;i<list.length;i++){
      used+=list[i].getBoundingClientRect().height;
      if(used>box-14){ cut=i; break; }
    }
    if(cut>0){
      var hidden=list.length-cut;
      for(var j=cut;j<list.length;j++) list[j].remove();
      var more=document.createElement('div');
      more.className='home-todo-more';
      more.textContent='그 밖에 '+hidden+'건 · 각 화면에서 확인';
      todoEl.appendChild(more);
    }
  });
  document.getElementById('home-check-note').textContent =
    items.length ? (items.length+'건 · 중요한 순서') : '';

  // ── 오늘 값 저장 (최근 7일)
  var todayVals={}; items.forEach(function(it){ todayVals[it.key]=it.v; });
  if(m&&typeof m.amount==='number') todayVals.amount=m.amount;
  if(Object.keys(todayVals).length){
    hist[ymd]=todayVals;
    var keep=Object.keys(hist).sort().slice(-7), trimmed={};
    keep.forEach(function(d){ trimmed[d]=hist[d]; });
    try{ localStorage.setItem(DEMO_PFX+'home_daily',JSON.stringify(trimmed)); }catch(e){}
  }
}
document.addEventListener('DOMContentLoaded',renderHome);
window.addEventListener('storage',function(e){
  if(e.key===DEMO_PFX+'voc_im_summary'||e.key===DEMO_PFX+'minap_summary')renderHome();
  // [v2] 시연 모드: 이슈 모니터링 화면이 샘플 민원을 채우면 민원통계·현황도 다시 그린다
  if(DEMO && e.key===LS_PREFIX+'vocRawRows'){
    try{ var rows=lsLoad('vocRawRows',null); if(rows&&rows.length){ vocRunAll(rows); renderHome(); } }catch(err){}
  }
});

// ===== [v2 추가] 시연 모드 (?demo=1) =====
// 민원·미납은 각 화면에 이미 있는 샘플 데이터를 그대로 쓰고, 연체 현황만 여기서 가상 데이터를 만든다.
// 모든 값은 'demo_' 저장 이름에만 들어가며, '종료'를 누르면 지워진다.
function demoExit(){
  try{ Object.keys(localStorage).filter(function(k){ return k.indexOf('demo_')===0; })
    .forEach(function(k){ localStorage.removeItem(k); }); }catch(e){}
  location.href=location.pathname;
}
// 연체 현황 시연 데이터는 미납관리 샘플의 요약(연체 개월 구간별 고객 수·남은 금액)에서 만든다.
// 두 화면의 개소 수와 금액 합계가 서로 맞게 하기 위함. 요약이 아직 없으면 도착할 때 다시 불린다.
function demoArrearsFromMinap(){
  var m=homeRead('minap_summary');
  if(!m||!m.buckets||!m.amount||lsLoad('arrearsRows',null)) return;
  var seed=11, rnd=function(){ seed=(seed*48271)%2147483647; return seed/2147483647; };
  var rows=[], w=0;
  m.buckets.forEach(function(b){
    for(var i=0;i<b.v;i++){
      var mo = (b.k==='5+') ? 5+(i%5) : Number(b.k);      // 5개월 이상은 5~9개월로 나눠 장기 연체 칸도 보이게
      var x = mo*(0.6+rnd()*0.8); w+=x; rows.push({'연체개월':mo, _w:x});
    }
  });
  var left=m.amount;
  rows.forEach(function(r,i){
    var a = (i===rows.length-1) ? left : Math.round(m.amount*r._w/w/10)*10;
    left-=a; r['합계']=a; delete r._w;
  });
  var ymd=m.asOf||'2026. 9. 18.';
  lsSave('arrearsRows',rows); lsSave('arrearsYmd',ymd);
  try{ renderArrearsFromRows(rows,ymd); }catch(e){}   // 저장값 복원은 이미 지나갔으므로 바로 그린다
}
if(DEMO){
  window.addEventListener('storage',function(e){ if(e.key==='demo_minap_summary') demoArrearsFromMinap(); });
  document.addEventListener('DOMContentLoaded',function(){
    var h=document.querySelector('.header h1');
    if(h){ var b=document.createElement('span'); b.className='demo-badge';
      b.innerHTML='시연 데이터 · 가상 고객<a onclick="demoExit()" title="시연 데이터를 지우고 일반 화면으로">종료</a>'; h.appendChild(b); }
    demoArrearsFromMinap();
    // 두 화면을 미리 불러 두면 각 화면의 요약이 저장되어 현황 카드가 바로 채워진다
    ['voc-monitor-frame','overdue-frame'].forEach(function(id){
      var f=document.getElementById(id); if(f){ f.removeAttribute('loading'); loadEmbedFrame(id); }
    });
  });
}
