// ===== 엑셀 업로드 =====
// 제목행의 열 이름으로 찾아 매핑한다. 열 순서가 바뀌거나 중간에 열이 끼어도 동작하게 하기 위함.
// 제목행을 못 찾으면 기존 정제 양식 14열(해당월~에너지바우처구분) 순서로 읽는다.
const XL_HEADERS={
  date:['접수일','접수일자','접수날짜','날짜'],
  name:['고객명','수용가명','수용가','고객'],
  memo:['접수내용','문의내용','민원내용'],
  done:['처리내용','처리결과','답변내용'],
  gubun:['구분'],
  type:['유형'],
  route:['접수경로','인입경로','채널'],
  a1:['대표지역'],
  a2:['상세지역'],
  a3:['접수주체'],
  a4:['계약종별'],
  kw:['키워드'],
  bav:['에너지바우처구분','바우처구분']
};
const XL_POSITIONAL={date:1,name:2,memo:3,done:4,gubun:5,type:6,route:7,a1:8,a2:9,a3:10,a4:11,kw:12,bav:13};
const XL_REQUIRED=['date','kw'];   // 이 두 열이 없으면 판정 자체가 불가능

const normHead=s=>String(s==null?'':s).replace(/\s+/g,'').trim();

// 앞쪽 5줄 안에서 열 이름이 3개 이상 '통째로' 일치하는 줄을 제목행으로 본다.
// (데이터 값이 우연히 헤더 단어와 겹쳐 그 줄이 사라지는 일을 막기 위해 기준을 엄격하게 둔다)
function findHeaderMap(aoa){
  for(let i=0;i<Math.min(5,aoa.length);i++){
    const cells=(aoa[i]||[]).map(normHead);
    const map={};let hit=0;
    Object.entries(XL_HEADERS).forEach(([f,names])=>{
      const idx=cells.findIndex(c=>names.map(normHead).includes(c));
      if(idx>=0){map[f]=idx;hit++;}
    });
    if(hit>=3)return{row:i,map};
  }
  return null;
}

function ymdOf(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}

// 시트 하나 → 행 객체 배열
function rowsFromSheet(aoa){
  const head=findHeaderMap(aoa);
  const map=head?head.map:XL_POSITIONAL;
  const start=head?head.row+1:0;
  const missing=XL_REQUIRED.filter(f=>map[f]==null);
  if(missing.length)return{error:`필수 열 없음: ${missing.map(f=>XL_HEADERS[f][0]).join(', ')}`};
  const rows=[],skipped=[];
  for(let i=start;i<aoa.length;i++){
    const c=aoa[i]||[];
    if(c.every(v=>String(v==null?'':v).trim()===''))continue;   // 빈 줄
    const r={};
    Object.keys(XL_HEADERS).forEach(f=>{
      const v=map[f]!=null?c[map[f]]:'';
      r[f]=String(v==null?'':v).trim();
    });
    const rawDate=map.date!=null?c[map.date]:'';
    if(typeof rawDate==='number')r.date=String(Math.floor(rawDate));   // 날짜+시각 일련번호(46188.5) → 날짜만
    const d=parseDate(r.date);
    if(!d){skipped.push(i+1);continue;}                           // 엑셀 행 번호(1부터)
    r.date=ymdOf(d);
    rows.push(r);
  }
  return{rows,skipped,byHeader:!!head};
}

function readExcelFile(file){
  return new Promise((resolve,reject)=>{
    if(typeof XLSX==='undefined'){reject(new Error('엑셀 라이브러리(lib/xlsx.full.min.js)를 불러오지 못했습니다'));return;}
    const fr=new FileReader();
    fr.onerror=()=>reject(new Error('파일을 읽지 못했습니다'));
    fr.onload=()=>{
      try{
        // cellDates:false — 날짜를 일련번호로 받아 parseDate에서 처리한다.
        // Date 객체로 받으면 시간대 보정 때문에 하루씩 밀리는 경우가 있다.
        const wb=XLSX.read(new Uint8Array(fr.result),{type:'array',cellDates:false});
        // 제목행이 인식되는 첫 시트를 쓰고, 없으면 첫 시트를 14열 순서로 읽는다
        let pick=null;
        for(const name of wb.SheetNames){
          const aoa=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:''});
          if(findHeaderMap(aoa)){pick={name,aoa};break;}
        }
        if(!pick){const name=wb.SheetNames[0];pick={name,aoa:XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:''})};}
        resolve({sheet:pick.name,...rowsFromSheet(pick.aoa)});
      }catch(e){reject(e);}
    };
    fr.readAsArrayBuffer(file);
  });
}

// 반영 방식: 파일에 들어 있는 '월'은 기존 데이터를 통째로 교체하고, 나머지 월은 그대로 둔다.
// 한 달치를 몰아서 올리는 운영 방식이라, 같은 달을 다시 올려도 중복이 쌓이지 않게 하기 위함.
async function importExcel(file){
  let res;
  // 1만 건이 넘으면 읽는 데 몇 초 걸린다. 아무 반응이 없으면 멈춘 줄 알기 때문에 표시해 준다.
  toast('엑셀을 읽는 중…');
  await new Promise(r=>setTimeout(r,30));
  try{res=await readExcelFile(file);}
  catch(e){alert('업로드 실패 — '+(e.message||e));return;}
  if(res.error){alert(`업로드 실패 — ${res.error}\n\n제목행에 '접수일'과 '키워드' 열이 있어야 합니다. template 폴더의 양식을 참고하세요.`);return;}
  if(!res.rows.length){
    alert(res.byHeader?'읽을 수 있는 행이 없습니다. 접수일 형식을 확인하세요.'
      :'읽을 수 있는 행이 없습니다.\n제목행을 찾지 못했습니다 — 엑셀 파일이 맞는지, 접수일·키워드 열 이름이 있는지 확인하세요.');return;}
  // 연도 오타(2062-08-15 같은 값)가 섞이면 기준 월이 엉뚱한 해로 튄다. 지우지는 않고 알려만 준다.
  const todayY=new Date();const limit=new Date(todayY.getFullYear(),todayY.getMonth()+2,0);
  const future=res.rows.filter(r=>new Date(r.date+'T00:00:00')>limit);
  const ym=r=>r.date.slice(0,7);
  const months=[...new Set(res.rows.map(ym))].sort();
  const sample=isSampleMode();
  const oldCnt=sample?0:DATA.filter(r=>months.includes(ym(r))).length;
  const msg=[`시트: ${res.sheet}${res.byHeader?'':' (제목행 없음 → 14열 순서로 읽음)'}`,
    `읽은 행: ${res.rows.length}건`+(res.skipped.length?` · 접수일 인식 실패 ${res.skipped.length}건 제외`:''),
    `대상 월: ${months.join(', ')}`,
    '',
    ...(sample?['지금 보고 있는 샘플 데이터는 모두 지워지고, 올린 데이터로 바뀝니다. 진행할까요?']
      :[`위 월의 기존 데이터 ${oldCnt}건을 새 데이터 ${res.rows.length}건으로 교체합니다.`,'다른 월은 그대로 유지됩니다. 진행할까요?'])].join('\n');
  if(!confirm(msg))return;
  if(sample){DATA=[];setSampleMode(false);}
  DATA=DATA.filter(r=>!months.includes(ym(r))).concat(res.rows);
  DATA.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  saveData();
  IMPORT_NOTE=[
    res.skipped.length?`최근 업로드에서 접수일 인식 실패 <b>${res.skipped.length}건</b> 제외 — 엑셀 행 ${res.skipped.slice(0,10).join(', ')}${res.skipped.length>10?' 외':''}`:'',
    future.length?`접수일이 미래인 건 <b>${future.length}건</b> (${[...new Set(future.map(r=>r.date))].slice(0,3).join(', ')}${future.length>3?' 외':''}) — 연도 오타일 수 있습니다. 기준 월이 그 달로 잡힙니다.`:''
  ].filter(Boolean).join('<br>');
  DASH_MONTH=null;DASH_MODE_OVERRIDE=null;   // 방금 올린 데이터의 마지막 달로 이동
  renderAll();
  toast(`${months.length}개월 · ${res.rows.length}건 반영했습니다`);
}
