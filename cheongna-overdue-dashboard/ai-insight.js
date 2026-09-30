/* ===== [v2 추가] 미납 AI 분석 =====
   민원 이슈 모니터링과 같은 원칙:
   - 숫자 계산(구간별 고객 수·금액, 전월 대비 악화·개선, 회수율)은 전부 이 코드가 끝낸다.
   - AI는 그 숫자를 읽고 원인(추정)·리스크·우선 조치를 정리만 한다. 근거 숫자를 못 대는 항목은 버린다.
   - 고객명·고객번호는 보내지 않는다. 집계값만 보낸다.
   - 결과는 이 브라우저에만 저장되고, 현황(첫 화면)의 AI 인사이트 카드에 요약이 올라간다.
   화면 표시는 theme.css의 'AI 결과 표시(민원·미납 공통)' 규칙(ai-block)을 그대로 쓴다. */
(function(){
  var DEMO=/[?&]demo=1(&|$)/.test(location.search);
  var PFX=DEMO?'demo_':'';
  var AI_KEY='voc_im_geminiKey';                      // 민원 화면과 같은 키
  var RES_KEY=PFX+'minap_aiResult';
  var MODELS=['gemini-flash-latest','gemini-pro-latest','gemini-flash-lite-latest'];

  function getKey(){ try{ return localStorage.getItem(AI_KEY)||''; }catch(e){ return ''; } }
  function promptKey(){
    var k=window.prompt('Gemini API 키를 입력하세요 (Google AI Studio 발급).\n키는 이 브라우저에만 저장되며 다른 곳으로 전송되지 않습니다.\n비우고 확인하면 저장된 키가 삭제됩니다.',getKey());
    if(k===null)return null;
    try{ k.trim()?localStorage.setItem(AI_KEY,k.trim()):localStorage.removeItem(AI_KEY); }catch(e){}
    return k.trim();
  }
  function esc(t){ return String(t==null?'':t).replace(/[&<>"]/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c];}); }
  function asOf(){ return ((document.getElementById('asof-date')||{}).textContent||'').trim(); }
  function won(n){ return Math.round(n).toLocaleString('ko-KR')+'원'; }

  /* ---------- 코드가 계산하는 집계값 (AI에게는 이것만 넘긴다) ---------- */
  var BUCKETS=['1개월','2-3개월','4-6개월','7-12개월','13개월+'];
  function bucketOf(m){ return m<=0?'완납':m===1?'1개월':m<=3?'2-3개월':m<=6?'4-6개월':m<=12?'7-12개월':'13개월+'; }
  function buildStats(){
    if(typeof customers==='undefined'||!customers.length) return null;
    var unpaid=customers.filter(function(c){ return (c.remainingTotal||0)>0; });
    var remain=unpaid.reduce(function(s,c){ return s+c.remainingTotal; },0);
    var orig=customers.reduce(function(s,c){ return s+(c.total||0); },0);
    var paidFull=customers.length-unpaid.length;
    var partial=unpaid.filter(function(c){ return (c.totalPaid||0)>0; }).length;
    var byB={}; BUCKETS.forEach(function(b){ byB[b]={count:0,amount:0}; });
    unpaid.forEach(function(c){ var b=bucketOf(c.remainingOverdueMonths||0); if(byB[b]){ byB[b].count++; byB[b].amount+=c.remainingTotal; } });
    var sorted=unpaid.map(function(c){ return c.remainingTotal; }).sort(function(a,b){ return b-a; });
    var top10=sorted.slice(0,10).reduce(function(s,x){ return s+x; },0);
    var st={
      asOf:asOf(),
      customers:customers.length, unpaidCount:unpaid.length, paidFullCount:paidFull, partialPayCount:partial,
      originalAmount:orig, remainingAmount:remain,
      recoveryRatePct: orig? Math.round((orig-remain)/orig*1000)/10 : 0,
      buckets:BUCKETS.map(function(b){ return {bucket:b,count:byB[b].count,amount:byB[b].amount}; }),
      longTerm3plus:unpaid.filter(function(c){ return c.remainingOverdueMonths>=3; }).length,
      over10m:unpaid.filter(function(c){ return c.remainingTotal>=10000000; }).length,
      top10SharePct: remain? Math.round(top10/remain*1000)/10 : 0,
      prev:null
    };
    // 전월 파일이 함께 올라온 경우에만 비교값을 만든다
    if(typeof previousSnapshot!=='undefined'&&previousSnapshot&&previousSnapshot.custMap){
      var pm=previousSnapshot.custMap, worse=0, worseAmt=0, better=0, fresh=0, cleared=0;
      customers.forEach(function(c){
        var p=pm[String(c.custNo)], m=c.remainingOverdueMonths||0;
        if(!p){ if(m>0) fresh++; return; }
        if(m>p.remainingOverdueMonths){ worse++; worseAmt+=c.remainingTotal; }
        else if(m<p.remainingOverdueMonths){ better++; if(m===0) cleared++; }
      });
      var prevAmt=0, prevCnt=0;
      Object.keys(pm).forEach(function(k){ if(pm[k].remainingTotal>0){ prevAmt+=pm[k].remainingTotal; prevCnt++; } });
      st.prev={ unpaidCount:prevCnt, remainingAmount:prevAmt,
        worsenedCount:worse, worsenedAmount:worseAmt, improvedCount:better, clearedCount:cleared, newlyOverdueCount:fresh };
    }
    return st;
  }
  window.minapAiStats=buildStats;   // 확인용

  /* ---------- AI 호출 ---------- */
  function prompt(st){
    return '당신은 지역난방 공급사의 미납 관리 분석가입니다.\n'
      +'아래는 코드가 계산을 끝낸 미납 집계입니다. 이 숫자를 읽고 담당자가 이번 주에 무엇을 봐야 하는지 정리하세요.\n\n'
      +'## 집계 (금액 단위: 원, prev는 전월 대비 — 없으면 전월 파일이 없는 것)\n'+JSON.stringify(st)+'\n\n'
      +'## 규칙\n'
      +'- 숫자를 새로 계산하거나 지어내지 마세요. evidence에는 위 집계의 숫자를 그대로 인용하세요.\n'
      +'- 개별 고객 사정은 알 수 없습니다. 원인(cause)은 집계에서 읽히는 추정임을 문장에 드러내세요.\n'
      +'- headline: 지금 상황을 한 문장으로.\n'
      +'- cause 최대 2개, risk 최대 2개, action 최대 2개. 각 항목은 point(한 문장)와 evidence(근거 숫자).\n'
      +'- action은 구간(1개월, 2-3개월 등)을 지정해 구체적으로. 없는 제도나 조항을 지어내지 마세요.\n'
      +'- confidence.level은 높음/보통/낮음 중 하나, reason에 한계(예: 전월 파일 없음, 집계만 봄)를 쓰세요.\n\n'
      +'지정된 JSON 스키마로만 응답하세요.';
  }
  var ITEM={type:'object',properties:{point:{type:'string'},evidence:{type:'string'}},required:['point','evidence']};
  var SCHEMA={type:'object',properties:{
    headline:{type:'string'},
    cause:{type:'array',items:ITEM}, risk:{type:'array',items:ITEM}, action:{type:'array',items:ITEM},
    confidence:{type:'object',properties:{level:{type:'string'},reason:{type:'string'}},required:['level']}
  },required:['headline','cause','risk','action','confidence']};

  // 근거에 숫자가 없는 항목은 버린다 — 집계를 보지 않고 쓴 일반론을 걸러내기 위함
  function clean(res){
    var ok=function(a){ return (Array.isArray(a)?a:[]).filter(function(o){ return o&&o.point&&/\d/.test(o.evidence||''); }).slice(0,2); };
    var lv=res&&res.confidence&&res.confidence.level;
    return { headline:String(res&&res.headline||''), cause:ok(res&&res.cause), risk:ok(res&&res.risk), action:ok(res&&res.action),
      confidence:{ level:(['높음','보통','낮음'].indexOf(lv)>=0?lv:'보통'), reason:String(res&&res.confidence&&res.confidence.reason||'') } };
  }

  async function call(key,st){
    var last=null;
    for(var i=0;i<MODELS.length;i++){
      try{
        var r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+MODELS[i]+':generateContent?key='+encodeURIComponent(key),{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({contents:[{parts:[{text:prompt(st)}]}],
            generationConfig:{responseMimeType:'application/json',responseSchema:SCHEMA,temperature:0.3,maxOutputTokens:2048}})});
        if(!r.ok){ last=new Error('요청 실패 ('+r.status+')'); if(r.status===400||r.status===403) break; continue; }
        var data=await r.json();
        var raw=(((data.candidates||[])[0]||{}).content||{parts:[]}).parts.map(function(p){return p.text||'';}).join('').trim();
        return {model:MODELS[i], res:clean(JSON.parse(raw))};
      }catch(e){ last=e; }
    }
    throw last||new Error('응답 없음');
  }

  /* ---------- 저장 · 샘플 ---------- */
  function loadAll(){ try{ return JSON.parse(localStorage.getItem(RES_KEY)||'{}'); }catch(e){ return {}; } }
  function save(entry){ var all=loadAll(); all[entry.asOf]=entry; try{ localStorage.setItem(RES_KEY,JSON.stringify(all)); }catch(e){} }
  function resultFor(){ var r=loadAll()[asOf()]; if(r) return r; return DEMO&&window.SAMPLE_MINAP_AI&&SAMPLE_MINAP_AI[asOf()]||null; }

  /* ---------- 화면 ---------- */
  var BUSY=false;
  function ensureBox(){
    var box=document.getElementById('minap-ai');
    if(box) return box;
    var kpi=document.getElementById('kpi-row'); if(!kpi) return null;
    var title=document.createElement('div'); title.className='section-title'; title.id='minap-ai-title';
    title.innerHTML='AI 분석 <span style="font-weight:500;color:var(--ui-muted);font-size:12px;margin-left:6px">집계만 보고 원인·리스크·우선 조치를 정리합니다 · 고객 정보는 보내지 않음</span>'
      +'<span style="float:right;display:flex;gap:6px"><button class="refresh-btn" id="minap-ai-key">API 키</button><button class="upload-btn" id="minap-ai-run">AI 분석 실행</button></span>';
    box=document.createElement('div'); box.id='minap-ai'; box.className='chart-container'; box.style.marginBottom='12px';
    kpi.parentNode.insertBefore(box,kpi.nextSibling); kpi.parentNode.insertBefore(title,box);
    document.getElementById('minap-ai-key').onclick=function(){ promptKey(); };
    document.getElementById('minap-ai-run').onclick=run;
    return box;
  }
  function block(cls,h,items){
    if(!items||!items.length) return '';
    return '<div class="ai-block'+(cls?' '+cls:'')+'"><div class="ai-block-h">'+h+'</div>'
      +items.map(function(o){ return '<div class="ai-item"><div class="ai-item-t">'+esc(o.point)+'</div><div class="ai-item-e"><b>근거</b>'+esc(o.evidence)+'</div></div>'; }).join('')+'</div>';
  }
  function render(){
    var st=buildStats(); var box=ensureBox(); if(!box) return;
    var t=document.getElementById('minap-ai-title');
    box.style.display=t.style.display=st?'':'none'; if(!st) return;
    document.getElementById('minap-ai-run').textContent=resultFor()?'다시 분석':'AI 분석 실행';
    if(BUSY){ box.innerHTML='<div style="font-size:13px;color:var(--ui-muted)">AI가 집계를 읽고 있습니다…</div>'; return; }
    var r=resultFor();
    if(!r){ box.innerHTML='<div style="font-size:13px;color:var(--ui-muted);line-height:1.8">미납 '+st.unpaidCount+'개소 · 남은 금액 '+won(st.remainingAmount)
      +' 집계를 AI가 읽고 원인·리스크·우선 조치를 정리합니다. 오른쪽 위 <b>AI 분석 실행</b>을 누르세요.</div>'; return; }
    var res=r.res;
    box.innerHTML=(r.sample?'<div class="ai-note" style="margin-bottom:10px">샘플 분석 결과 · 시연용 예시이며 실제 AI 호출 결과가 아닙니다. 키를 넣고 "다시 분석"하면 실제 결과로 바뀝니다.</div>':'')
      +'<div style="font-size:15px;font-weight:700;color:var(--ui-ink);margin:2px 0 12px">'+esc(res.headline)+'</div>'
      +block('','원인 (집계로 본 추정)',res.cause)+block('risk','리스크',res.risk)+block('warn','우선 조치',res.action)
      +'<div class="ai-foot">신뢰도 <b>'+esc(res.confidence.level)+'</b> · '+esc(res.confidence.reason)
      +(r.sample?'':' · '+esc(r.model)+' · '+new Date(r.at).toLocaleString('ko-KR'))+'</div>';
  }
  async function run(){
    var st=buildStats(); if(!st||BUSY) return;
    var key=getKey()||promptKey(); if(!key) return;
    BUSY=true; render();
    try{ var out=await call(key,st); save({asOf:st.asOf,at:Date.now(),model:out.model,res:out.res}); }
    catch(e){ alert('AI 분석 실패: '+(e.message||e)+'\n잠시 뒤 다시 시도하거나, 사내망에서 googleapis.com 접속이 막혀 있는지 확인하세요.'); }
    BUSY=false; render(); try{ saveSummary(); }catch(e){}
  }

  /* ---------- 현황 카드로 요약 넘기기 ----------
     기존 saveSummary(집계 저장) 뒤에 AI 요약만 덧붙인다. 원래 함수는 그대로 둔다. */
  var _save=window.saveSummary;
  window.saveSummary=function(){
    if(typeof _save==='function') _save.apply(this,arguments);
    try{
      var k=PFX+'minap_summary', s=JSON.parse(localStorage.getItem(k)||'null'); if(!s) return;
      var r=resultFor();
      s.ai = r ? {sample:!!r.sample, model:r.model||'', at:r.at||0, headline:r.res.headline, conf:r.res.confidence.level,
        cause:r.res.cause[0]||null, risk:r.res.risk[0]||null, action:r.res.action[0]||null} : null;
      localStorage.setItem(k,JSON.stringify(s));
    }catch(e){}
  };
  var _load=window.loadData;
  window.loadData=function(){
    try{ return _load.apply(this,arguments); }
    finally{ try{ render(); }catch(e){} }
  };
})();
