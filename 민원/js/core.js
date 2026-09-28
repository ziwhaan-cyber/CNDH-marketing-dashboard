// ===== 데이터 저장 · 공용 유틸 =====
// 데이터는 각자 브라우저(localStorage)에만 저장된다. 저장소(깃허브)에는 올라가지 않는다.
let DATA=load(LS.data,[]);

let IMPORT_NOTE='';

function saveData(){try{localStorage.setItem(LS.data,JSON.stringify(DATA));}catch(e){alert('저장 공간이 부족해 저장하지 못했습니다. 오래된 월을 삭제해 주세요.');}}

function load(k,f){try{const v=JSON.parse(localStorage.getItem(k));return v??f}catch(e){return f}}

function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

function fmt(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${dd}`;}

function fmtK(s){const[y,m,dd]=s.split('-');return `${+m}/${+dd}`;}

// 엑셀 날짜 칸은 화면에 똑같이 보여도 실제 값은 제각각이다.
// 시간이 붙거나, 0이 안 붙거나, 한국식 점 표기거나, 셀 서식만 날짜이고 값은 일련번호인 경우가 섞인다.
// 하나만 받으면 그런 행이 전부 '날짜 형식 오류'로 떨어지므로 흔한 표기를 모두 받아들인다.
function parseDate(s){
  if(s instanceof Date)return isNaN(s)?null:s;
  let t=String(s==null?'':s).trim();
  if(!t)return null;
  t=t.replace(/[（(].*?[）)]/g,'').trim();        // (월) 같은 요일 표기 제거
  t=t.replace(/\s*\d{1,2}:\d{2}(:\d{2})?(\s*[APap][Mm])?\s*$/,'').trim(); // 뒤에 붙은 시각 제거
  t=t.replace(/[.\/]/g,'-').replace(/\s+/g,'').replace(/-+$/,'');          // 2026. 8. 15 / 2026/08/15 → 2026-8-15
  let m=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(m){
    const d=new Date(+m[1],+m[2]-1,+m[3]);
    return (d.getFullYear()==+m[1]&&d.getMonth()==+m[2]-1&&d.getDate()==+m[3])?d:null;
  }
  m=t.match(/^(\d{4})(\d{2})(\d{2})$/);          // 20260815
  if(m){
    const d=new Date(+m[1],+m[2]-1,+m[3]);
    return (d.getMonth()==+m[2]-1&&d.getDate()==+m[3])?d:null;
  }
  // 엑셀 일련번호 (1900-01-01 기준, 1900 윤년 버그 보정 포함)
  if(/^\d{5}$/.test(t)){
    const n=+t;
    if(n>=20000&&n<=80000){
      const d=new Date(Date.UTC(1899,11,30)+n*86400000);
      return new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
    }
  }
  const d=new Date(t);
  return isNaN(d)?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());
}

function isPlaceholderName(name){
  const n=String(name||'').trim().toLowerCase().replace(/\s+/g,'');
  if(!n)return true;
  return PLACEHOLDER_NAMES.some(p=>p.toLowerCase().replace(/\s+/g,'')===n);
}

// 고객 단위(반복·재발·중복) 집계에 넣어도 되는 건인지.
// 제외 대상: ①고객명이 채널 표시인 건 ②접수경로가 챗봇인 건
// ③접수주체가 관리소인 건 — 관리소 명의로 여러 세대의 민원을 대신 접수하므로
//   서로 다른 고객의 건인데도 고객명이 관리소명 하나로 찍혀 중복·재발로 오인된다
function countsAsNamedCustomer(r){
  if(!r)return false;
  if(r.route==='챗봇')return false;
  if(r.a3==='관리소')return false;
  return !isPlaceholderName(r.name);
}

function daysInMonth(y,m){return new Date(y,m+1,0).getDate();}

function latestDataDate(){
  let max=null;
  DATA.forEach(r=>{const d=parseDate(r.date);if(d&&(!max||d>max))max=d;});
  return max;
}

// 선택된 월(예: 2026-06)에 해당하는 원본 레코드를 최대한 폭넓게 잡아냄
// — parseDate가 실패한 값도 날짜 문자열 접두어로 매칭해서 "날짜 오류"로 잡아내기 위함
function paScanPeriodRawRows(y,mi){
  const prefix=`${y}-${String(mi+1).padStart(2,'0')}`;
  return DATA.filter(r=>{
    const d=parseDate(r.date);
    if(d)return d.getFullYear()===y && d.getMonth()===mi;
    return typeof r.date==='string' && r.date.trim().startsWith(prefix);
  });
}

function paIsUnresolved(r){return !(r.done&&String(r.done).trim());}

function siteMapLoad(){try{return JSON.parse(localStorage.getItem(LS.site)||'{}');}catch(e){return {};}}

function siteMapSave(o){try{localStorage.setItem(LS.site,JSON.stringify(o));}catch(e){}}

function paDayNum(d){const x=parseDate(d);return x?Math.floor(x.getTime()/86400000):null;}

// 진행 중인 달은 아직 덜 쌓였으므로, 전월도 같은 일수까지만 잘라서 비교한다.
// 그러지 않으면 9월 5일에 "9월 3건 vs 8월 전체 20건"이 되어 급증이 영원히 안 잡힌다.
function paCutToDay(rows,cutDay){
  if(!cutDay)return rows;
  return rows.filter(r=>{const d=parseDate(r.date);return d&&d.getDate()<=cutDay;});
}

