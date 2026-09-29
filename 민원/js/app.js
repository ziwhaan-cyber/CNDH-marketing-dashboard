// ===== 화면 연결 =====
function toast(msg){
  let t=document.getElementById('imToast');
  if(!t){t=document.createElement('div');t.id='imToast';t.className='toast';document.body.appendChild(t);}
  t.textContent=msg;t.classList.add('on');
  clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),1800);
}

function renderAsOfDate(){
  const el=document.getElementById('asOfDate');if(!el)return;
  const last=latestDataDate();
  el.textContent=last?fmt(last):'데이터 없음';
}

function renderAll(){
  const has=DATA.length>0;
  renderSourceBar();
  document.getElementById('emptyState').hidden=has;
  document.getElementById('dashBody').hidden=!has;
  renderAsOfDate();
  if(!has)return;
  buildDashMonthPicker();
  renderDashMode();
  renderDashNow();
  renderThemeAlerts();
  renderAiSection();
  renderSiteWatch();
  renderDashContent();
  renderDashTodo();
  saveSummary();
}

// 개요(첫 화면)에서 읽을 요약값만 저장한다. 접수 내용·고객명은 저장하지 않는다.
function saveSummary(){
  try{
    if(!DATA.length){localStorage.removeItem('voc_im_summary');return;}
    const c=dashCtx();
    const {rows:prevRows}=dashPrevRows(c);
    const sig=paBuildThemeSignals(c.rows,prevRows,paScanPeriodRawRows(c.y-1,c.mi),
      {minCount:THEME_RULES.minCount,monthKey:dashMonthKey(),
       inProgress:c.mode!=='end',cutDay:c.mode==='end'?0:c.cut,dim:c.dim});
    const issues=(sig.themes||[]).filter(t=>t.grade!=='감소');
    const open=c.rows.filter(paIsUnresolved);
    const last=latestDataDate();
    localStorage.setItem('voc_im_summary',JSON.stringify({
      at:Date.now(), source:getSource(), month:dashMonthKey(), mode:c.mode,
      count:c.rows.length, prevCount:prevRows.length,
      pct:prevRows.length?Math.round((c.rows.length-prevRows.length)/prevRows.length*1000)/10:null,
      issues:issues.length, topIssue:issues.length?`${issues[0].subject} ${issues[0].count}건`:'',
      unresolved:open.length, asOf:last?fmt(last):'',
      aged:(function(){const d=paDayNum(`${c.y}-${String(c.mi+1).padStart(2,'0')}-${String(c.cut).padStart(2,'0')}`);
        return open.filter(r=>{const x=paDayNum(r.date);return x!=null&&d!=null&&(d-x)>=7;}).length;})(),
      lagging:(sig.laggingMissing||[]).join(' · '),
      unmapped:(sig.unmappedKeywords||[]).length,
      sites:(function(){const w=buildSiteWatch();const a=w.filter(o=>o.level==='alert');
        return a.length?`${a[0].site} ${a[0].count}건`:'';})()
    }));
  }catch(e){}
}

// ----- 월 선택 · 월중/월말 전환 -----
document.getElementById('dashMonthPick').onchange=e=>{DASH_MONTH=e.target.value;DASH_MODE_OVERRIDE=null;renderAll();};
document.querySelectorAll('#dashModeSw [data-mode]').forEach(b=>b.onclick=()=>{DASH_MODE_OVERRIDE=b.dataset.mode;renderAll();});

// ----- 엑셀 업로드 -----
const fileInp=document.getElementById('xlFile');
document.querySelectorAll('[data-upload]').forEach(b=>b.onclick=()=>fileInp.click());
fileInp.onchange=()=>{const f=fileInp.files[0];fileInp.value='';if(f)importExcel(f);};
// 화면에 파일을 끌어다 놓아도 올라가게
document.addEventListener('dragover',e=>{e.preventDefault();document.body.classList.add('drag');});
document.addEventListener('dragleave',e=>{if(e.target===document.documentElement||!e.relatedTarget)document.body.classList.remove('drag');});
document.addEventListener('drop',e=>{
  e.preventDefault();document.body.classList.remove('drag');
  const f=e.dataTransfer.files[0];
  if(f&&/\.(xlsx|xls|xlsm|csv)$/i.test(f.name))importExcel(f);
});

// ----- 데이터 출처 -----
// 대시보드 데이터가 있으면 그걸 기본으로 쓰고, 직접 올린 엑셀·샘플로 바꿀 수 있게 한다
function renderSourceBar(){
  const bar=document.getElementById('sourceBar');if(!bar)return;
  const s=getSource(),info=sourceLabel();
  // 끼워 넣은 화면에서는 출처 줄을 숨긴다(대시보드 데이터 고정)
  if(isEmbedded()){bar.hidden=true;return;}
  const opts=[['link','대시보드 데이터',linkAvailable()],['own','직접 올린 엑셀',true]];
  bar.className='source-bar src-'+s;
  bar.innerHTML=`<span class="src-now"><b>${esc(info.name)}</b>${esc(info.desc)}</span>`
    +`<span class="src-sw">${opts.filter(o=>o[2]).map(([v,label])=>
      `<button class="btn ghost${v===s?' on':''}" data-src="${v}">${label}</button>`).join('')}</span>`;
  bar.querySelectorAll('[data-src]').forEach(b=>b.onclick=()=>{
    if(b.dataset.src===getSource())return;
    setSource(b.dataset.src);
    toast(sourceLabel().name+'로 바꿨습니다');
  });
  bar.hidden=false;
}
document.querySelectorAll('[data-sample]').forEach(b=>b.onclick=loadSample);

// ----- 데이터 삭제 -----
document.getElementById('clearBtn').onclick=()=>{
  if(getSource()!=='own'){
    alert(getSource()==='link'
      ? '대시보드 데이터는 여기서 지울 수 없습니다. 고객관리(민원) → 데이터 탭에서 관리하세요.'
      : '샘플 데이터는 위 출처 전환으로 끄면 됩니다.');
    return;
  }
  if(!DATA.length){toast('삭제할 데이터가 없습니다');return;}
  const months=[...new Set(DATA.map(r=>r.date.slice(0,7)))].sort();
  const pick=prompt(`삭제할 월을 입력하세요 (예: ${months[months.length-1]})\n전체 삭제는 '전체'\n\n보관 중인 월: ${months.join(', ')}`);
  if(!pick)return;
  const v=pick.trim();
  if(v==='전체'){
    if(!confirm(`저장된 ${DATA.length}건을 전부 삭제합니다.`))return;
    DATA=[];
  }else{
    if(!months.includes(v)){alert('해당 월 데이터가 없습니다.');return;}
    const n=DATA.filter(r=>r.date.slice(0,7)===v).length;
    if(!confirm(`${v} 데이터 ${n}건을 삭제합니다.`))return;
    DATA=DATA.filter(r=>r.date.slice(0,7)!==v);
  }
  saveData();DASH_MONTH=null;DASH_MODE_OVERRIDE=null;IMPORT_NOTE='';renderAll();toast('삭제했습니다');
};

// ----- 고객명 분류 -----
document.getElementById('siteBtn').onclick=()=>{
  document.getElementById('siteLocalNote').hidden=!!SITE_LOCAL||isSampleMode();
  document.getElementById('siteModal').classList.add('on');renderSiteList();
};
document.getElementById('siteCloseBtn').onclick=()=>{document.getElementById('siteModal').classList.remove('on');renderAll();};
document.getElementById('siteSearch').oninput=renderSiteList;
document.getElementById('siteFilter').onchange=renderSiteList;
document.getElementById('siteAutoBtn').onclick=()=>{
  if(!confirm('미지정 항목에 자동 추정값을 일괄 적용합니다.\n(추정 결과는 이 화면에서 개별 수정 가능합니다)'))return;
  const m=siteMapLoad();let n=0;
  siteNameCounts().forEach(([name])=>{
    if(m[name])return;
    const g=guessNameKind(name);
    if(g==='unknown')return;
    m[name]={kind:g,alias:''};n++;
  });
  siteMapSave(m);renderSiteList();toast(`${n}건에 추정값을 적용했습니다`);
};
// 분류 공유 — 단지(건물) 지정만 내보낸다. '개인' 지정은 실명이라 파일로 돌리지 않는다.
document.getElementById('siteExportBtn').onclick=()=>{
  const m=siteMapLoad(),out={};
  Object.entries(m).forEach(([k,v])=>{if(v&&v.kind==='site')out[k]=v;});
  if(!Object.keys(out).length){toast('내보낼 단지 지정이 없습니다');return;}
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,1)],{type:'application/json'}));
  a.download='단지분류.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};
document.getElementById('siteImportBtn').onclick=()=>document.getElementById('siteImportFile').click();
document.getElementById('siteImportFile').onchange=e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  f.text().then(t=>{
    const inc=JSON.parse(t),m=siteMapLoad();let n=0;
    Object.entries(inc).forEach(([k,v])=>{if(v&&v.kind==='site'&&!m[k]){m[k]=v;n++;}});   // 내가 이미 지정한 건 덮어쓰지 않는다
    siteMapSave(m);renderSiteList();toast(`${n}건을 가져왔습니다`);
  }).catch(()=>alert('파일 형식이 올바르지 않습니다.'));
};

// ----- 접수내용 팝업 -----
document.addEventListener('click',e=>{
  const sp=e.target.closest('[data-sitepop]');
  if(sp){openSiteMemoPopup(sp.dataset.sitepop);return;}
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'&&e.key!==' ')return;
  const sp=e.target.closest&&e.target.closest('[data-sitepop]');
  if(sp){e.preventDefault();openSiteMemoPopup(sp.dataset.sitepop);}
});
{
  const back=document.getElementById('memoPopup');
  back.addEventListener('click',e=>{if(e.target===back)closeMemoPopup();});
  document.getElementById('memoPopupClose').onclick=closeMemoPopup;
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(back.classList.contains('on'))closeMemoPopup();
    else document.getElementById('siteModal').classList.remove('on');
  });
}

applySource();   // 저장된 출처에 맞는 데이터를 싣고 화면을 그린다
