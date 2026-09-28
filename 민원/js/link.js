// ===== 데이터 출처 =====
// 세 가지 중 하나를 쓴다.
//  link   — 지우안 대시보드의 '고객관리(민원) → 데이터' 탭에 올린 엑셀 (같은 주소라 그대로 읽힌다)
//  own    — 이 화면에서 직접 올린 엑셀 (voc_im_data)
//  sample — 시연용 가상 데이터 (저장하지 않고 열 때마다 만든다)
// 대시보드 데이터가 있으면 그걸 기본으로 쓴다. 실무에서 두 번 올리지 않게 하기 위함.
const SRC_LS='voc_im_source';
const LINK_KEY='r9_vocRawRows';   // 지우안 대시보드가 쓰는 저장 이름
// 대시보드가 저장하는 열 순서 (handleVocFile 참고)
const LINK_COLS=['date','name','memo','done','gubun','type','route','kw','a1','a2','a3','a4','bav'];

function linkRaw(){
  try{const v=JSON.parse(localStorage.getItem(LINK_KEY)||'null');return Array.isArray(v)?v:null;}catch(e){return null;}
}
function linkAvailable(){const v=linkRaw();return !!(v&&v.length);}
function linkRows(){
  const raw=linkRaw();if(!raw)return [];
  const rows=[];
  raw.forEach(a=>{
    if(!Array.isArray(a))return;
    const d=parseDate(a[0]);if(!d)return;
    const r={};LINK_COLS.forEach((f,i)=>r[f]=String(a[i]==null?'':a[i]).trim());
    r.date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    rows.push(r);
  });
  return rows.sort((x,y)=>x.date<y.date?-1:x.date>y.date?1:0);
}

function getSource(){
  let s=null;try{s=localStorage.getItem(SRC_LS);}catch(e){}
  if(s==='link'||s==='own'||s==='sample')return s;
  // 처음 열었을 때: 대시보드 데이터가 있으면 그것부터
  return linkAvailable()?'link':'own';
}
function setSource(s){
  try{localStorage.setItem(SRC_LS,s);}catch(e){}
  // 출처가 바뀌면 이전 출처로 돌린 AI 결과는 맞지 않으므로 비운다
  try{localStorage.removeItem('voc_im_aiResult');}catch(e){}
  applySource();
}
// 현재 출처에 맞는 데이터를 DATA에 채운다
function applySource(){
  const s=getSource();
  if(s==='link')DATA=linkRows();
  else if(s==='sample')DATA=buildSampleData();
  else DATA=load(LS.data,[]);
  DASH_MONTH=null;DASH_MODE_OVERRIDE=null;IMPORT_NOTE='';
  if(typeof renderAll==='function')renderAll();
}
function sourceLabel(){
  const s=getSource();
  if(s==='link')return{name:'대시보드 데이터',desc:'고객관리(민원) → 데이터 탭에 올린 엑셀을 그대로 씁니다. 그쪽에서 새로 올리면 이 화면도 바로 바뀝니다.'};
  if(s==='sample')return{name:'샘플 데이터',desc:'2025년 1월~2026년 9월 18일 가상 데이터입니다(9월은 진행 중인 달로 연출). 고객명은 가상 번호, 단지명은 지역명만 실제이고 이름은 지어낸 것입니다.'};
  return{name:'직접 올린 엑셀',desc:'이 화면에서 올린 엑셀을 씁니다. 이 브라우저에만 저장됩니다.'};
}

// 대시보드 쪽에서 엑셀을 새로 올리면 알려준다(같은 주소의 다른 창·프레임에서 저장하면 이 이벤트가 온다)
window.addEventListener('storage',e=>{
  if(e.key!==LINK_KEY)return;
  if(getSource()==='link'){applySource();toast('대시보드 데이터가 갱신되었습니다');}
  else if(linkAvailable())renderSourceBar();
});
