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
    // [v2] 오늘 값은 아래에서 현재 값으로 붙이므로 기록에서는 뺀다(오늘이 두 번 세어지던 문제)
    var amtSeries=prevDays.map(function(d){ return hist[d] && hist[d].amount; }).filter(function(x){ return typeof x==='number'; });
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

  // ── [v2] AI 인사이트 — "왜, 앞으로 어떻게 될지"(원인·리스크)만 민원/미납 두 칸으로 보여준다.
  //    할 일(조치)은 아래 데일리 체크에 합쳐 두 곳에 같은 내용이 나오지 않게 한다. 샘플 예시면 그렇다고 밝힌다.
  var esc=function(s){ return String(s||'').replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
  var aiEl=document.getElementById('home-ai');
  var vai=v&&v.ai, mai=(m&&!mStale)?m.ai:null;
  var aiMeta=function(ai){ return (ai.sample?'샘플 예시 · 실제 AI 호출 아님':('Gemini'+(ai.at?' · '+new Date(ai.at).toLocaleDateString('ko-KR'):'')))
      +(ai.conf?' · 신뢰도 '+esc(ai.conf):''); };
  var aiRow=function(lbl,o){ return o&&o.point ? '<div class="home-ai-it"><span class="home-ai-lbl">'+lbl+'</span><b>'+esc(o.point)+'</b>'
      +(o.evidence?'<p>'+esc(o.evidence)+'</p>':'')+'</div>' : ''; };
  var aiCol=function(tag,cls,has,ai,head,where,go){
    var h='<div class="home-ai-col"><div class="home-ai-dom"><span class="tag '+cls+'">'+tag+'</span>'
      +(ai?'<span class="home-ai-meta">'+aiMeta(ai)+'</span>':'')+'</div>';
    if(!has) return h+'<div class="home-ai-empty">데이터를 올리면 표시됩니다.</div></div>';
    if(!ai) return h+'<div class="home-ai-empty">'+where+'에서 <b>AI 분석 실행</b>을 누르면 원인·리스크가 여기에 모입니다. '
      +'<span class="home-link" onclick="goHome('+go+')">열기 →</span></div></div>';
    return h+'<div class="home-ai-head">'+head+'</div>'+aiRow('원인',ai.cause)+aiRow('리스크',ai.risk)+'</div>';
  };
  if(!v && !m){ aiEl.hidden=true; }
  else{
    aiEl.hidden=false;
    aiEl.innerHTML='<div class="home-ai-h"><span class="home-ai-ic">✦</span>AI 인사이트'
      +'<span class="home-ai-meta">규칙이 계산 · AI가 해석 · 할 일은 데일리 체크에</span></div>'
      // 미납 칸은 미납관리 화면이 AI 요약(ai)을 넘겨줄 때만 보인다 — 지금 미납관리 화면에는 AI 분석이 없으므로 민원만 한 칸으로
      // 순서는 화면 왼쪽 카드와 같게 미납 → 민원
      +'<div class="home-ai-cols'+(mai?'':' one')+'">'
      + (mai ? aiCol('미납','t-minap',!!(m&&!mStale),mai, esc(mai.headline),
          '미납관리',"'page-arrears','arr','arr-tab-overdue'") : '')
      + aiCol('민원','t-voc',!!v,vai,
          vai?('규칙이 찾은 이슈 '+(v.issues||0)+'건 중 <b>'+(vai.confirmed||0)+'건</b>을 실제 사안으로 확인'
            +(vai.unrelated?' · '+vai.unrelated+'건은 무관한 문의 겹침':'')):'',
          '이슈 모니터링',"'page-voc','voc','voc-monitor'")
      +'</div>';
  }

  // ── 데일리 체크 (중요도 정렬 + 어제 대비)
  // 기준값: 미납 단계·금액은 미납관리의 MINAP_RULES, 민원 경과일은 민원/js/config.js의 UNRESOLVED_AGED_DAYS,
  //         이 화면 쪽은 HOME_RULES(맨 위). 중요도(w)는 클수록 위로 간다.
  var items=[];
  var add=function(o){ items.push(o); };
  var GO_MINAP=['page-arrears','arr','arr-tab-overdue'], GO_VOC=['page-voc','voc','voc-monitor'], GO_ARR=['page-arrears','arr','arr-tab-status'];
  var mr=(m&&m.rules)||{midFrom:3,longFrom:6,bigAmount:10000000};
  var bigTxt=(mr.bigAmount%10000===0)?(mr.bigAmount/10000).toLocaleString('ko-KR')+'만원':mr.bigAmount.toLocaleString('ko-KR')+'원';
  if(m&&!mStale){
    // [v2] 연체 현황 화면의 단계와 맞춘다: 중기 공급정지 안내 / 장기 법적조치 검토
    if(m.long!=null){
      if(m.long) add({tag:'미납',key:'long',stage:'장기',v:m.long,unit:'개소',w:100,go:GO_MINAP,
        text:'장기('+mr.longFrom+'개월 이상) 미납 <b>'+m.long+'개소</b> · 법적조치 검토 대상'});
      if(m.mid) add({tag:'미납',key:'mid',stage:'중기',v:m.mid,unit:'개소',w:88,go:GO_MINAP,
        text:'중기('+mr.midFrom+'~'+(mr.longFrom-1)+'개월) 미납 <b>'+m.mid+'개소</b> · 공급정지 안내 대상'});
    }else if(m.longTerm) add({tag:'미납',key:'longTerm',v:m.longTerm,unit:'개소',w:100,go:GO_MINAP,
      text:'3개월 이상 미납 <b>'+m.longTerm+'개소</b>'});      // 예전 형식 요약(단계 값 없음)
    if(m.big) add({tag:'미납',key:'big',v:m.big,unit:'개소',w:90,go:GO_MINAP,
      text:'미납 '+bigTxt+' 이상 <b>'+m.big+'개소</b> · 개별 안내 필요'});
    // [v2] '새로 밀린 곳'은 전월 파일이 있을 때만 정확히 셀 수 있다. 없으면 '연체 1개월'로 사실대로 쓴다
    if(m.fresh!=null){
      if(m.fresh) add({tag:'미납',key:'fresh',stage:'단기',v:m.fresh,unit:'개소',w:60,go:GO_MINAP,
        text:'전월엔 없던 연체 <b>'+m.fresh+'개소</b> · 1차 안내 대상'});
    }else if(m.newly) add({tag:'미납',key:'newly',stage:'단기',v:m.newly,unit:'개소',w:60,go:GO_MINAP,
      text:'연체 1개월 <b>'+m.newly+'개소</b> · 1차 안내 대상'});
  }else if(m&&mStale){
    // [v2] 미납 데이터는 저장하지 않으므로 하루가 지나면 미납 항목을 빼되, 빠졌다는 사실은 알린다
    add({tag:'미납',key:'minapStale',v:0,unit:'',w:70,go:GO_MINAP,
      text:'미납 데이터가 <b>'+mAgeDays+'일 전</b> 업로드 기준 · 미납 할 일을 보려면 미납관리에 다시 올려주세요'});
  }
  // [v2] 미납관리 요약이 없거나 오래됐으면, 저장되어 있는 연체 현황(연체 탭) 파일로 장기·중기만 보여준다
  if(!m||mStale){
    var arRows=lsLoad('arrearsRows',null), arYmd=lsLoad('arrearsYmd',null);
    if(arRows&&arRows.length){
      var arL=0, arM=0;
      arRows.forEach(function(r){ var mo=Number(r['연체개월'])||0; if(mo>=6) arL++; else if(mo>=3) arM++; });
      var arTag=arYmd?' <span class="todo-ev">연체 현황 '+esc(arYmd)+' 기준</span>':'';
      if(arL) add({tag:'연체',key:'arrLong',v:arL,unit:'개소',w:99,go:GO_ARR,text:'장기(6개월 이상) 연체 <b>'+arL+'개소</b> · 법적조치 검토 대상'+arTag});
      if(arM) add({tag:'연체',key:'arrMid',v:arM,unit:'개소',w:87,go:GO_ARR,text:'중기(3~5개월) 연체 <b>'+arM+'개소</b> · 공급정지 안내 대상'+arTag});
    }
  }
  if(v){
    var agedD=v.agedDays||7;
    if(v.topIssue) add({tag:'민원',key:'issues',v:v.issues,unit:'건',w:95,go:GO_VOC,focus:{sec:'themeAlerts'},
      text:'뜬 이슈 <b>'+v.issues+'건</b> · '+v.topIssue});
    if(v.sites) add({tag:'민원',key:'sites',v:1,unit:'',w:80,go:GO_VOC,focus:{sec:'siteWatch'},
      text:'다발 단지 · <b>'+v.sites+'</b>'});
    if(v.aged) add({tag:'민원',key:'aged',v:v.aged,unit:'건',w:85,go:GO_VOC,
      text:'처리내용 미입력 중 <b>'+v.aged+'건</b>이 '+agedD+'일 이상 경과'});
    else if(v.unresolved) add({tag:'민원',key:'unresolved',v:v.unresolved,unit:'건',w:50,go:GO_VOC,
      text:'처리내용 미입력 <b>'+v.unresolved+'건</b>'});
    if(v.lagging) add({tag:'민원',key:'lagging',v:1,unit:'',w:45,go:GO_VOC,
      text:'<b>'+v.lagging+'</b> 자료 미유입 · 0건을 감소로 보지 말 것'});
    if(v.unmapped) add({tag:'민원',key:'unmapped',v:v.unmapped,unit:'건',w:30,go:GO_VOC,
      text:'테마에 없는 새 키워드 <b>'+v.unmapped+'건</b> · 분류 확인'});
  }
  // [v2] AI가 제안한 조치를 데일리 체크에 합친다. 같은 사안의 줄이 이미 있으면 그 줄에 붙이고, 없으면 새 줄로.
  if(vai&&vai.action&&vai.action.text){
    var hit=items.filter(function(it){ return it.key==='issues' && v.topIssue && v.topIssue.indexOf(vai.action.theme)>=0; })[0];
    if(hit) hit.ai=vai.action.text;
    else add({tag:'민원',key:'ai-voc',v:0,unit:'',w:92,go:GO_VOC,focus:{sec:'aiSection'},aiRow:true,
      text:esc(vai.action.theme)+' · '+esc(vai.action.text)});
  }
  if(mai&&mai.action&&mai.action.point){
    // 미납 AI도 단기·중기·장기로 말하므로, 같은 단계의 줄이 있으면 그 줄에 붙인다
    var st=['장기','중기','단기'].filter(function(s){ return mai.action.point.indexOf(s)>=0; })[0];
    var mhit=st&&items.filter(function(it){ return it.tag==='미납'&&it.stage===st; })[0];
    if(mhit) mhit.ai=mai.action.point;
    else add({tag:'미납',key:'ai-minap',v:0,unit:'',w:97,go:GO_MINAP,aiRow:true,
      text:esc(mai.action.point)+(mai.action.evidence?' <span class="todo-ev">'+esc(mai.action.evidence)+'</span>':'')});
  }
  items.sort(function(a,b){ return (b.w+Math.min(20,b.v))-(a.w+Math.min(20,a.v)); });
  window.__homeItems=items;   // 'i' 버튼이 항목별 이동 정보를 찾을 때 쓴다

  // [v2] 오늘 먼저 볼 것 — 데일리 체크 1·2순위(알림성 줄 제외)를 제목 아래 한 줄로. 숫자는 크게, 누르면 해당 목록으로
  var hl=document.getElementById('home-headline');
  var tops=items.filter(function(it){ return it.key!=='minapStale' && it.key!=='lagging'; }).slice(0,2);
  if(hl){
    hl.hidden=!tops.length;
    hl.innerHTML='<span class="hl-lbl">오늘 먼저 볼 것</span>'+tops.map(function(it,i){
      var t=it.text.replace(/ <span class="todo-ev">[\s\S]*$/,'');   // 근거 문구는 빼고 본문만
      return '<span class="hl-it" onclick="homeGo('+items.indexOf(it)+')"><i>'+(i+1)+'</i>'+t+'</span>';
    }).join('');
  }

  // [v2] 어제 있던 항목이 오늘 없어졌으면 '해결'로 보여준다. 그 영역 데이터가 오늘도 있을 때만(데이터가 없어서 빠진 건 해결이 아님)
  var RESOLVED_LABEL={long:'장기 미납',mid:'중기 미납',big:'고액 미납',fresh:'전월엔 없던 연체',newly:'연체 1개월',longTerm:'3개월 이상 미납',
    arrLong:'장기 연체',arrMid:'중기 연체',issues:'뜬 이슈',sites:'다발 단지',aged:'오래된 미처리',unresolved:'처리내용 미입력',lagging:'자료 미유입',unmapped:'새 키워드'};
  var MINAP_KEYS=['long','mid','big','fresh','newly','longTerm'], ARR_KEYS=['arrLong','arrMid'];
  var todayKeys=items.map(function(it){ return it.key; });
  var resolved=!prev?[]:Object.keys(prev).filter(function(k){
    if(!RESOLVED_LABEL[k]||!(prev[k]>0)||todayKeys.indexOf(k)>=0) return false;
    if(MINAP_KEYS.indexOf(k)>=0) return !!(m&&!mStale);
    if(ARR_KEYS.indexOf(k)>=0) return !m||mStale;
    return !!v;
  }).map(function(k){ return RESOLVED_LABEL[k]+(RESOLVED_UNIT(k)?' '+prev[k]+RESOLVED_UNIT(k):''); });
  function RESOLVED_UNIT(k){ return {sites:'',lagging:''}.hasOwnProperty(k)?'':(MINAP_KEYS.concat(ARR_KEYS).indexOf(k)>=0?'개소':'건'); }

  var doneKeys=[]; try{ var dn=JSON.parse(localStorage.getItem('home_done')||'{}'); if(dn.date===ymd) doneKeys=dn.keys||[]; }catch(e){}
  var rows=items.map(function(it,idx){
    var delta='';
    if(prev&&prev[it.key]!=null&&it.unit){
      var d=it.v-prev[it.key];
      if(d>0) delta='<span class="delta up">'+prevLabel+' 대비 +'+d+it.unit+'</span>';
      else if(d<0) delta='<span class="delta dn">'+prevLabel+' 대비 '+d+it.unit+'</span>';
      else delta='<span class="delta same">'+prevLabel+'과 같음</span>';
    }
    var cls=(it.tag==='민원')?'t-voc':'t-minap';
    // [v2] 중요도 표시: 1순위 강조, 95 이상 빨강 · 80 이상 주황 · 나머지 회색
    var sev=(it.w>=95)?' sev-hi':(it.w>=80)?' sev-mid':'';
    return '<div class="home-todo-row'+sev+(idx===0?' top1':'')+(doneKeys.indexOf(it.key)>=0?' done':'')+'" data-key="'+it.key+'" onclick="homeToggleDone(this)">'
      +'<span class="mark"></span><span class="tag '+cls+'">'+it.tag+'</span>'
      +'<span class="todo-text">'+(it.aiRow?'<span class="ai-mark">AI 제안</span>':'')+it.text
      +(it.ai?'<small class="todo-ai"><span class="ai-mark">AI 제안</span>'+esc(it.ai)+'</small>':'')+'</span>'+delta
      +'<span class="go" title="'+(it.focus?'해당 목록으로 바로 이동':'해당 화면 열기')+'" onclick="event.stopPropagation();homeGo('+idx+')">'+(it.focus?'→':'i')+'</span></div>';
  });
  if(!rows.length) rows.push('<div class="home-todo-row"><span class="todo-text">각 화면에서 데이터를 올리면 조치할 항목이 여기에 모입니다.</span></div>');
  // [v2] 어제 대비 해결된 항목 — 맨 위에 한 줄로(칸이 모자라 잘려도 보이게)
  if(resolved.length) rows.unshift('<div class="home-todo-row resolved"><span class="ok-mark">✓</span>'
    +'<span class="todo-text"><b>'+prevLabel+' 대비 해결</b> · '+resolved.map(esc).join(' · ')+'</span></div>');
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
// [v2] 데일리 체크 → 해당 화면으로 가서, 가능하면 그 항목의 목록·구역까지 바로 연다
// (미납관리: 연체 단계로 걸러진 고객 목록 / 이슈 모니터링: 이슈·다발 단지·AI 분석 구역)
function homeGo(i){
  var it=(window.__homeItems||[])[i]; if(!it) return;
  goHome(it.go[0],it.go[1],it.go[2]);
  if(!it.focus) return;
  var fid=(it.go[2]==='arr-tab-overdue')?'overdue-frame':(it.go[2]==='voc-monitor')?'voc-monitor-frame':null;
  if(!fid) return;
  var tries=0;
  (function poll(){
    try{
      var w=document.getElementById(fid).contentWindow;
      if(it.focus.sec){ if(w.vocFocus&&w.vocFocus(it.focus)) return; }
      else if(w.minapFocus&&w.minapAiStats&&w.minapAiStats()){ w.minapFocus(it.focus); return; }
    }catch(e){}
    if(++tries<40) setTimeout(poll,150);   // 끼워 넣은 화면이 아직 뜨는 중이면 잠시 기다린다(최대 6초)
  })();
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
// 연체 현황 시연 데이터 — 대시보드 쪽에서 가상 연체 파일을 만든다.
// (미납관리 화면은 다른 분이 만든 화면이라 시연 모드를 넣지 않았다. 미납관리 탭은 엑셀을 올려야 채워진다)
function demoArrearsRows(){
  var seed=11, rnd=function(){ seed=(seed*48271)%2147483647; return seed/2147483647; };
  var rows=[];
  for(var i=0;i<148;i++){
    var mo = rnd()<.6 ? 1+Math.floor(rnd()*2) : (rnd()<.7 ? 3+Math.floor(rnd()*3) : 6+Math.floor(rnd()*13));
    rows.push({'연체개월':mo, '합계':Math.round((60000+rnd()*240000)*mo/10)*10});
  }
  return rows;
}
if(DEMO){
  // 페이지가 저장값을 복원하기 전에 넣어 두면 연체 현황·데일리 체크가 평소처럼 읽는다
  try{
    if(!lsLoad('arrearsRows',null)){ lsSave('arrearsRows',demoArrearsRows()); lsSave('arrearsYmd','2026. 8. 31.'); }
    // 시연용 '어제 기록' — 데일리 체크의 어제 대비 변화와 '해결' 표시를 보여주기 위한 가상 값(demo_ 저장 이름에만)
    if(!localStorage.getItem('demo_home_daily')){
      var ar=lsLoad('arrearsRows',[]), arM=0, arL=0;
      ar.forEach(function(r){ var mo=Number(r['연체개월'])||0; if(mo>=6) arL++; else if(mo>=3) arM++; });
      var yd=new Date(Date.now()-86400000), yk=yd.getFullYear()+'-'+String(yd.getMonth()+1).padStart(2,'0')+'-'+String(yd.getDate()).padStart(2,'0');
      var hist0={}; hist0[yk]={arrLong:arL+2,arrMid:arM,issues:3,aged:6,lagging:1,unmapped:2};
      localStorage.setItem('demo_home_daily',JSON.stringify(hist0));
    }
  }catch(e){}
  document.addEventListener('DOMContentLoaded',function(){
    var h=document.querySelector('.header h1');
    if(h){ var b=document.createElement('span'); b.className='demo-badge';
      b.innerHTML='시연 데이터 · 가상 고객<a onclick="demoExit()" title="시연 데이터를 지우고 일반 화면으로">종료</a>'; h.appendChild(b); }
    // 이슈 모니터링을 미리 불러 두면 민원 요약이 저장되어 현황 카드가 바로 채워진다
    var f=document.getElementById('voc-monitor-frame'); if(f){ f.removeAttribute('loading'); loadEmbedFrame('voc-monitor-frame'); }
  });
}
