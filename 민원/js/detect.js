function themeOfKw(kw){return KW2THEME[String(kw||'').trim()]||null;}

function themeBranchOf(themeName,kw){
  const t=THEMES.find(x=>x.name===themeName);if(!t||!t.branches)return null;
  const hit=Object.entries(t.branches).find(([,ks])=>ks.includes(String(kw||'').trim()));
  return hit?hit[0]:null;
}

// 월 중간(진행 중)과 월말(확정)은 보는 목적이 다르다.
//  - 월 중간: 지금 대응할 수 있나 → 전월도 같은 일수까지 잘라 비교
//  - 월말   : 이번 달 뭐였나     → 전월 전체와 비교, 확정 숫자
// 기본은 데이터로 자동 판별하고, 어긋나면 토글로 덮어쓴다.
let DASH_MONTH=null;          // null이면 데이터가 있는 마지막 달

let DASH_MODE_OVERRIDE=null;  // 'mid' | 'end' | null(자동)

function dashMonthKey(){
  if(DASH_MONTH)return DASH_MONTH;
  const d=latestDataDate()||new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function dashCtx(){
  const [y,m]=dashMonthKey().split('-').map(Number),mi=m-1;
  const dim=daysInMonth(y,mi);
  const rows=paScanPeriodRawRows(y,mi);
  // 그 달에 실제로 입력된 마지막 날 (달력상 오늘이 아니라 데이터 기준)
  let cut=0;rows.forEach(r=>{const d=parseDate(r.date);if(d&&d.getDate()>cut)cut=d.getDate();});
  // 샘플을 볼 때는 '오늘'을 샘플 기준일로 고정한다(sample.js의 SAMPLE_TODAY 설명 참고)
  const today=(typeof isSampleMode==='function'&&isSampleMode())?new Date(SAMPLE_TODAY+'T00:00:00'):new Date();
  const isCurrentCalMonth=(today.getFullYear()===y&&today.getMonth()===mi);
  // 자동 판별: 지난 달이거나, 말일 근처(2일 이내)까지 찼으면 월말로 본다
  const autoEnd=(!isCurrentCalMonth)||(cut>=dim-2);
  const mode=DASH_MODE_OVERRIDE||(autoEnd?'end':'mid');
  return{y,mi,m,dim,rows,cut:cut||dim,mode,auto:autoEnd?'end':'mid',isCurrentCalMonth};
}

function dashPrevRows(c){
  let py=c.y,pm=c.mi-1;if(pm<0){pm=11;py--;}
  const prev=paScanPeriodRawRows(py,pm);
  return{rows:c.mode==='end'?prev:paCutToDay(prev,c.cut),py,pm};
}

function kwBaseline(c){
  // 올해 전체 증감률 — 작년 값을 올해 수준으로 끌어올릴 때 쓴다
  let ly=null,lyTotal=0;
  const lyKey=`${c.y-1}-${String(c.mi+1).padStart(2,'0')}`;
  if(lyKey>=KW_BASE_FROM){
    const rows=paScanPeriodRawRows(c.y-1,c.mi);
    if(rows.length){ly={};rows.forEach(r=>{if(r.kw)ly[r.kw]=(ly[r.kw]||0)+1;});lyTotal=rows.length;}
  }
  // 최근 3개월(기준 달 제외) 평균
  const rec={};let recMonths=0,recTotal=0;
  for(let k=1;k<=3;k++){
    let yy=c.y,mm=c.mi-k;while(mm<0){mm+=12;yy--;}
    const key=`${yy}-${String(mm+1).padStart(2,'0')}`;
    if(key<KW_BASE_FROM)continue;
    const rows=paScanPeriodRawRows(yy,mm);
    if(!rows.length)continue;
    recMonths++;recTotal+=rows.length;
    rows.forEach(r=>{if(r.kw)rec[r.kw]=(rec[r.kw]||0)+1;});
  }
  // 전체 증감률로 보정하면 '그 키워드만의 사정'이 드러나지만, 두 가지 함정이 있다.
  //  ① 작년 달 표본이 적으면 배율이 터무니없어진다 → 일정 건수 이상일 때만 기준으로 쓴다
  //  ② 전부 같이 움직인 달에는 모두 0%로 보여 큰 변화가 안 보인다 → 배율에 상하한을 둔다
  const LY_MIN=30;
  const usableLy=!!(ly&&lyTotal>=LY_MIN);
  let growth=(usableLy&&c.rows.length)?(c.rows.length/lyTotal):1;
  growth=Math.max(0.6,Math.min(1.6,growth));
  const totalPct=(ly&&lyTotal)?Math.round((c.rows.length-lyTotal)/lyTotal*100):null;
  return{
    totalPct,lyTotal,
    of(kw){
      if(usableLy){
        const v=(ly[kw]||0)*growth;
        if(v>=1)return{base:v,src:'작년 '+(c.mi+1)+'월',season:true};
      }
      if(recMonths){
        const v=(rec[kw]||0)/recMonths;
        if(v>=1)return{base:v,src:'최근 '+recMonths+'개월 평균',season:false};
      }
      return null;
    },
    hasSeason:usableLy
  };
}

function buildSiteWatch(){
  // 판정은 월 단위. 데이터가 한 달치씩 들어오므로 최근 10일만 보면 그 달 초·중순 집중을 놓친다.
  const c=dashCtx();
  const rows=c.rows;
  const periodLabel=`${c.m}월`;
  const t={};
  rows.forEach(r=>{
    const site=siteOfRow(r);if(!site)return;
    const o=t[site]||(t[site]={site,count:0,office:0,kws:{},last:'',days:[],by:{}});
    const who=String(r.a3||'').trim()||'미기재';
    o.by[who]=(o.by[who]||0)+1;
    o.count++;
    if(r.a3==='관리소')o.office++;
    if(r.kw)o.kws[r.kw]=(o.kws[r.kw]||0)+1;
    if(String(r.date||'')>o.last)o.last=String(r.date||'');
    const dn=paDayNum(r.date);if(dn!=null)o.days.push(dn);
  });
  return Object.values(t).filter(o=>o.count>=SITE_WATCH.notice)
    .sort((a,b)=>b.count-a.count)
    .map(o=>({...o,level:o.count>=SITE_WATCH.alert?'alert':'notice',period:periodLabel,
      burst:(()=>{  // 그 달 안에서 열흘 안에 몰린 구간이 있으면 근거로 붙인다
        const ds=o.days.slice().sort((x,y)=>x-y);let best=0,bi=0;
        for(let i=0;i<ds.length;i++){let c=0;for(let j=i;j<ds.length&&ds[j]<=ds[i]+SITE_WATCH.days-1;j++)c++;if(c>best){best=c;bi=i;}}
        if(best<SITE_WATCH.windowNotice||best<o.count*0.6)return null;
        const f=n=>{const d=new Date(n*86400000);return`${d.getMonth()+1}.${d.getDate()}`;};
        return `${f(ds[bi])}~${f(ds[Math.min(ds.length-1,bi+best-1)])} ${best}건 집중`;
      })(),
      kwList:Object.entries(o.kws).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>({keyword:k,count:v}))}));
}

function buildSiteAll(){
  const c=dashCtx();
  const t={};
  c.rows.forEach(r=>{
    const site=siteOfRow(r);if(!site)return;
    const o=t[site]||(t[site]={site,count:0,by:{}});
    o.count++;
    const who=String(r.a3||'').trim()||'미기재';
    o.by[who]=(o.by[who]||0)+1;
  });
  return Object.values(t).sort((a,b)=>b.count-a.count);
}

// '○○9차'처럼 이름만으로는 성격을 알 수 없는 수용가가 있어, 지정값을 토큰 추정보다 우선한다.
function siteKindOf(name){
  const m=siteMapLoad()[String(name||'').trim()];
  if(m&&m.facility)return m.facility;
  const n=String(name||'').replace(/\s+/g,'').toLowerCase();
  for(const [kind,ts] of SITE_KIND_RULES){
    if(ts.some(t=>n.includes(t.replace(/\s+/g,'').toLowerCase())))return kind;
  }
  return '기타';
}

// 자동 추정 — 확정값이 없을 때만 참고로 쓰는 값
function guessNameKind(name){
  const n=String(name||'').trim();
  if(!n)return 'unknown';
  const flat=n.replace(/\s+/g,'').toLowerCase();
  if(SITE_TOKENS.some(t=>flat.includes(t.replace(/\s+/g,'').toLowerCase())))return 'site';
  if(/\d\s*차(?![가-힣])|\d\s*단지/.test(n))return 'site';   // '○○9차' 처럼 브랜드 없이 차수만 붙는 경우
  if(/^[가-힣]{2,4}$/.test(n)&&!/동$|리$/.test(n))return 'person'; // 한국인 이름 형태
  if(/[*·]/.test(n)&&n.length<=5)return 'person';                  // 마스킹된 이름(홍*동)
  if(/^(고객|수용가)\s*[-#]?\s*[A-Za-z0-9-]{3,}$/.test(n))return 'person'; // 가명 번호(고객 0421) — 개인 세대로 본다
  // 길이만으로 단지라고 넘겨짚지 않는다. 근거 없이 단지로 잡으면 개인 세대 건이
  // 단지별 내역에 섞여 쏠림 판정까지 오염된다. 확신이 없으면 미분류로 남긴다.
  return 'unknown';
}

// 확정값 우선 → 없으면 추정. 별칭(alias)이 지정돼 있으면 대표 단지명으로 통일.
function siteOfRow(r){
  if(!r||r.route==='챗봇')return null; // 고객명이 채널 표시라 단지를 뽑을 수 없음
  if(r.site)return r.site;             // [v2] 담당자 PC에서 미리 뽑아 공유한 단지명
  const n=String(r.name||'').trim();
  if(!n)return null;
  const m=siteMapLoad()[n];
  if(m){return m.kind==='site'?(m.alias||n):null;}
  return guessNameKind(n)==='site'?n:null;
}

// 개인 세대 건과 '아직 분류 안 된 이름'은 다르다. 전자는 알고 있는 것이고 후자만 모르는 것이라,
// 둘을 합쳐 '미확인'으로 보여주면 분류를 다 해둔 뒤에도 미확인이 남은 것처럼 보인다.
function siteBreakdown(rows){
  const t={};let persons=0,unknown=0;
  const map=siteMapLoad();
  rows.forEach(r=>{
    const s=siteOfRow(r);
    if(s){t[s]=(t[s]||0)+1;return;}
    const n=String(r.name||'').trim();
    const kind=(map[n]&&map[n].kind)||null;
    if(kind==='person')persons++;                          // 확정된 개인 세대
    else if(r.route==='챗봇'||!n||isPlaceholderName(n))unknown++; // 고객명이 없거나 채널 표시
    else if(guessNameKind(n)==='person')persons++;         // 추정 개인
    else unknown++;
  });
  const list=Object.entries(t).sort((a,b)=>b[1]-a[1]).map(([site,count])=>({site,count}));
  const total=rows.length||1;
  // 쏠림 비율의 분모는 전체가 아니라 '단지를 알 수 있었던 건'이다.
  // 챗봇처럼 애초에 단지를 못 뽑는 건이 분모에 들어가면, 챗봇 비중이 큰 달에는
  // 한 단지에 아무리 몰려도 비율이 희석돼 쏠림이 구조적으로 안 잡힌다.
  const identifiable=Object.values(t).reduce((a,b)=>a+b,0)+persons;
  const base=identifiable||1;
  const top=list[0]||null;
  // 커버리지 — 전체 중 단지를 알 수 있었던 비율.
  // 챗봇은 접수내용에도 단지·동호수가 거의 없어 끝내 못 채우므로, 채우려 하지 말고 드러낸다.
  // 쏠림 %만 단독으로 보이면 '5건 중 5건 = 100%'가 강한 신호처럼 읽히는데 실제로는 전체의 15%다.
  const coverage=Math.round(identifiable/total*100);
  return{list,persons,unknown,total,identifiable,coverage,
    reliable:coverage>=SITE_COVERAGE_MIN,
    topSite:top?top.site:null,topCount:top?top.count:0,
    topShare:top?Math.round(top.count/base*100):0};
}

function paThemeTally(rows){
  const t={};
  rows.forEach(r=>{
    const th=themeOfKw(r.kw);if(!th)return;
    const o=t[th]||(t[th]={count:0,rows:[],kws:{},persons:new Set()});
    o.count++;o.rows.push(r);o.kws[r.kw]=(o.kws[r.kw]||0)+1;
    if(countsAsNamedCustomer(r)&&(r.name||'').trim())o.persons.add((r.name||'').trim());
  });
  return t;
}

// 테마 안에서 가장 건수가 몰린 windowDays 창을 찾아 반환
function paThemeWindow(rows){
  const days=rows.map(r=>paDayNum(r.date)).filter(v=>v!=null).sort((a,b)=>a-b);
  if(!days.length)return null;
  const W=THEME_RULES.windowDays;let best={count:0,from:null,to:null};
  for(let i=0;i<days.length;i++){
    const from=days[i],to=from+W-1;
    let c=0;for(let j=i;j<days.length&&days[j]<=to;j++)c++;
    if(c>best.count)best={count:c,from,to:days[Math.min(days.length-1,i+c-1)]};
  }
  const fmt=n=>{const d=new Date(n*86400000);return `${d.getMonth()+1}.${d.getDate()}`;};
  return{count:best.count,label:best.from!=null?`${fmt(best.from)}~${fmt(best.to)}`:'',fromDay:best.from,toDay:best.to};
}

// 왜 그 등급으로 판정했는지 — 등급마다 기준이 달라 문구도 따로 만든다
// minCount: 실제로 적용된 하한 — 월 중간에는 경과 일수만큼 낮춰 적용하므로 그 값을 그대로 보여준다
function themeGradeBasis(grade,t,minCount){
  const R=THEME_RULES;
  const mc=minCount||R.minCount;
  if(grade==='급증')return `기준 ${mc}건 이상${mc!==R.minCount?`(월 ${R.minCount}건을 경과 일수로 환산)`:''} + 전월 대비 +${R.surgeDiff}건 또는 +${R.surgePct}%`;
  if(grade==='비중 확대')return `기준 전체 대비 비중 +${R.shareDiff}%p 이상 (전체 감소 중에도 늘어난 경우)`;
  if(grade==='감소')return `기준 전월 대비 ${R.dropPct}% 이상 감소`;
  return '';
}

function paThemeSites(rows){
  const b=siteBreakdown(rows);
  return{list:b.list.slice(0,6),persons:b.persons,unknown:b.unknown,total:b.total,identifiable:b.identifiable,
    coverage:b.coverage,reliable:b.reliable,topSite:b.topSite,topCount:b.topCount,topShare:b.topShare,
    concentrated:b.topShare>=SITE_CONCENTRATION&&b.reliable};
}

// monthKey 직전 달부터 거슬러 올라가며 같은 테마가 연속으로 몇 달 떴는지.
// 저장된 기록이 아니라 데이터로 매번 다시 판정한다 — 기록 방식은 그 달 화면을 열어본 적이
// 있어야만 남아서, 업로드만 하고 안 본 달이 있으면 연속이 끊긴 것으로 잡힌다.
// 지난 달들은 월말 확정 기준(전월 전체 비교)으로 판정하고, 급증·비중 확대만 '떴다'로 센다.
function themeStreak(monthKey,name){
  if(!monthKey)return 0;
  let [y,m]=monthKey.split('-').map(Number),n=0;
  for(let i=0;i<12;i++){
    m--;if(m<1){m=12;y--;}
    const mi=m-1;
    const rows=paScanPeriodRawRows(y,mi);
    if(!rows.length)break;
    let py=y,pm=mi-1;if(pm<0){pm=11;py--;}
    const sig=paBuildThemeSignals(rows,paScanPeriodRawRows(py,pm),paScanPeriodRawRows(y-1,mi),{noStreak:true});
    const hit=sig.themes.find(t=>t.theme===name);
    if(hit&&(hit.grade==='급증'||hit.grade==='비중 확대'))n++;else break;
  }
  return n;
}

function paBuildThemeSignals(rawRows,prevRows,lyRows,opts){
  const o=opts||{};
  if(o.inProgress&&o.cutDay){prevRows=paCutToDay(prevRows,o.cutDay);lyRows=paCutToDay(lyRows||[],o.cutDay);}
  const cur=paThemeTally(rawRows),prev=paThemeTally(prevRows),ly=paThemeTally(lyRows||[]);
  const curTotal=rawRows.length,prevTotal=prevRows.length;
  // 옆팀이 한 달치를 통으로 올리는 항목 — 이번 달 0건이면 '감소'가 아니라 '아직 안 들어옴'
  const lagging=LAGGING_KWS.filter(k=>!rawRows.some(r=>r.kw===k));
  // 엑셀에 처음 보는 키워드가 들어오면 테마 매핑에 없다.
  // 그대로 두면 아무 경고 없이 감지 대상에서 빠지므로 따로 모아 알린다.
  const unmapped={};
  rawRows.forEach(r=>{
    const k=String(r.kw||'').trim();if(!k)return;
    if(themeOfKw(k)||THEME_COMPANION[k]||THEME_EXCLUDE.includes(k))return;
    unmapped[k]=(unmapped[k]||0)+1;
  });
  const unmappedList=Object.entries(unmapped).sort((a,b)=>b[1]-a[1]).map(([keyword,count])=>({keyword,count}));
  // 전월 데이터가 아예 없으면 모든 테마가 '0건 → N건'으로 급증 처리된다(첫 업로드 때 전부 뜸).
  // 비교 자체가 불가능한 상태이므로 판정하지 않고 그 사실만 알린다.
  if(!prevTotal)return{themes:[],noPrev:true,laggingMissing:lagging,unmappedKeywords:unmappedList,rules:THEME_RULES};
  let minCount=o.minCount||THEME_RULES.minCount;
  if(o.inProgress&&o.cutDay&&o.dim)minCount=Math.max(4,Math.round(minCount*o.cutDay/o.dim));
  const out=[];
  Object.entries(cur).forEach(([name,c])=>{
    const p=(prev[name]||{}).count||0,l=(ly[name]||{}).count||0;
    const diff=c.count-p;
    const pctChange=p?Math.round(diff/p*1000)/10:null;
    // 전체 접수가 줄어드는 달에는 어느 테마도 '건수 급증'이 될 수 없다.
    // 그런 달에도 비중이 커진 테마는 실제로 늘어난 것이므로 비중 변화를 함께 본다.
    // 감소 역시 봐야 할 신호라 별도 등급으로 잡는다(급증과 섞지 않음).
    const share=curTotal?c.count/curTotal*100:0;
    const prevShare=prevTotal?p/prevTotal*100:0;
    const shareDiff=Math.round((share-prevShare)*10)/10;
    const surged=(p===0&&c.count>=minCount)||diff>=THEME_RULES.surgeDiff||(pctChange!=null&&pctChange>=THEME_RULES.surgePct);
    const shareUp=shareDiff>=THEME_RULES.shareDiff;
    const dropped=(pctChange!=null&&pctChange<=-THEME_RULES.dropPct)&&p>=minCount;
    const grade=surged?'급증':shareUp?'비중 확대':dropped?'감소':null;
    if(c.count<minCount&&!dropped)return;
    if(!grade)return;
    const win=paThemeWindow(c.rows);
    const winShare=win?Math.round(win.count/c.count*100):0;
    const kwList=Object.entries(c.kws).sort((a,b)=>b[1]-a[1]);
    const branches={};
    kwList.forEach(([k,v])=>{const b=themeBranchOf(name,k);if(b)branches[b]=(branches[b]||0)+v;});
    const topBranch=Object.entries(branches).sort((a,b)=>b[1]-a[1])[0]||null;
    const yoyPct=l?Math.round((c.count-l)/l*1000)/10:null;
    const companions=Object.entries(THEME_COMPANION)
      .filter(([kw,themes])=>themes.includes(name))
      .map(([kw])=>({keyword:kw,count:rawRows.filter(r=>r.kw===kw).length}))
      .filter(x=>x.count>0);
    // 근거 — 축별로 한 줄씩. 하나만으로는 약하고, 여러 축이 같이 걸려야 사안으로 본다.
    const support=[];
    if(kwList.length>=2)support.push(`키워드 ${kwList.length}종에 분산`);
    if(c.persons.size>=THEME_RULES.minPersons)support.push(`서로 다른 고객 ${c.persons.size}명`);
    if(win&&winShare>=THEME_RULES.spikeShare&&win.count>=3)support.push(`${win.label}에 ${win.count}건 집중`);
    if(yoyPct!=null&&yoyPct>=THEME_RULES.yoyMargin)support.push(`작년 동월 ${l}건 → 계절 요인만으로는 설명 안 됨`);
    if(companions.length)support.push(companions.map(x=>`${x.keyword} ${x.count}건 동반`).join(' · '));
    // 단지 쏠림 — '고객은 여러 명인데 건물은 하나'인지가 대응 방법을 가른다.
    // 뭉쳐 있으면 그 단지 사안, 흩어져 있으면 전사 안내가 필요한 사안.
    const sites=siteBreakdown(c.rows);
    if(sites.topSite&&sites.topShare>=SITE_CONCENTRATION&&sites.reliable)
      support.push(`${sites.topSite} ${sites.topCount}건 — 단지 확인된 ${sites.identifiable}건 중 ${sites.topShare}% (커버리지 ${sites.coverage}%)`);
    // 몇 달째 이어지는 사안인지 — 단발 급증과 성격이 다르다
    // 급증·비중 확대일 때만 본다(감소가 몇 달째인지는 사안 판단에 의미가 없음)
    const streak=(o.noStreak||grade==='감소')?0:themeStreak(o.monthKey,name);
    if(streak>=1)support.push(`${streak+1}개월 연속 — 지난달에도 떴던 사안`);
    out.push({
      type:'테마',theme:name,grade,gradeBasis:themeGradeBasis(grade,name,minCount),share:Math.round(share*10)/10,shareDiff,
      subject:topBranch?`${name} (${topBranch[0]})`:name,
      count:c.count,prevCount:p,diff,pctChange,yoyCount:l,yoyPct,
      persons:c.persons.size,keywordSpread:kwList.length,
      keywords:kwList.slice(0,8).map(([k,v])=>({keyword:k,count:v})),
      branches:Object.entries(branches).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({branch:k,count:v})),
      window:win?{label:win.label,count:win.count,share:winShare}:null,
      sites:paThemeSites(c.rows),
      streak:streak+1,
      companions,support,
      basis:`전월 ${p}건 → 이번 ${c.count}건 (${diff>=0?'+':''}${diff}건)`
        +(grade==='비중 확대'?` · 비중 ${prevShare.toFixed(1)}% → ${share.toFixed(1)}% (전체는 감소)`:'')
        +(support.length?` · ${support.join(' · ')}`:''),
      strength:(grade==='급증'?1000:grade==='비중 확대'?500:0)+(support.length*10)+c.count
    });
  });
  out.sort((a,b)=>b.strength-a.strength);
  return{themes:out,laggingMissing:lagging,unmappedKeywords:unmappedList,rules:THEME_RULES};
}
