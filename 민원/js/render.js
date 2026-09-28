function openSiteMemoPopup(site){
  const c=dashCtx();
  const [y,m]=dashMonthKey().split('-').map(Number),mi=m-1;
  openMemoPopup(null,null,{
    start:new Date(y,mi,1),end:new Date(y,mi,daysInMonth(y,mi),23,59,59),
    label:`${y}년 ${m}월`,title:site,
    filter:r=>siteOfRow(r)===site
  });
}


// scope 미지정이면 화면에서 고른 기준 월 전체. {start,end,label}을 넘기면 그 기간만 본다.
// scope.filter를 주면 키워드·경로 대신 그 조건으로 걸러 연다(단지별 등)
function openMemoPopup(kw,route,scope){
  const back=document.getElementById('memoPopup');if(!back)return;
  let rows=[],periodLabel='',start=null,end=null;
  if(scope&&scope.start&&scope.end){
    start=scope.start;end=scope.end;periodLabel=scope.label||'';
  }else{
    const moVal=dashMonthKey();
    if(moVal){
      const[y,m]=moVal.split('-').map(Number);const mi=m-1;const dim=daysInMonth(y,mi);
      start=new Date(y,mi,1);end=new Date(y,mi,dim,23,59,59);
      periodLabel=`${y}년 ${m}월`;
    }
  }
  if(start&&end){
    rows=DATA.filter(r=>{
      const d=parseDate(r.date);
      if(!d||d<start||d>end)return false;
      // 단지·테마처럼 '그 묶음의 건을 전부 보는' 경우엔 접수내용이 비어 있어도 빼지 않는다.
      // 목록에는 7건인데 눌렀더니 0건으로 보이면 집계가 틀린 것처럼 읽힌다.
      if(scope&&typeof scope.filter==='function')return scope.filter(r);
      if(!r.memo||!r.memo.trim())return false;
      return (!kw||r.kw===kw)&&(!route||r.route===route);
    }).sort((a,b)=>(a.date<b.date?1:a.date>b.date?-1:0));
  }
  document.getElementById('memoPopupTitle').textContent=(scope&&scope.title)||kw||'접수내용';
  document.getElementById('memoPopupSub').textContent=[periodLabel,route].filter(Boolean).join(' · ');
  document.getElementById('memoPopupCount').textContent=`${rows.length}건`;
  const body=document.getElementById('memoPopupBody');
  body.innerHTML=rows.length
    ? rows.map(r=>`<div class="memo-row"><div class="memo-row-body">`
        +`<div class="memo-meta">${fmtK(r.date)}${r.name?` · ${esc(r.name)}`:''}${r.type?` · ${esc(r.type)}`:''}${r.route?` · ${esc(r.route)}`:''}</div>`
        +(r.memo&&r.memo.trim()
          ?`<div class="memo-q"><span class="memo-tag q">문의</span>${esc(r.memo)}</div>`
          :`<div class="memo-q undone"><span class="memo-tag undone">내용 없음</span>접수내용 미입력</div>`)
        +(r.done&&r.done.trim()?`<div class="memo-a"><span class="memo-tag a">처리</span>${esc(r.done)}</div>`:`<div class="memo-a undone"><span class="memo-tag undone">미처리</span>처리내용 미입력</div>`)
        +`</div></div>`).join('')
    : '<div class="an-empty">해당 조건의 접수내용이 없습니다.</div>';
  body.scrollTop=0;
  back.classList.add('on');
}

function closeMemoPopup(){const b=document.getElementById('memoPopup');if(b)b.classList.remove('on');}

function buildDashMonthPicker(){
  const sel=document.getElementById('dashMonthPick');if(!sel)return;
  const months=new Set();
  DATA.forEach(r=>{const d=parseDate(r.date);if(d)months.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);});
  const arr=[...months].sort().reverse();
  if(!arr.length){sel.innerHTML='<option>데이터 없음</option>';return;}
  if(!DASH_MONTH||!arr.includes(DASH_MONTH))DASH_MONTH=arr[0];
  sel.innerHTML=arr.map(k=>`<option value="${k}">${k.replace('-','년 ').replace('년 0','년 ')}월</option>`).join('');
  sel.value=DASH_MONTH;
}

function renderDashMode(){
  const c=dashCtx();
  document.querySelectorAll('#dashModeSw [data-mode]').forEach(b=>{
    b.classList.toggle('on',b.dataset.mode===c.mode);
  });
}

function renderDashNow(){
  const host=document.getElementById('dashNow');if(!host)return;
  const c=dashCtx();
  const {rows:prevRows,pm}=dashPrevRows(c);
  const cur=c.rows.length,prev=prevRows.length;
  const diff=cur-prev;
  const pct=prev?Math.round(diff/prev*1000)/10:null;
  const dayTop=(()=>{const t={};c.rows.forEach(r=>{const d=parseDate(r.date);if(d)t[d.getDate()]=(t[d.getDate()]||0)+1;});
    const e=Object.entries(t).sort((a,b)=>b[1]-a[1])[0];return e?{day:e[0],n:e[1]}:null;})();
  // 일평균 — 접수가 있던 날 기준. 주말·공휴일을 분모에 넣으면 실제 유입 강도가 흐려진다.
  const dayset=new Set();
  c.rows.forEach(r=>{const d=parseDate(r.date);if(d)dayset.add(d.getDate());});
  const activeDays=dayset.size||1;
  const perDay=Math.round(cur/activeDays*10)/10;
  const cell=(label,value,sub,tone)=>`<div class="stat-cell">
    <div class="stat-l">${label}</div>
    <div class="stat-v"${tone?` style="color:${tone}"`:''}>${value}</div>
    ${sub?`<div class="stat-s">${sub}</div>`:''}</div>`;
  const scope=c.mode==='end'?`${c.m}월 전체`:`${c.m}월 1~${c.cut}일`;
  host.innerHTML=`<div class="scope-bar">
      <span class="scope-m">${c.y}년 ${c.m}월</span>
      <span class="scope-t ${c.mode}">${c.mode==='end'?'전체 기준':'진행 중'}</span>
      <span class="scope-s">${c.mode==='end'?`1~${c.dim}일 · 전월 전체와 비교`:`1~${c.cut}일까지 입력됨 · 전월도 같은 기간으로 비교`}${c.mode!==c.auto?' · 수동 전환':''}</span>
    </div>
  <div class="stat-row">
    ${cell('접수 건수',`${cur}<span class="u">건</span>`,scope)}
    ${cell(c.mode==='end'?'전월 대비':'전월 동기 대비',pct==null?'—':`${diff>=0?'+':''}${pct}<span class="u">%</span>`,`${pm+1}월 ${prev}건 → ${cur}건`,pct==null?'':diff>0?'var(--up)':diff<0?'var(--down)':'')}
    ${cell('일 최다 접수',dayTop?`${dayTop.n}<span class="u">건</span>`:'—',dayTop?`${c.m}.${dayTop.day}`:'')}
    ${cell('일평균 접수',`${perDay}<span class="u">건</span>`,`접수 ${activeDays}일 기준`)}
  </div>`;
}


function renderDashContent(){
  const host=document.getElementById('dashContent');if(!host)return;
  const c=dashCtx();
  const rows=c.rows;
  if(!rows.length){host.innerHTML='';return;}
  const total=rows.length;
  const kw={};rows.forEach(r=>{if(r.kw)kw[r.kw]=(kw[r.kw]||0)+1;});
  const bl=kwBaseline(c);
  const list=Object.entries(kw).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>{
    const b=bl.of(k);
    const diff=b?Math.round((v-b.base)/b.base*100):null;
    return{k,v,b,diff};
  });
  // 벗어난 폭이 가장 큰 것을 기준으로 막대 길이를 정한다(한 줄이 화면을 다 먹지 않게 상한을 둔다)
  const maxAbs=Math.max(30,...list.map(o=>Math.min(200,Math.abs(o.diff||0))));
  const row=o=>{
    const off=o.diff==null?0:Math.max(-200,Math.min(200,o.diff));
    const w=Math.min(48,Math.abs(off)/maxAbs*48);
    const strong=Math.abs(off)>=30;
    const col=off>0?(strong?'var(--up)':'var(--line)'):(strong?'var(--down)':'var(--line)');
    const bar=o.diff==null?'' :
      (off>=0?`<span class="kb-fill" style="left:50%;width:${w}%;background:${col};border-radius:0 3px 3px 0"></span>`
             :`<span class="kb-fill" style="right:50%;width:${w}%;background:${col};border-radius:3px 0 0 3px"></span>`);
    const label=o.diff==null?'<span class="kb-x">기준 없음</span>'
      :`<span class="kb-n"${strong?` style="color:${off>0?'var(--up)':'var(--down)'}"`:''}>${off>0?'+':''}${off}%</span>`;
    const tip=o.b?`${o.k} ${o.v}건 · 평소 ${Math.round(o.b.base)}건 (${o.b.src})`:`${o.k} ${o.v}건 · 기준 없음`;
    return `<div class="kb-row${strong?'':' dim'}" title="${esc(tip)}">
      <span class="kb-k">${esc(o.k)}</span>
      <span class="kb-v">${o.v}</span>
      <span class="kb-bar"><span class="kb-mid"></span>${bar}</span>
      ${label}
    </div>`;
  };
  const un={};rows.forEach(r=>{const k=String(r.kw||'').trim();if(k&&!themeOfKw(k))un[k]=(un[k]||0)+1;});
  const unN=Object.values(un).reduce((a,b)=>a+b,0);
  host.innerHTML=`<div class="dash-sec-l">키워드 모니터링 <span class="dash-sec-s">${c.m}월 ${total}건 · 상위 10개</span></div>
    <div class="card">
      ${list.map(row).join('')}
      <div class="kb-foot">가운데 선 = 평소 수준 · 오른쪽 주황 = 늘어남, 왼쪽 파랑 = 줄어듦${bl.hasSeason
        ?` · 평소는 작년 ${c.m}월 기준(계절 보정)${bl.totalPct!=null?` · 전체 접수는 작년 대비 ${bl.totalPct>0?'+':''}${bl.totalPct}% — 아래 %는 그 영향을 뺀 값`:''}`
        :` · <b style="color:var(--amber)">작년 ${c.m}월 데이터가 부족해 최근 3개월 평균 기준 — 계절 보정 안 됨</b>`}
        ${unN?`<br>테마 미배정 ${unN}건 · ${Object.entries(un).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>esc(k)+' '+v).join(' · ')}`:''}</div>
    </div>`;
}

// 데이터 자체를 손봐야 하는 것들 — 경고와 성격이 달라 따로 모은다
// ===== 실무 전환 알림 =====
// 대회용(샘플)에서 실무용(실제 데이터)으로 넘어갈 때 놓치기 쉬운 설정을 화면이 직접 알려준다.
// 샘플을 보고 있을 때는 띄우지 않는다 — 실제 데이터를 올린 순간부터 뜬다.
// 항목을 끝내면(파일을 넣거나 설정을 바꾸면) 알림이 저절로 사라진다.
function setupReminders(){
  if(!DATA.length||isSampleMode())return [];
  const out=[];
  if(!SITE_LOCAL)out.push(`<b>단지명 목록 파일 없음</b> — <code>민원/js/site-tokens.local.js</code>를 민원 폴더 안 js 폴더에 넣으세요. 없으면 아파트·오피스텔 같은 단어 없이 브랜드명만 적힌 고객명이 단지로 자동 분류되지 않습니다. 파일은 깃허브에 없으니 사내에서 받으세요. <span class="setup-no">체크리스트 1</span>`);
  if(!RULES_REVIEWED)out.push(`<b>판정 기준값이 초기값</b> — 실제 데이터로 한 달 돌려본 뒤 <code>js/config.js</code>의 THEME_RULES를 조정하고, RULES_REVIEWED를 true로 바꾸세요. <span class="setup-no">체크리스트 3</span>`);
  if(/\.vercel\.app$/.test(location.hostname))out.push(`<b>공개 주소에서 실제 데이터 사용 중</b> — 데이터는 이 브라우저에만 있지만 화면 코드는 누구나 볼 수 있습니다. Vercel Deployment Protection을 All Deployments로 바꿨는지 확인하세요. <span class="setup-no">체크리스트 4</span>`);
  return out;
}

function renderDashTodo(){
  const host=document.getElementById('dashTodo');if(!host)return;
  const c=dashCtx(),y=c.y,mi=c.mi;
  const rows=c.rows;
  const items=[];
  if(IMPORT_NOTE)items.push(IMPORT_NOTE);
  if(rows.length){
    const sig=paBuildThemeSignals(rows,[],[],{minCount:THEME_RULES.minCount});
    const missing=LAGGING_KWS.filter(k=>!rows.some(r=>r.kw===k));
    if(missing.length)items.push(`<b>${esc(missing.join(' · '))}</b> 당월 미유입 — 0건을 감소로 해석하지 마십시오. 해당 데이터 수신 전이므로 집계가 확정되지 않았습니다.`);
    if(sig.unmappedKeywords.length)items.push(`테마 미배정 키워드 <b>${sig.unmappedKeywords.length}건</b> — 이슈 감지 대상에서 제외됩니다: ${sig.unmappedKeywords.slice(0,6).map(o=>`${esc(o.keyword)}(${o.count})`).join(' · ')}`);
  }
  if(rows.length){
    const open=rows.filter(paIsUnresolved);
    const asOfDay=paDayNum(`${c.y}-${String(c.mi+1).padStart(2,'0')}-${String(c.cut).padStart(2,'0')}`);
    const aged=open.filter(r=>{const d=paDayNum(r.date);return d!=null&&asOfDay!=null&&(asOfDay-d)>=7;});
    if(open.length)items.push(`처리내용 미입력 <b>${open.length}건</b> / 당월 ${rows.length}건`
      +(aged.length?` · 그중 <b>${aged.length}건</b>은 7일 이상 경과`:''));
  }
  const setup=setupReminders();
  host.innerHTML=`<div class="dash-sec-l">조치 필요 사항</div>`
    +(items.length?`<div class="card">${items.map(t=>`<div class="todo-row">${t}</div>`).join('')}</div>`
      :`<div class="card empty-card">조치 필요 사항 없음<span>미유입 · 테마 미배정 키워드 · 미처리 모두 정상</span></div>`)
    +(setup.length?`<div class="dash-sec-l" style="margin-top:18px">실무 전환 점검 <span class="dash-sec-s">끝낸 항목은 자동으로 사라집니다 · 전체 목록은 실무전환_체크리스트.md</span></div>
      <div class="card setup-card">${setup.map(t=>`<div class="todo-row">${t}</div>`).join('')}</div>`:'');
}

function siteAllListHtml(){
  const list=buildSiteAll();
  if(!list.length)return '';
  const c=dashCtx();
  const row=o=>{
    const etcPairs=Object.entries(o.by).filter(([w])=>!WHO_FIXED.includes(w)).sort((a,b)=>b[1]-a[1]);
    const etc=etcPairs.reduce((a,b)=>a+b[1],0);
    const kind=siteKindOf(o.site);
    return `<div class="site-row site-click" data-sitepop="${esc(o.site)}" role="button" tabindex="0">
      <span class="site-nm">${esc(o.site)}${kind!=='기타'?`<span class="site-kd">${esc(kind)}</span>`:''}</span>
      <span class="site-w">입주민 <b>${o.by['입주민']||0}</b></span>
      <span class="site-w">관리소 <b>${o.by['관리소']||0}</b></span>
      <span class="site-w"${etcPairs.length?` title="${esc(etcPairs.map(([w,n])=>w+' '+n).join(', '))}"`:''}>기타 <b>${etc}</b></span>
      <span class="site-tot">${o.count}건</span>
      <i class="row-line-go">›</i>
    </div>`;
  };
  const etcKinds=[...new Set(list.flatMap(o=>Object.keys(o.by)))].filter(w=>!WHO_FIXED.includes(w));
  return `<details class="site-all"><summary>건물별 전체 (${list.length}곳) · ${c.m}월</summary>
    <div class="site-head"><span class="site-nm">건물</span><span class="site-w">입주민</span><span class="site-w">관리소</span><span class="site-w">기타</span><span class="site-tot">합계</span></div>
    ${list.map(row).join('')}
    ${etcKinds.length?`<div class="note-line" style="margin:8px 2px 0">기타에 포함된 접수주체: ${esc(etcKinds.join(' · '))}</div>`:''}
  </details>`;
}

function renderSiteWatch(){
  const host=document.getElementById('siteWatch');if(!host)return;
  const list=buildSiteWatch();
  if(!list.length){
    const anyMapped=DATA.some(r=>siteOfRow(r));
    host.innerHTML=`<div class="dash-sec-l">단지별 다발 접수</div>`
      +`<div class="card empty-card">`
      +(anyMapped?`당월 ${SITE_WATCH.notice}건 이상 접수 단지 없음`
        :`단지로 지정된 고객명 없음<span>상단 '고객명 분류'에서 지정</span>`)
      +`</div>`;
    return;
  }
  host.innerHTML='<div class="dash-sec-l">단지별 다발 접수</div><div class="row-box">'+list.map(o=>{
    const alert=o.level==='alert';
    return `<div class="row-line site-click" data-sitepop="${esc(o.site)}" role="button" tabindex="0">
      <span class="row-tag" style="${alert?'color:var(--rose);background:var(--rose-soft)':'color:var(--chip-ink);background:var(--chip)'}">${alert?'주의':'관찰'}</span>
      <span class="row-line-name">${esc(o.site)}</span>
      <span class="row-line-meta">${[siteKindOf(o.site)!=='기타'?siteKindOf(o.site):'',o.office?`관리소 ${o.office}`:'',o.burst||''].filter(Boolean).join(' · ')}</span>
      <span class="row-line-num">${o.count}건</span>
      <i class="row-line-go">›</i>
    </div>
    <div class="row-line-kw">${o.kwList.map(k=>`<span class="fact-chip">${esc(k.keyword)} <b>${k.count}</b></span>`).join(' ')}</div>`;
  }).join('')+'</div>'
  +`<div class="note-line">당월 ${SITE_WATCH.notice}건 이상을 '관찰', ${SITE_WATCH.alert}건 이상을 '주의'로 표시합니다. 관리소 접수 건은 고객 단위 집계에서는 제외되나 단지 집계에는 포함됩니다.</div>`
  +siteAllListHtml();
}

// ===== 고객명 분류 화면 =====
function siteNameCounts(){
  const t={};
  DATA.forEach(r=>{
    if(r.route==='챗봇')return;            // 고객명이 채널 표시라 분류 대상 아님
    const n=String(r.name||'').trim();
    if(!n||isPlaceholderName(n))return;
    t[n]=(t[n]||0)+1;
  });
  return Object.entries(t).sort((a,b)=>b[1]-a[1]);
}

function renderSiteList(){
  const host=document.getElementById('siteList');if(!host)return;
  const map=siteMapLoad();
  const q=(document.getElementById('siteSearch').value||'').trim();
  const mode=document.getElementById('siteFilter').value;
  let rows=siteNameCounts();
  const total=rows.length,done=rows.filter(([n])=>map[n]).length;
  document.getElementById('siteStat').textContent=`전체 ${total}건 중 ${done}건 지정`;
  rows=rows.filter(([n])=>{
    if(q&&!n.includes(q))return false;
    const k=map[n]&&map[n].kind;
    if(mode==='todo')return !k;
    if(mode==='site')return k==='site';
    if(mode==='person')return k==='person';
    return true;
  }).slice(0,300);
  if(!rows.length){host.innerHTML='<div class="empty" style="padding:18px">해당 항목 없음</div>';return;}
  host.innerHTML=rows.map(([n,c])=>{
    const cur=map[n]&&map[n].kind, g=guessNameKind(n);
    const on=k=>cur===k?'background:var(--teal);color:#fff;border-color:var(--teal)':'';
    const guessTag=cur?'':`<span style="font-size:11px;color:var(--muted);margin-left:6px">추정: ${g==='site'?'단지':g==='person'?'개인':'모름'}</span>`;
    return `<div class="row-line" style="padding:9px 12px;border-bottom:1px solid var(--line-soft);flex-wrap:wrap">
      <span style="flex:1;min-width:140px;font-size:13px">${esc(n)} <span style="color:var(--muted);font-variant-numeric:tabular-nums">${c}건</span>${guessTag}</span>
      <button class="btn ghost" data-sk="site" data-n="${esc(n)}" style="font-size:11.5px;padding:4px 10px;${on('site')}">단지</button>
      <button class="btn ghost" data-sk="person" data-n="${esc(n)}" style="font-size:11.5px;padding:4px 10px;${on('person')}">개인</button>
      <input type="text" class="inp" data-alias="${esc(n)}" placeholder="대표명(선택)" value="${esc((map[n]&&map[n].alias)||'')}"
        style="width:130px;font-size:12px;padding:4px 8px;${cur==='site'?'':'display:none'}">
      <select class="inp" data-facility="${esc(n)}" style="width:110px;font-size:12px;padding:4px 6px;${cur==='site'?'':'display:none'}">
        <option value="">유형 자동(${esc(siteKindOf(n))})</option>
        ${SITE_KINDS.map(k=>`<option value="${esc(k)}"${(map[n]&&map[n].facility)===k?' selected':''}>${esc(k)}</option>`).join('')}
      </select>
    </div>`;
  }).join('');
  host.querySelectorAll('[data-sk]').forEach(b=>b.onclick=()=>{
    const m=siteMapLoad(),n=b.dataset.n;
    if(m[n]&&m[n].kind===b.dataset.sk)delete m[n];               // 다시 누르면 해제
    else m[n]={kind:b.dataset.sk,alias:(m[n]&&m[n].alias)||''};
    siteMapSave(m);renderSiteList();
  });
  host.querySelectorAll('[data-facility]').forEach(sel=>sel.onchange=()=>{
    const m=siteMapLoad(),n=sel.dataset.facility;
    if(!m[n])m[n]={kind:'site',alias:''};
    if(sel.value)m[n].facility=sel.value; else delete m[n].facility;
    siteMapSave(m);renderSiteList();
  });
  host.querySelectorAll('[data-alias]').forEach(inp=>inp.onchange=()=>{
    const m=siteMapLoad(),n=inp.dataset.alias;
    if(!m[n])m[n]={kind:'site',alias:''};
    m[n].alias=inp.value.trim();
    siteMapSave(m);
  });
}

// 이슈에 붙는 단지 내역 — 판정이 아니라 '어느 건물이었나'를 보여주는 용도
function siteBreakdownHtml(sites){
  if(!sites)return '';
  if(!sites.list.length){
    return sites.unknown?`<div style="font-size:12px;color:var(--muted);margin-top:6px">단지 지정 이름 없음 · 미분류 ${sites.unknown}건 — 고객명 분류 시 단지별 확인 가능</div>`:'';
  }
  const rows=sites.list.map(o=>`<span class="fact-chip">${esc(o.site)} <b>${o.count}</b></span>`).join(' ');
  const ps=sites.persons?`<span class="fact-chip" style="color:var(--muted)">개인 세대 ${sites.persons}</span>`:'';
  const un=sites.unknown?`<span class="fact-chip" style="color:var(--muted)">미분류 ${sites.unknown}</span>`:'';
  // 커버리지를 항상 같이 보여준다 — 쏠림 %만 보이면 작은 표본의 100%가 강한 신호처럼 읽힌다
  const cov=`<div style="font-size:11.5px;color:var(--muted);margin-top:4px">
    단지 확인 ${sites.identifiable}건 / 전체 ${sites.total}건 · 커버리지 ${sites.coverage}%`
    +(sites.reliable?'':` · <b style="color:#B2560F">참고용</b> — 단지 확인 건수가 적어 쏠림을 판정 근거에서 제외`)
    +`</div>`;
  return `<div style="margin-top:6px;font-size:12.5px;line-height:2">${rows} ${ps} ${un}</div>${cov}`;
}

function renderThemeAlerts(){
  const host=document.getElementById('themeAlerts');if(!host)return;
  const cards=[];
  let noPrev=false;

  // 기준 월 전체를 전월(월 중간이면 전월 동기)과 비교.
  // 데이터가 한 달치씩 들어오므로 '최근 10일' 창으로 보면 그 달 초·중순에 몰린 사안을
  // 영영 못 잡고, 창 안에 데이터가 없는 날은 화면이 통째로 비어버린다.
  // 10일 창은 판정 기준이 아니라 '그 달 안에서 언제 몰렸나'를 보여주는 근거로만 쓴다.
  const c=dashCtx(),ay=c.y,am=c.mi,aCut=c.cut;
  const monthComplete=c.mode==='end';
  const {rows:prevMonthRows}=dashPrevRows(c);
  const monthRows=c.rows;
  if(monthRows.length){
    const sig=paBuildThemeSignals(monthRows,prevMonthRows,paScanPeriodRawRows(ay-1,am),
      {minCount:THEME_RULES.minCount,monthKey:`${ay}-${String(am+1).padStart(2,'0')}`,
       inProgress:!monthComplete,cutDay:monthComplete?0:aCut,dim:c.dim});
    noPrev=!!sig.noPrev;
    sig.themes.forEach(t=>cards.push({t}));
  }

  let html='';
  // 강도 순으로 최대 3건
  const shown=cards.slice(0,3);
  const mk=dashMonthKey();
  const cardsHtml=shown.map(c=>{
    const t=c.t;
    // AI가 검증한 결과가 있으면 카드에 붙인다. '무관한 문의 겹침'이면 흐리게 — 판정은 JS가 했으니 지우지는 않는다.
    const rv=(typeof aiReviewFor==='function')?aiReviewFor(mk,t.theme):null;
    const off=rv&&rv.verdict==='무관한 문의 겹침';
    const g=t.grade||'급증';
    const tone=g==='감소'?'color:var(--chip-ink);background:var(--chip)'
      :g==='비중 확대'?'color:var(--down);background:var(--teal-soft)'
      :'color:var(--amber);background:var(--amber-soft)';
    // 판정 기준과 근거 2줄을 접지 않고 그대로 둔다 — 왜 떴는지가 바로 보여야 한다.
    return `<div class="stat-line${off?' ai-off':''}">
      <div class="stat-line-top">
        <span class="row-tag" style="${tone}">${g}</span>
        <span class="stat-line-nm">${esc(t.subject)}${t.streak>1?`<span class="streak">${t.streak}개월 연속</span>`:''}</span>
        <span class="stat-line-v">${t.count}건 <span class="row-delta">전월 ${t.prevCount} · ${t.diff>=0?'+':''}${t.diff}</span></span>
      </div>
      <div class="stat-line-b">${esc(t.gradeBasis||'')}${t.support.length?' · '+esc(t.support.slice(0,2).join(' · ')):''}</div>
      ${rv?`<div class="ai-line"><span class="ai-verdict ${off?'off':'on'}">AI · ${esc(rv.verdict)}</span>${esc(rv.title||'')}</div>`:''}
      ${rv&&rv.action?`<div class="ai-line ai-line-a"><b>조치</b>${esc(rv.action)}</div>`:''}
      ${t.sites&&t.sites.list.length?`<details class="row-more"><summary>단지별 내역</summary>${siteBreakdownHtml(t.sites)}</details>`:''}
    </div>`;
  }).join('');

  html+=`<div class="dash-sec-l">이슈 감지</div>`
    +`<div class="card">`
    +(noPrev?`<div class="empty-card" style="padding:0">전월 데이터가 없어 판정할 수 없습니다<span>이슈는 전월 대비로 판정하므로 전월 엑셀도 함께 업로드하십시오</span></div>`
      :cardsHtml?`<div class="stat-box">${cardsHtml}</div>`
      :`<div class="empty-card" style="padding:0">감지 기준 충족 이슈 없음<span>테마 ${THEME_RULES.minCount}건 이상 · 전월 대비 급증 / 비중 확대 / 큰 감소</span></div>`)
    +`</div>`;
  host.innerHTML=html;
}
