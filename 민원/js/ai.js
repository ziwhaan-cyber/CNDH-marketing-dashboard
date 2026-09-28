// ===== AI 분석 (Gemini) =====
// 원칙: 숫자 계산과 이슈 '판정'은 전부 자바스크립트가 끝낸다. AI는 분석가이지 계산기가 아니다.
//  - AI가 하는 일: ①JS가 올린 이슈 후보가 실제로 하나의 사안인지 검증 ②접수내용을 읽고 원인·패턴·리스크 정리
//                  ③구두 보고용 요약 ④따로 챙길 사례 선별
//  - AI가 못 하는 일: 이슈를 새로 만들기(후보에 없는 테마는 화면에서 버린다), 건수를 다시 세기
// 키는 각자 브라우저에만 저장되고, 호출은 브라우저 → 구글로 직접 간다(중간 서버 없음).
// 고객명은 보내지 않는다. 단지명(건물)·개인 여부만 보내고, 접수내용의 전화번호·동호수는 가린다.

const AI_LS={key:'voc_im_geminiKey',model:'voc_im_aiModel',result:'voc_im_aiResult'};
// '-latest' 별칭은 구글이 모델을 교체해도 계속 동작한다(버전 박힌 이름은 예고 없이 막힐 수 있음)
const AI_MODELS=['gemini-flash-latest','gemini-pro-latest','gemini-flash-lite-latest'];
const AI_MAX_RECORDS=120;   // 프롬프트에 싣는 접수내용 표본 상한

function aiGetKey(){try{return localStorage.getItem(AI_LS.key)||'';}catch(e){return '';}}
function aiPromptKey(){
  const k=window.prompt('Gemini API 키를 입력하세요 (Google AI Studio에서 발급).\n키는 이 브라우저에만 저장되며 다른 곳으로 전송되지 않습니다.\n비우고 확인하면 저장된 키가 삭제됩니다.',aiGetKey());
  if(k===null)return null;
  try{k.trim()?localStorage.setItem(AI_LS.key,k.trim()):localStorage.removeItem(AI_LS.key);}catch(e){}
  return k.trim();
}
function aiGetModel(){try{const m=localStorage.getItem(AI_LS.model);if(m&&/^gemini-[A-Za-z0-9.\-]+$/.test(m))return m;}catch(e){}return AI_MODELS[0];}

function aiLoadAll(){try{return JSON.parse(localStorage.getItem(AI_LS.result)||'{}');}catch(e){return {};}}
function aiSave(monthKey,entry){
  const all=aiLoadAll();all[monthKey]=entry;
  const keys=Object.keys(all).sort();while(keys.length>12)delete all[keys.shift()];
  try{localStorage.setItem(AI_LS.result,JSON.stringify(all));}catch(e){}
}
// 이 달의 분석 결과 — 실제 호출 결과가 우선, 없으면 샘플 데이터일 때만 미리 만든 예시
function aiResultFor(monthKey){
  const r=aiLoadAll()[monthKey];
  if(r)return r;
  if(isSampleMode()&&typeof SAMPLE_AI!=='undefined'&&SAMPLE_AI[monthKey])return SAMPLE_AI[monthKey];
  return null;
}
// 이슈 카드에 붙일 AI 판단
function aiReviewFor(monthKey,theme){
  const r=aiResultFor(monthKey);
  if(!r||!r.res||!Array.isArray(r.res.issueReview))return null;
  return r.res.issueReview.find(o=>o.theme===theme)||null;
}

function aiMask(t){
  return String(t||'')
    .replace(/0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/g,'[전화번호]')
    .replace(/\d{1,4}\s*동\s*\d{1,4}\s*호/g,'[동호수]')
    .replace(/\d{7,}/g,'[번호]');
}
const aiTrunc=(s,n)=>{s=String(s||'');return s.length>n?s.slice(0,n)+'…':s;};

// 표본 — 이슈 후보·다발 단지·미처리 건을 먼저 담고, 나머지를 고르게 채운다
function aiPickRecords(rows,themes,sites){
  const picked=new Map();
  const spread=(arr,n)=>{if(arr.length<=n)return arr;const step=arr.length/n;return Array.from({length:n},(_,i)=>arr[Math.floor(i*step)]);};
  const add=(list,flag,n)=>spread(list.slice().sort((a,b)=>a.date<b.date?-1:1),n).forEach(r=>{
    const o=picked.get(r)||{r,flags:[]};if(!o.flags.includes(flag))o.flags.push(flag);picked.set(r,o);});
  themes.forEach(t=>add(rows.filter(r=>themeOfKw(r.kw)===t.theme),'테마:'+t.theme,25));
  sites.forEach(s=>add(rows.filter(r=>siteOfRow(r)===s.site),'다발단지:'+s.site,10));
  add(rows.filter(paIsUnresolved),'미처리',12);
  const rest=rows.filter(r=>!picked.has(r));
  add(rest,'보충',Math.max(0,AI_MAX_RECORDS-picked.size));
  return [...picked.values()].slice(0,AI_MAX_RECORDS).map((o,i)=>({
    id:i+1,date:o.r.date,route:o.r.route||'',who:o.r.a3||'',
    site:siteOfRow(o.r)||(o.r.route==='챗봇'?'챗봇':'개인'),
    keyword:o.r.kw||'',theme:themeOfKw(o.r.kw)||'',
    content:aiTrunc(aiMask(o.r.memo),140),resolution:aiTrunc(aiMask(o.r.done),80)||'(미처리)',flags:o.flags
  }));
}

// 화면이 이미 계산한 값을 그대로 묶는다 — AI에게 다시 계산시키지 않기 위함
function aiBuildInput(){
  const c=dashCtx();
  const {rows:prevRows,pm}=dashPrevRows(c);
  const sig=paBuildThemeSignals(c.rows,prevRows,paScanPeriodRawRows(c.y-1,c.mi),
    {minCount:THEME_RULES.minCount,monthKey:dashMonthKey(),inProgress:c.mode!=='end',cutDay:c.mode==='end'?0:c.cut,dim:c.dim});
  const bl=kwBaseline(c);
  const kw={};c.rows.forEach(r=>{if(r.kw)kw[r.kw]=(kw[r.kw]||0)+1;});
  const sites=buildSiteWatch();
  const open=c.rows.filter(paIsUnresolved);
  return{
    period:{month:dashMonthKey(),mode:c.mode==='end'?'월말 확정(전월 전체와 비교)':`월 중간(1~${c.cut}일, 전월 같은 기간과 비교)`},
    totals:{current:c.rows.length,previous:prevRows.length,previousMonth:pm+1,
      changePct:prevRows.length?Math.round((c.rows.length-prevRows.length)/prevRows.length*1000)/10:null,
      chatbot:c.rows.filter(r=>r.route==='챗봇').length,office:c.rows.filter(r=>r.a3==='관리소').length},
    issueCandidates:(sig.themes||[]).map(t=>({theme:t.theme,subject:t.subject,grade:t.grade,count:t.count,prevCount:t.prevCount,
      lastYearSameMonth:t.yoyCount,distinctCustomers:t.persons,keywords:t.keywords,branches:t.branches,
      window:t.window,consecutiveMonths:t.streak,
      sites:{top:t.sites.list,concentrated:t.sites.concentrated,topShare:t.sites.topShare,coverage:t.sites.coverage},
      evidence:t.support})),
    noPreviousMonth:!!sig.noPrev,
    keywordVsUsual:Object.entries(kw).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>{
      const b=bl.of(k);return{keyword:k,count:v,usual:b?Math.round(b.base*10)/10:null,usualBasis:b?b.src:null,
        diffPct:b?Math.round((v-b.base)/b.base*100):null};}),
    busySites:sites.map(s=>({site:s.site,count:s.count,level:s.level==='alert'?'주의':'관찰',burst:s.burst,topKeywords:s.kwList})),
    pending:{notYetReceived:sig.laggingMissing||[],unmappedKeywords:sig.unmappedKeywords||[],
      unresolved:open.length},
    records:aiPickRecords(c.rows,sig.themes||[],sites),
    totalRecords:c.rows.length
  };
}

function aiBuildPrompt(inp){
  const recs=inp.records;const data={...inp};delete data.records;
  return `당신은 지역난방 고객센터의 '민원 데이터 분석가'입니다. 이 결과는 담당자가 팀장에게 그대로 보고하는 데 쓰입니다.

## 두 종류의 데이터
(A) 이미 계산된 통계와 이슈 후보 — 건수·비율·판정은 자바스크립트가 전수 계산한 값입니다. 다시 계산하거나 바꾸지 말고 인용만 하세요.
(B) 접수내용 표본 ${recs.length}건 (전체 ${inp.totalRecords}건 중) — 텍스트를 읽어야 알 수 있는 것(무엇을 묻는지, 원인)을 판단할 때만 쓰세요.
    flags는 표본에 뽑힌 이유입니다: "테마:○○"(이슈 후보 검증용), "다발단지:○○", "미처리", "보충"(고르게 뽑은 일반 건).

## 작성 규칙
- 지어내지 마세요. (B)에 없는 내용, (A)에 없는 숫자를 쓰면 안 됩니다.
- 근거를 댈 수 없는 항목은 빼세요. 억지로 채우지 말고 빈 배열로 두세요.
- 추정은 "~로 보임", "~가능성"처럼 쓰고 단정하지 마세요.
- 표본에서 센 수를 전체 비율로 일반화하지 마세요("전체의 N%" 금지). 표본 기준이면 "표본 ${recs.length}건 중 N건"으로 쓰세요.
- 문장은 짧게. 보고서 문단이 아니라 한 줄씩 읽히게.

## 작성할 것
1. deepAnalysis — 원인(cause)·패턴(pattern)·리스크(risk) 각 0~3개 (화면 상단에 표시되는 주 결과)
   - point: 무엇인지 한 구절. evidence: (A)의 수치나 (B)의 실제 내용. 둘 다 있어야 합니다.
   - keywordVsUsual(평소 대비), busySites(다발 단지), pending(미유입·미처리)도 참고하세요.
   - notYetReceived에 있는 키워드는 자료가 아직 안 들어온 것이지 감소가 아닙니다.
   - 팀장에게 한 줄씩 읽어줄 수 있게 쓰세요. 근거를 댈 수 없으면 빼고 빈 배열로 두세요.

2. issueReview — issueCandidates의 각 항목을 검증 (이슈 카드에 한 줄로 붙습니다)
   - issueCandidates에 있는 테마만 다루세요. **새 이슈를 추가하면 안 됩니다.** 후보가 없으면 빈 배열.
   - theme: 후보의 theme 값을 글자 하나 바꾸지 말고 그대로.
   - verdict: 그 테마의 (B) 표본을 읽고, 하나의 원인에서 비롯된 사안이면 "단일 사안", 서로 무관한 문의가 우연히 겹친 것이면 "무관한 문의 겹침".
   - title: 팀장에게 한 줄로 말할 제목 (예: "7월 단가 조정 후 요금 인상 문의 2개월째 증가").
   - action: 조치 한 가지. sites.concentrated=true면 그 단지를 특정하세요(한 건물 사안은 그 단지 관리소를 통한 대응, 여러 단지에 흩어졌으면 전사 안내).

3. confidence — level("높음"/"보통"/"낮음"), reason(표본 크기, 근거의 양, 한계를 1~2문장).

## (A) 통계와 이슈 후보
${JSON.stringify(data)}

## (B) 접수내용 표본
${JSON.stringify(recs)}

지정된 JSON 스키마로만 응답하세요.`;
}

const AI_SCHEMA={
  type:'object',
  properties:{
    deepAnalysis:{type:'object',properties:{
      cause:{type:'array',items:{type:'object',properties:{point:{type:'string'},evidence:{type:'string'}}}},
      pattern:{type:'array',items:{type:'object',properties:{point:{type:'string'},evidence:{type:'string'}}}},
      risk:{type:'array',items:{type:'object',properties:{point:{type:'string'},evidence:{type:'string'}}}}}},
    issueReview:{type:'array',items:{type:'object',properties:{
      theme:{type:'string'},verdict:{type:'string',enum:['단일 사안','무관한 문의 겹침']},
      title:{type:'string'},action:{type:'string'}}}},
    confidence:{type:'object',properties:{level:{type:'string',enum:['높음','보통','낮음']},reason:{type:'string'}}}
  },
  required:['deepAnalysis','issueReview','confidence']
};

// 오류별 원인·해결 — 실패했을 때 무엇을 하면 되는지까지 보여준다
const AI_ERRORS={
  nokey:['API 키 없음','"API 키"를 눌러 Google AI Studio에서 발급받은 키를 입력하세요.'],
  '400':['잘못된 요청 (400)','키를 정확히 붙여넣었는지(앞뒤 공백) 확인하세요.'],
  '403':['접근 거부 (403)','키가 잘못됐거나 권한이 없습니다. 키를 다시 확인하세요.'],
  '404':['모델 없음 (404)','잠시 뒤 다시 시도하세요. 자동으로 다른 모델로 전환을 시도합니다.'],
  '429':['요청 한도 초과 (429)','1~2분 뒤 다시 시도하세요.'],
  '503':['서버 과부하 (503)','구글 서버 문제입니다. 몇 분 뒤 다시 시도하세요.'],
  network:['네트워크 오류','사내망에서 googleapis.com이 막혀 있을 수 있습니다. 다른 네트워크에서 시도하세요.'],
  empty:['빈 응답','다시 시도하세요.'],
  parse:['응답 해석 실패','다시 시도하세요. 대부분 재시도하면 됩니다.'],
  unknown:['알 수 없는 오류','다시 시도하세요.']
};

// 503(과부하)·429(한도)는 잠시 뒤 풀리므로 자동 재시도
async function aiFetchRetry(url,opt,onWait){
  const waits=[5000,15000,30000];
  for(let i=0;i<=waits.length;i++){
    let res;
    try{res=await fetch(url,opt);}
    catch(e){if(i===waits.length){const er=new Error('network');er.code='network';throw er;}await new Promise(r=>setTimeout(r,waits[i]));continue;}
    if(res.ok||![429,500,502,503,504].includes(res.status)||i===waits.length)return res;
    if(onWait)onWait(res.status,Math.round(waits[i]/1000),i+1);
    await new Promise(r=>setTimeout(r,waits[i]));
  }
}
const aiUrl=(m,key)=>'https://generativelanguage.googleapis.com/v1beta/models/'+m+':generateContent?key='+encodeURIComponent(key);

async function aiCall(prompt,key,onWait,switched){
  const model=aiGetModel();
  const res=await aiFetchRetry(aiUrl(model,key),{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],
      generationConfig:{responseMimeType:'application/json',responseSchema:AI_SCHEMA,maxOutputTokens:8192,temperature:0.3}})},onWait);
  // 모델이 없어졌거나(404) 그 모델만 붐비면(503) 다른 모델로 한 번 넘어간다
  if((res.status===404||res.status===503)&&!switched){
    for(const m of AI_MODELS){
      if(m===model)continue;
      try{localStorage.setItem(AI_LS.model,m);}catch(e){}
      try{return await aiCall(prompt,key,onWait,true);}catch(e){}
    }
    try{localStorage.setItem(AI_LS.model,model);}catch(e){}
  }
  if(!res.ok){const e=new Error('http');e.code=AI_ERRORS[String(res.status)]?String(res.status):'unknown';throw e;}
  const data=await res.json();
  const raw=(((data.candidates||[])[0]||{}).content||{parts:[]}).parts.map(p=>p.text||'').join('').trim();
  if(!raw){const e=new Error('empty');e.code='empty';throw e;}
  try{return JSON.parse(raw);}catch(pe){const e=new Error('parse');e.code='parse';throw e;}
}

// 받은 결과를 규칙대로 거른다 — 후보에 없는 테마, 근거 없는 항목, 선정 이유 없는 사례는 버린다
function aiClean(res,inp){
  const txt=s=>String(s||'').trim();
  const ok=s=>{const t=txt(s);return t&&!/^[-—–.·]+$/.test(t);};
  const allowed=new Set(inp.issueCandidates.map(t=>t.theme));
  const seen=new Set();
  const pairs=a=>(Array.isArray(a)?a:[]).filter(o=>o&&ok(o.point)&&ok(o.evidence)).slice(0,3);
  const out={
    deepAnalysis:{cause:pairs((res.deepAnalysis||{}).cause),pattern:pairs((res.deepAnalysis||{}).pattern),risk:pairs((res.deepAnalysis||{}).risk)},
    issueReview:(res.issueReview||[]).filter(o=>o&&allowed.has(o.theme)&&!seen.has(o.theme)&&seen.add(o.theme)),
    confidence:res.confidence||{level:'보통',reason:''}
  };
  out.dropped=(res.issueReview||[]).filter(o=>o&&!allowed.has(o.theme)).length;   // AI가 멋대로 만든 이슈 수
  return out;
}

let AI_BUSY=false;
async function runAi(){
  if(AI_BUSY)return;
  const host=document.getElementById('aiSection');
  let key=aiGetKey();
  if(!key)key=aiPromptKey();
  if(!key){aiRenderError('nokey');return;}
  AI_BUSY=true;
  const monthKey=dashMonthKey();
  const status=t=>{const el=document.getElementById('aiStatus');if(el)el.textContent=t;};
  renderAiSection();status('접수내용을 읽고 있습니다…');
  try{
    const inp=aiBuildInput();
    const res=await aiCall(aiBuildPrompt(inp),key,(code,sec,n)=>status(`서버 혼잡 (${code}) · ${sec}초 뒤 재시도 ${n}/3`));
    aiSave(monthKey,{at:Date.now(),model:aiGetModel(),rows:inp.totalRecords,sampleSize:inp.records.length,res:aiClean(res,inp)});
    AI_BUSY=false;
    renderAll();
    toast('AI 분석을 마쳤습니다');
  }catch(e){
    AI_BUSY=false;renderAiSection();aiRenderError(e.code||'unknown');
  }
}

function aiRenderError(code){
  const el=document.getElementById('aiErr');if(!el)return;
  const [t,h]=AI_ERRORS[code]||AI_ERRORS.unknown;
  el.innerHTML=`<div class="brief-err"><b>${esc(t)}</b> — ${esc(h)}</div>`;
}

function renderAiSection(){
  const host=document.getElementById('aiSection');if(!host)return;
  const monthKey=dashMonthKey();
  const c=dashCtx();
  const r=aiResultFor(monthKey);
  const head=`<div class="dash-sec-l">AI 분석
      <span class="ai-acts">
        <button class="btn ghost" id="aiKeyBtn">API 키</button>
        <button class="btn primary" id="aiRunBtn"${AI_BUSY?' disabled':''}>${AI_BUSY?'분석 중…':r?'다시 분석':'AI 분석 실행'}</button>
      </span></div>`;
  let body='';
  if(AI_BUSY){
    body=`<div class="card"><div class="ai-status" id="aiStatus">준비 중…</div></div>`;
  }else if(!r){
    body=`<div class="card empty-card">아직 분석하지 않았습니다
      <span>JS가 올린 이슈 후보를 AI가 접수내용으로 검증하고, 원인·패턴·리스크와 구두 보고용 요약을 정리합니다.<br>
      Gemini API 키가 필요하며, 키는 이 브라우저에만 저장됩니다. 고객명은 전송하지 않습니다.</span></div>`;
  }else{
    const x=r.res,when=new Date(r.at);
    const stale=!r.sample&&r.rows!==c.rows.length;
    const meta=r.sample
      ?`<span class="ai-sample">샘플 분석 결과 · 시연용 예시이며 실제 AI 호출 결과가 아닙니다. 키를 넣고 "다시 분석"하면 실제 결과로 바뀝니다.</span>`
      :`${when.getMonth()+1}.${when.getDate()} ${String(when.getHours()).padStart(2,'0')}:${String(when.getMinutes()).padStart(2,'0')} 분석 · ${esc(r.model||'')} · 표본 ${r.sampleSize}건 / 전체 ${r.rows}건`
        +(stale?` · <b style="color:var(--amber)">분석 후 데이터가 바뀌었습니다 — 다시 분석 권장</b>`:'');
    const d=x.deepAnalysis||{};
    const rev=(x.issueReview||[]);
    const conf=x.confidence||{};
    const box=(label,cls,items)=>items.length?`<div class="pa-box pa-box-${cls}"><div class="pa-box-h">${label}</div>
      ${items.map(o=>`<div class="pa-point"><div class="pa-point-t">${esc(o.point)}</div><div class="pa-point-e"><b>근거</b>${esc(o.evidence)}</div></div>`).join('')}</div>`:'';
    const hasDeep=(d.cause||[]).length+(d.pattern||[]).length+(d.risk||[]).length>0;
    body=`<div class="card ai-card">
      <div class="ai-meta">${meta}</div>
      ${hasDeep?`${box('원인','c',d.cause||[])}${box('패턴','p',d.pattern||[])}${box('리스크','r',d.risk||[])}`
        :`<div class="ai-status">근거를 댈 수 있는 항목이 없어 비어 있습니다. 데이터가 적거나 특이 흐름이 없을 때 이렇게 나옵니다.</div>`}
      ${rev.length?`<div class="ai-conf" style="border-top:0;margin-top:10px">이슈 후보 ${rev.length}건 검증 결과는 위 '이슈 감지' 카드에 표시됩니다${rev.some(o=>o.verdict==='무관한 문의 겹침')?' · 무관 판정은 흐리게':''}</div>`:''}
      <div class="ai-conf">신뢰도 <b class="lv-${esc(conf.level||'')}">${esc(conf.level||'—')}</b>${conf.reason?` · ${esc(conf.reason)}`:''}
        ${x.dropped?` · 후보에 없는 이슈 ${x.dropped}건은 규칙에 따라 제외`:''}
        ${conf.level==='낮음'&&!r.sample?` <button class="btn ghost" id="aiRetryBtn">다시 시도</button>`:''}</div>
    </div>`;
  }
  host.innerHTML=head+`<div id="aiErr"></div>`+body;
  document.getElementById('aiRunBtn').onclick=runAi;
  document.getElementById('aiKeyBtn').onclick=()=>{const k=aiPromptKey();if(k!==null)toast(k?'키를 저장했습니다':'키를 삭제했습니다');};
  const rb=document.getElementById('aiRetryBtn');if(rb)rb.onclick=runAi;
}
