// 주택용 개발현황 · 고객관리(민원) 민원통계/데이터 — index.html 안에 있던 스크립트를 그대로 옮김
  // ===== [신규] 주택용 개발현황: 엑셀 업로드 -> 표 그대로 렌더링 (계산 없이 원본 그대로) =====
  function renderHouseholdDevFromRows(rows){
    if (!rows.length) throw new Error('데이터가 없습니다');
    var tbody = document.getElementById('hd-table-body');
    var html = '';
    var rowCount = 0;
    for (var r=1; r<rows.length; r++){
      var row = rows[r];
      if (!row || row[0] === null || row[0] === undefined || row[0] === '') continue;
      var isTotal = String(row[0]).indexOf('합계') !== -1;
      html += '<tr' + (isTotal ? ' class="hd-total"' : '') + '><td>' + row[0] + '</td>';
      for (var c=1; c<row.length; c++){
        var v = row[c];
        html += '<td>' + (v === null || v === undefined || v === '' ? '-' : Number(v).toLocaleString('ko-KR')) + '</td>';
      }
      html += '</tr>';
      rowCount++;
    }
    if (rowCount === 0) throw new Error('유효한 데이터 행이 없습니다');
    tbody.innerHTML = html;
    document.getElementById('hd-status-tag').textContent = '업로드됨';
    return rowCount;
  }

  function handleHouseholdDevFile(evt){
    var file = evt.target.files[0];
    if (!file) return;
    var statusEl = document.getElementById('hd-status');
    statusEl.textContent = '처리 중...';
    statusEl.className = 'upload-status';

    var reader = new FileReader();
    reader.onload = function(e){
      try{
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, {type:'array'});
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null});
        var rowCount = renderHouseholdDevFromRows(rows);
        statusEl.textContent = rowCount.toLocaleString('ko-KR')+'행 반영완료';
        statusEl.className = 'upload-status ok';
        lsSave('householdDevRows', rows);
      }catch(err){
        statusEl.textContent = '오류: '+err.message;
        statusEl.className = 'upload-status';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // ===== [공용] 미납 엑셀 월 컬럼 헤더 해석 =====
  // "7월" -> {year:null, month:7} / "26.7월", "2026.7월", "26-07월", "26년 7월" -> {year:2026, month:7}
  function arrParseMonthHeader(c){
    var m = /^(?:(\d{2}|\d{4})\s*(?:[.\-\/]|년)\s*)?(\d{1,2})\s*월$/.exec(String(c===null||c===undefined?'':c).trim());
    if (!m) return null;
    var mo = Number(m[2]);
    if (mo < 1 || mo > 12) return null;
    var y = m[1] ? Number(m[1]) : null;
    if (y !== null && y < 100) y += 2000;
    return {year:y, month:mo};
  }
  // 연체 현황 기준일: 엑셀에서 가장 최근 미납월의 "다음 달 말일" (예: 26.7월 -> 2026. 8. 31.)
  // 연도 없는 옛 양식은 첫 월 컬럼(가장 최근 월)을 쓰고, 연도는 시트명(예: "26.4월") 또는 오늘 날짜로 추정
  function arrBaseDateFromSheet(ws, sheetName){
    var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null, raw:true});
    var h = -1;
    for (var i=0; i<Math.min(rows.length, 10); i++){
      if (rows[i] && rows[i].some(function(c){ return String(c===null?'':c).trim() === '연체개월'; })){ h = i; break; }
    }
    if (h === -1) return null;
    var cols = [];
    rows[h].forEach(function(c){ var p = arrParseMonthHeader(c); if (p) cols.push(p); });
    if (!cols.length) return null;
    var y, mo;
    var withYear = cols.filter(function(p){ return p.year !== null; });
    if (withYear.length){
      withYear.sort(function(a,b){ return (b.year*12+b.month) - (a.year*12+a.month); });
      y = withYear[0].year; mo = withYear[0].month;
    } else {
      mo = cols[0].month;
      var ref = /(\d{2}|\d{4})\s*\.\s*(\d{1,2})\s*월/.exec(sheetName||'');
      var ry, rm;
      if (ref){ ry = Number(ref[1]); if (ry < 100) ry += 2000; rm = Number(ref[2]); }
      else { var t = new Date(); ry = t.getFullYear(); rm = t.getMonth()+1; }
      y = (mo > rm) ? ry-1 : ry;
    }
    var last = new Date(y, mo+1, 0); // mo(1~12)의 다음 달 말일
    return last.getFullYear()+'. '+(last.getMonth()+1)+'. '+last.getDate()+'.';
  }

  // ===== [신규] 고객관리(연체) 페이지: 엑셀 업로드 -> 자동 집계 =====
  function renderArrearsFromRows(rows, ymd){
    // 연체개월 -> {count, amount} 집계
    const byMonth = {};
    let shortCount=0, shortAmt=0, midCount=0, midAmt=0, longCount=0, longAmt=0;
    let totalCount=0, totalAmt=0;

    rows.forEach(function(r){
      const month = Number(r['연체개월']);
      const amt = Number(r['합계']) || 0;
      if (!month) return;
      if (!byMonth[month]) byMonth[month] = {count:0, amount:0};
      byMonth[month].count += 1;
      byMonth[month].amount += amt;
      totalCount += 1;
      totalAmt += amt;

      if (month >= 1 && month <= 2){ shortCount++; shortAmt += amt; }
      else if (month >= 3 && month <= 5){ midCount++; midAmt += amt; }
      else if (month >= 6){ longCount++; longAmt += amt; }
    });

    // 표 렌더링 (연체개월 오름차순)
    const months = Object.keys(byMonth).map(Number).sort(function(a,b){return a-b;});
    let html = '';
    months.forEach(function(m){
      html += '<tr><td>'+m+'</td><td>'+byMonth[m].count+'</td><td>'+byMonth[m].amount.toLocaleString()+'</td></tr>';
    });
    document.getElementById('arr-table-body').innerHTML = html;
    document.getElementById('arr-total-count').textContent = totalCount.toLocaleString();
    document.getElementById('arr-total-amount').textContent = totalAmt.toLocaleString();

    // 단기/중기/장기 박스 업데이트 (금액은 억원 단위, 소수 1자리)
    document.getElementById('fc-short-count').textContent = shortCount + ' 개소';
    document.getElementById('fc-short-amt').textContent = (shortAmt/100000000).toFixed(1) + ' 억원';
    document.getElementById('fc-mid-count').textContent = midCount + ' 개소';
    document.getElementById('fc-mid-amt').textContent = (midAmt/100000000).toFixed(1) + ' 억원';
    document.getElementById('fc-long-count').textContent = longCount + ' 개소';
    document.getElementById('fc-long-amt').textContent = (longAmt/100000000).toFixed(1) + ' 억원';

    // 기준일 태그: 업로드 시점(최초 저장된 ymd) 기준으로 표시
    document.getElementById('arr-date-tag').textContent = ymd+' 기준';
  }

  function handleArrearsFile(evt){
    const file = evt.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById('arr-status');
    statusEl.textContent = '';
    statusEl.classList.remove('ok');

    const reader = new FileReader();
    reader.onload = function(e){
      try{
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {defval:null});

        // 기준일 = 가장 최근 미납월의 다음 달 말일 (예: 26.7월 -> 2026. 8. 31.)
        const ymd = arrBaseDateFromSheet(ws, wb.SheetNames[0]);
        if (!ymd) throw new Error("'26.7월' 같은 월 컬럼을 찾을 수 없어 기준일을 정할 수 없습니다");
        renderArrearsFromRows(rows, ymd);
        lsSave('arrearsRows', rows);
        lsSave('arrearsYmd', ymd);
      }catch(err){
        statusEl.textContent = '업로드 오류: '+err.message;
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // ===== [신규] 관리현황 마크다운 미리보기 (- 항목, "  - " 하위항목, **굵게**) =====
  function mdToHtml(text){
    const lines = text.split('\n');
    let html = '';
    lines.forEach(function(line){
      if (!line.trim()) return;
      const bold = function(s){ return s.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>'); };
      const subMatch = line.match(/^\s{2,}-\s+(.*)/);
      const topMatch = line.match(/^-\s+(.*)/);
      if (subMatch){
        html += '<div class="sub">○ '+bold(subMatch[1])+'</div>';
      } else if (topMatch){
        html += '<div>• '+bold(topMatch[1])+'</div>';
      } else {
        html += '<div>'+bold(line)+'</div>';
      }
    });
    return html;
  }
  function renderMd(key){
    const ta = document.getElementById('md-'+key);
    const preview = document.getElementById('md-'+key+'-preview');
    preview.innerHTML = mdToHtml(ta.value) || '<div style="color:var(--text-soft);">클릭해서 입력하세요</div>';
  }
  // [신규] textarea가 입력 내용에 맞춰 세로로 자동으로 늘어나도록
  function autoGrowMd(key){
    var ta = document.getElementById('md-'+key);
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }
  // [신규] 미리보기 클릭 -> 편집모드(textarea 표시), textarea 벗어나면 -> 미리보기로 전환
  function showEdit(key){
    document.getElementById('md-'+key).style.display = 'block';
    document.getElementById('md-'+key+'-preview').style.display = 'none';
    document.getElementById('md-'+key).focus();
    autoGrowMd(key);
  }
  // [신규] 마크다운 입력칸(key)의 현재 값을 localStorage에 저장 — 새로고침해도 유지되도록
  function saveMdData(key){
    var ta = document.getElementById('md-'+key);
    if (!ta) return;
    var all = lsLoad('mdData', {});
    all[key] = ta.value;
    lsSave('mdData', all);
  }
  function showPreview(key){
    renderMd(key);
    document.getElementById('md-'+key).style.display = 'none';
    document.getElementById('md-'+key+'-preview').style.display = 'block';
    saveMdData(key);
  }
  // 페이지 로드시: localStorage에 저장된 값이 있으면 textarea에 채운 뒤 미리보기 렌더링
  var MD_KEYS = ['short','mid','long','voc-note-a','voc-note-b','voc-note-c'];
  (function restoreMdData(){
    var saved = lsLoad('mdData', {});
    MD_KEYS.forEach(function(key){
      if (saved[key] !== undefined){
        var ta = document.getElementById('md-'+key);
        if (ta) ta.value = saved[key];
      }
    });
  })();
  MD_KEYS.forEach(renderMd);
  // [신규] 편집 중 입력할 때마다 textarea 높이를 내용에 맞게 자동으로 늘려줌
  MD_KEYS.forEach(function(key){
    var ta = document.getElementById('md-'+key);
    if (ta) ta.addEventListener('input', function(){ autoGrowMd(key); });
  });

  // ===== [신규] 고객관리(영업) 페이지: "건" 앞 숫자만 입력 가능하도록 필터링 =====
  function salesNumFilter(el){
    var digits = el.textContent.replace(/[^0-9]/g, '');
    if (!digits) digits = '0';
    digits = digits.replace(/^0+(?=\d)/, ''); // 앞자리 불필요한 0 제거
    if (el.textContent !== digits){
      el.textContent = digits;
      // 커서를 맨 끝으로 이동
      var range = document.createRange();
      var sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    saveSalesNum(el);
  }
  // [신규] 고객관리(영업) 건수 입력값을 localStorage에 저장 — 창을 닫아도 유지되도록
  var SALES_NUM_KEYS = ['sales-num-1','sales-num-2','sales-num-3','sales-num-4','sales-num-5'];
  function saveSalesNum(el){
    if (!el || !el.id) return;
    var all = lsLoad('salesNumData', {});
    all[el.id] = el.textContent;
    lsSave('salesNumData', all);
  }
  // 페이지 로드시: localStorage에 저장된 건수 값이 있으면 복원
  (function restoreSalesNum(){
    var saved = lsLoad('salesNumData', {});
    SALES_NUM_KEYS.forEach(function(key){
      if (saved[key] !== undefined){
        var el = document.getElementById(key);
        if (el) el.textContent = saved[key];
      }
    });
  })();


  // ===== [신규] 고객관리(민원) 페이지: VOC_최종본의 실제 접수 데이터 전체를 기반으로 모든 통계를 실시간 계산 =====
  // 필드 순서: [접수일, 고객명, 접수내용, 처리내용, 구분, 유형, 접수경로, 키워드, 대표지역, 상세지역, 접수주체, 계약종별, 에너지바우처구분, 해당월(접수일의 연-월만 추출)]
  var VOC_FULL = []; // 내장 스냅샷 제거 — 데이터는 엑셀 업로드로만 채워짐

  // [추가] 끼워 넣은 화면은 그 탭을 처음 열 때만 불러온다(첫 로딩을 늦추지 않기 위함)
  function loadEmbedFrame(id){
    var f=document.getElementById(id);
    if(f&&f.getAttribute('src')==='about:blank'){
      var src=f.getAttribute('data-src');
      if(DEMO) src+=(src.indexOf('?')<0?'?':'&')+'demo=1';   // [v2] 시연 모드는 끼워 넣은 화면에도 넘긴다
      f.setAttribute('src',src);
    }
    fitEmbed(id);
  }
  // [추가] 끼워 넣은 화면은 글자 크기가 고정(px)이라 큰 모니터에서 혼자 작아 보인다.
  // 이 대시보드는 화면 너비(vw)에 맞춰 커지므로, 같은 비율로 배율을 맞춘다.
  function fitEmbed(id){
    var f=document.getElementById(id);
    if(!f)return;
    var apply=function(){
      try{
        var d=f.contentDocument; if(!d||!d.documentElement)return;
        var z=Math.min(1.45,Math.max(0.85,f.clientWidth/1600));
        d.documentElement.style.zoom=z;
        // 공통 테마를 끼워 넣은 화면에도 적용한다(그쪽 파일은 수정하지 않는다)
        if(d.head&&!d.getElementById('sharedTheme')){
          var l=d.createElement('link');
          l.id='sharedTheme'; l.rel='stylesheet';
          l.href=new URL('theme.css',location.href).href;
          d.head.appendChild(l);
        }
      }catch(e){}
    };
    f.addEventListener('load',apply);
    apply();
    if(!window.__fitBound){ window.__fitBound=true;
      window.addEventListener('resize',function(){ ['overdue-frame','voc-monitor-frame'].forEach(fitEmbed); }); }
  }
  function loadMonitorFrame(){ loadEmbedFrame('voc-monitor-frame'); }

  function showVocTab(btn){
    var target = btn.getAttribute('data-voc-tab');
    document.querySelectorAll('#page-voc .subnav-btn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    document.querySelectorAll('#page-voc .voc-tab').forEach(function(t){ t.classList.remove('active'); });
    document.getElementById(target).classList.add('active');
  }

  // ===== 아래 함수들은 VOC_최종본.html의 실제 로직을 그대로 이식한 것 (재구현 아님) =====
  // 필드 매핑은 VOC_최종본의 COL_ORDER/PASTE_MAP과 동일: date,name,memo,done,gubun,type,route,kw
  var DATA = [];
  function parseDate(s){ var d = new Date(s+'T00:00:00'); return isNaN(d) ? null : d; }
  // [신규] 숫자 천단위 콤마 포맷 (민원 페이지 전체 숫자 표시에 사용)
  function numFmt(n){ var x = Number(n); return isNaN(x) ? n : x.toLocaleString('ko-KR'); }
  function matchFilter(r,F){ return !F || Object.keys(F).every(function(a){ return !F[a] || r[a]===F[a]; }); }
  function topN(byKw,n,prevKw){
    var arr = Object.entries(byKw).map(function(kv){ return {k:kv[0], v:kv[1]}; });
    arr.sort(function(a,b){ return b.v-a.v; });
    var max = arr.length ? arr[0].v : 1;
    return arr.slice(0,n).map(function(o){ return Object.assign({}, o, {prev:(prevKw&&prevKw[o.k])||0, max:max}); });
  }
  // 증감률이 너무 커지면 "약 N배" 표기로 전환 (VOC_최종본과 동일 로직)
  function fmtChangeDisplay(cur,prev){
    if (prev===0) return cur>0 ? {cls:'up',txt:'신규'} : {cls:'flat',txt:'—'};
    var pct=(cur-prev)/prev*100;
    var cls = pct>0?'up':pct<0?'down':'flat';
    if (Math.abs(pct)>=100){ var ratio=cur/prev; return {cls:cls, txt:(pct>0?'▲':'▼')+'약 '+ratio.toFixed(1)+'배'}; }
    var p=Math.round(pct);
    if (p>0) return {cls:'up', txt:'▲'+p+'%'};
    if (p<0) return {cls:'down', txt:'▼'+Math.abs(p)+'%'};
    return {cls:'flat', txt:'0%'};
  }
  function moKey(y,mi){ return y+'-'+String(mi+1).padStart(2,'0'); }
  // 월 단위 집계는 접수일이 아닌 "해당월"(접수일에서 연-월만 추출한 값) 기준으로 그룹핑한다.
  function monthTotal(y,mi,F){
    var key = moKey(y,mi), n=0;
    DATA.forEach(function(r){ if(r.haedangwol!==key) return; if(F&&!matchFilter(r,F)) return; n++; });
    return n;
  }
  function monthByKw(y,mi,F){
    var key = moKey(y,mi), byKw={};
    DATA.forEach(function(r){ if(r.haedangwol!==key) return; if(F&&!matchFilter(r,F)) return; byKw[r.kw]=(byKw[r.kw]||0)+1; });
    return byKw;
  }
  function monthRouteCount(y,mi,F,route){
    var key = moKey(y,mi), n=0;
    DATA.forEach(function(r){ if(r.haedangwol!==key) return; if(F&&!matchFilter(r,F)) return; if(r.route===route) n++; });
    return n;
  }
  function monthRouteByKw(y,mi,F,route){
    var key = moKey(y,mi), byKw={};
    DATA.forEach(function(r){ if(r.haedangwol!==key) return; if(F&&!matchFilter(r,F)) return; if(r.route!==route) return; byKw[r.kw]=(byKw[r.kw]||0)+1; });
    return byKw;
  }
  function monthBotCount(y,mi,F){ return monthRouteCount(y,mi,F,'챗봇'); }
  function monthBotByKw(y,mi,F){ return monthRouteByKw(y,mi,F,'챗봇'); }
  function allDataMonths(){
    var set={};
    DATA.forEach(function(r){ if(r.haedangwol) set[r.haedangwol]=true; });
    return Object.keys(set).sort();
  }
  // ===== 이식 끝 =====

  // ===== [신규] 민원통계 탭 계산/렌더 로직 =====
  function monthFieldCount(y,mi,field,value){
    var key = moKey(y,mi), n=0;
    DATA.forEach(function(r){ if(r.haedangwol!==key) return; if(r[field]!==value) return; n++; });
    return n;
  }
  function cumFieldCount(field,value){
    var n=0; DATA.forEach(function(r){ if(r[field]===value) n++; });
    return n;
  }
  function monthTwoFieldCount(y,mi,f1,v1,f2,v2){
    var key = moKey(y,mi), n=0;
    DATA.forEach(function(r){ if(r.haedangwol!==key) return; if(r[f1]!==v1) return; if(r[f2]!==v2) return; n++; });
    return n;
  }
  function recentMonths(n){
    var keys = allDataMonths();
    var sliced = keys.slice(Math.max(0, keys.length-n));
    return sliced.map(function(k){
      return { y:parseInt(k.slice(0,4),10), mi:parseInt(k.slice(5,7),10)-1, key:k, label:parseInt(k.slice(5,7),10)+'월' };
    });
  }

  function vocRenderSummaryTab(y,mi,py,pm){
    document.getElementById('voc-sum-period-tag').textContent = y+'년 '+(mi+1)+'월 기준';
    var totCur = monthTotal(y,mi,null), totPrev = monthTotal(py,pm,null), totalCum = DATA.length;

    // ---- 1. 민원접수 현황 (접수방법 필드 기준: 통화매니저·수기·챗봇·메일·공문) ----
    var METHODS = ['통화매니저','수기','챗봇','메일','공문'];
    var methodRows = METHODS.map(function(mt){
      return { label:mt, cur:monthFieldCount(y,mi,'method',mt), prev:monthFieldCount(py,pm,'method',mt), cum:cumFieldCount('method',mt) };
    });
    var methodNamedCum = methodRows.reduce(function(s,o){ return s+o.cum; },0);
    var methodEtcCur = totCur - methodRows.reduce(function(s,o){ return s+o.cur; },0);
    var methodEtcPrev = totPrev - methodRows.reduce(function(s,o){ return s+o.prev; },0);
    var methodEtcCum = totalCum - methodNamedCum;
    if (methodEtcCum > 0) methodRows.push({ label:'미분류', cur:methodEtcCur, prev:methodEtcPrev, cum:methodEtcCum });
    var chanBody = methodRows.map(function(o){
      var pct = totalCum ? (o.cum/totalCum*100).toFixed(0) : 0;
      return '<tr><td>'+o.label+'</td><td class="num">'+numFmt(o.cur)+'</td><td class="num">'+numFmt(o.prev)+'</td><td class="num">'+numFmt(o.cum)+'</td><td class="num">'+pct+'%</td></tr>';
    }).join('');
    chanBody += '<tr class="total-row"><td>합계</td><td class="num">'+numFmt(totCur)+'</td><td class="num">'+numFmt(totPrev)+'</td><td class="num">'+numFmt(totalCum)+'</td><td class="num">100%</td></tr>';
    document.getElementById('voc-sum-channel-body').innerHTML = chanBody;

    // ---- 2-a. 민원분류: 유형별 (당월/전월/누적) ----
    var TYPES = ['일반','제도','요금','설비','교육','온도'];
    document.getElementById('voc-sum-type-body').innerHTML = TYPES.map(function(t){
      return '<tr><td>'+t+'</td><td class="num">'+numFmt(monthFieldCount(y,mi,'type',t))+'</td><td class="num">'+numFmt(monthFieldCount(py,pm,'type',t))+'</td><td class="num">'+numFmt(cumFieldCount('type',t))+'</td></tr>';
    }).join('');
    var typeNoteEl = document.getElementById('voc-sum-type-note');
    if (typeNoteEl) typeNoteEl.textContent = '※ 일반민원 중 에너지바우처 ' + numFmt(monthTwoFieldCount(y,mi,'type','일반','kw','에너지바우처')) + '건';

    // ---- 2-b. 지역별 (당월/전월/누적) ----
    var incheonN = monthFieldCount(y,mi,'region1','인천'), gimpoN = monthFieldCount(y,mi,'region1','김포');
    var incheonP = monthFieldCount(py,pm,'region1','인천'), gimpoP = monthFieldCount(py,pm,'region1','김포');
    var incheonC = cumFieldCount('region1','인천'), gimpoC = cumFieldCount('region1','김포');
    var regionRows = [
      {k:'인천', cur:incheonN, prev:incheonP, cum:incheonC},
      {k:'김포', cur:gimpoN, prev:gimpoP, cum:gimpoC},
      {k:'기타', cur:Math.max(0,totCur-incheonN-gimpoN), prev:Math.max(0,totPrev-incheonP-gimpoP), cum:Math.max(0,totalCum-incheonC-gimpoC)}
    ];
    document.getElementById('voc-sum-region-body').innerHTML = regionRows.map(function(o){
      return '<tr><td>'+o.k+'</td><td class="num">'+numFmt(o.cur)+'</td><td class="num">'+numFmt(o.prev)+'</td><td class="num">'+numFmt(o.cum)+'</td></tr>';
    }).join('') + '<tr class="total-row"><td>합계</td><td class="num">'+numFmt(totCur)+'</td><td class="num">'+numFmt(totPrev)+'</td><td class="num">'+numFmt(totalCum)+'</td></tr>';

    // ---- 2-c. 고객유형별 (당월/전월/누적, 계약종별은 당월 기준 소단위 보조텍스트로 표기) ----
    var CONTRACTS = ['주택용','업무용','공공용','기타'];
    var curKey2 = moKey(y,mi);
    function contractSubText(matchFn){
      return CONTRACTS.map(function(ct){
        var n = 0;
        DATA.forEach(function(r){ if(r.haedangwol===curKey2 && matchFn(r) && r.contract===ct) n++; });
        return ct+' '+numFmt(n);
      }).join(' · ');
    }
    var mgmtCur = monthFieldCount(y,mi,'subject','관리소'), mgmtPrev = monthFieldCount(py,pm,'subject','관리소'), mgmtCum = cumFieldCount('subject','관리소');
    var residCur = monthFieldCount(y,mi,'subject','입주민'), residPrev = monthFieldCount(py,pm,'subject','입주민'), residCum = cumFieldCount('subject','입주민');
    var etcCur = Math.max(0,totCur-mgmtCur-residCur), etcPrev = Math.max(0,totPrev-mgmtPrev-residPrev), etcCum = Math.max(0,totalCum-mgmtCum-residCum);
    var subjBodyHtml =
      '<tr><td>관리소<div style="font-size:0.62vw; color:var(--text-soft); font-weight:400; margin-top:0.05vw; line-height:1.3;">'+contractSubText(function(r){return r.subject==='관리소';})+'</div></td>'+
        '<td class="num">'+numFmt(mgmtCur)+'</td><td class="num">'+numFmt(mgmtPrev)+'</td><td class="num">'+numFmt(mgmtCum)+'</td></tr>'+
      '<tr><td>입주민<div style="font-size:0.62vw; color:var(--text-soft); font-weight:400; margin-top:0.05vw; line-height:1.3;">'+contractSubText(function(r){return r.subject==='입주민';})+'</div></td>'+
        '<td class="num">'+numFmt(residCur)+'</td><td class="num">'+numFmt(residPrev)+'</td><td class="num">'+numFmt(residCum)+'</td></tr>'+
      '<tr><td>기타<div style="font-size:0.62vw; color:var(--text-soft); font-weight:400; margin-top:0.05vw; line-height:1.3;">'+contractSubText(function(r){return r.subject!=='관리소' && r.subject!=='입주민';})+'</div></td>'+
        '<td class="num">'+numFmt(etcCur)+'</td><td class="num">'+numFmt(etcPrev)+'</td><td class="num">'+numFmt(etcCum)+'</td></tr>';
    subjBodyHtml += '<tr class="total-row"><td>합계</td><td class="num">'+numFmt(totCur)+'</td><td class="num">'+numFmt(totPrev)+'</td><td class="num">'+numFmt(totalCum)+'</td></tr>';
    document.getElementById('voc-sum-subject-body').innerHTML = subjBodyHtml;

    // ---- 2-d. 키워드별 (당월 상위 8개 기준, 전월/누적 함께) ----
    var curKwAll = monthByKw(y,mi,null), prevKwAll = monthByKw(py,pm,null);
    var topKwList = topN(curKwAll,8);
    document.getElementById('voc-sum-kw-body').innerHTML = topKwList.map(function(o){
      return '<tr><td>'+o.k+'</td><td class="num">'+numFmt(o.v)+'</td><td class="num">'+numFmt(prevKwAll[o.k]||0)+'</td><td class="num">'+numFmt(cumFieldCount('kw',o.k))+'</td></tr>';
    }).join('') || '<tr><td colspan="4" style="color:var(--text-soft);">데이터 없음</td></tr>';

    // ---- 3-a. 월별 에너지바우처 민원 추이 (최근 12개월, 전체 vs 에너지바우처 키워드) ----
    var months12 = recentMonths(12);
    document.getElementById('voc-sum-trend-tag').textContent = months12.length+'개월';
    document.getElementById('voc-sum-trend-head').innerHTML = '<th>구분</th>' + months12.map(function(m){ return '<th>'+m.label+'</th>'; }).join('');
    var trendTotals = months12.map(function(m){ return monthTotal(m.y,m.mi,null); });
    var trendVouch = months12.map(function(m){ var kwm = monthByKw(m.y,m.mi,null); return kwm['에너지바우처']||0; });
    var trendPct = trendTotals.map(function(v,i){ return v? (trendVouch[i]/v*100).toFixed(0)+'%' : '0%'; });
    var trendBody = '<tr><td style="font-weight:700;">전체</td>' + trendTotals.map(function(v){ return '<td class="num">'+numFmt(v)+'</td>'; }).join('') + '</tr>';
    trendBody += '<tr><td style="font-weight:700; color:var(--rust);">에너지바우처</td>' + trendVouch.map(function(v){ return '<td class="num">'+numFmt(v)+'</td>'; }).join('') + '</tr>';
    trendBody += '<tr><td style="color:var(--text-soft);">비중</td>' + trendPct.map(function(v){ return '<td class="num" style="color:var(--text-soft);">'+v+'</td>'; }).join('') + '</tr>';
    document.getElementById('voc-sum-trend-body').innerHTML = trendBody;
    vocTrendChartData = months12.map(function(m, i){
      return { label:m.label, v:trendTotals[i], ly:monthTotal(m.y-1, m.mi, null) };
    });
    drawVocTrendChart();

    // ---- 3-b. 에너지바우처 문의유형 비교 (최근 12개월) ----
    document.getElementById('voc-sum-vtype-tag').textContent = months12.length+'개월';
    var VOUCH_CATS = ['등록방법','대상자','금액','오류','고객번호','기본','사용법','방법'];
    document.getElementById('voc-sum-vtype-head').innerHTML = '<th>구분</th>' + months12.map(function(m){ return '<th>'+m.label+'</th>'; }).join('');
    var vBody = VOUCH_CATS.map(function(cat){
      var cells = months12.map(function(m){ return '<td class="num">'+numFmt(monthFieldCount(m.y,m.mi,'voucher',cat))+'</td>'; }).join('');
      return '<tr><td>'+cat+'</td>'+cells+'</tr>';
    }).join('');
    var etcCells = months12.map(function(m){
      var key2 = moKey(m.y,m.mi), n=0;
      DATA.forEach(function(r){ if(r.haedangwol!==key2) return; if(!r.voucher) return; if(VOUCH_CATS.indexOf(r.voucher)!==-1) return; n++; });
      return '<td class="num">'+numFmt(n)+'</td>';
    }).join('');
    vBody += '<tr><td>기타</td>'+etcCells+'</tr>';
    var sumCells = months12.map(function(m){
      var key2 = moKey(m.y,m.mi), n=0;
      DATA.forEach(function(r){ if(r.haedangwol!==key2) return; if(!r.voucher) return; n++; });
      return '<td class="num">'+numFmt(n)+'</td>';
    }).join('');
    vBody += '<tr class="total-row"><td>합계</td>'+sumCells+'</tr>';
    document.getElementById('voc-sum-vtype-body').innerHTML = vBody;
  }

  // ===== [v2 추가] 월별 민원 추이 차트 =====
  // 칸 크기에 맞춰 그린다(글자가 늘어나지 않게). 탭이 처음 보이거나 창 크기가 바뀌면 다시 그린다.
  var vocTrendChartData = [], vocTrendPartialDay = 0;
  function drawVocTrendChart(){
    var box = document.getElementById('voc-trend-chart');
    if (!box || !vocTrendChartData.length) return;
    var W = box.clientWidth, H = box.clientHeight;
    if (W < 50 || H < 50) return;                     // 숨겨진 탭 — 보일 때 다시 그린다
    var cs = getComputedStyle(document.documentElement);
    var acc = (cs.getPropertyValue('--ui-accent')||'#236B7A').trim();
    var line = (cs.getPropertyValue('--ui-line')||'#DDE2E8').trim();
    var muted = (cs.getPropertyValue('--ui-muted')||'#6B7787').trim();
    var fs = Math.max(11, Math.round(W/80));          // 칸 너비에 맞춘 글자 크기
    var pts = vocTrendChartData, n = pts.length;
    var L = fs*3, R = fs*1.2, T = fs*1.8, B = fs*2;
    var all = pts.map(function(p){return p.v;}).concat(pts.map(function(p){return p.ly;}));
    var max = Math.max.apply(null, all.concat([1]));
    var step = Math.pow(10, Math.floor(Math.log10(max))) / 2; if (max/step > 6) step *= 2;
    var top = Math.ceil(max*1.1/step)*step;
    var x = function(i){ return L + (n===1 ? (W-L-R)/2 : i*(W-L-R)/(n-1)); };
    var y = function(v){ return T + (1 - v/top)*(H-T-B); };
    var s = '';
    for (var g=0; g<=top+0.001; g+=step){
      s += '<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(g)+'" y2="'+y(g)+'" stroke="'+line+'" stroke-width="1"'+(g? ' stroke-dasharray="2 3"':'')+'/>'
        +  '<text x="'+(L-fs*0.6)+'" y="'+(y(g)+fs*0.35)+'" font-size="'+(fs*0.85)+'" fill="'+muted+'" text-anchor="end">'+numFmt(g)+'</text>';
    }
    pts.forEach(function(p,i){ s += '<text x="'+x(i)+'" y="'+(H-fs*0.5)+'" font-size="'+(fs*0.9)+'" fill="'+muted+'" text-anchor="middle">'+p.label+'</text>'; });
    var path = function(key, upto){ return pts.slice(0, upto).map(function(p,i){ return (i?'L':'M')+x(i).toFixed(1)+','+y(p[key]).toFixed(1); }).join(''); };
    // 전년 같은 달은 데이터가 있는 달만 잇는다(자료가 없는 달을 0으로 그리지 않게)
    var lyD = '', pen = false;
    pts.forEach(function(p,i){
      if (p.ly>0){ lyD += (pen?'L':'M')+x(i).toFixed(1)+','+y(p.ly).toFixed(1); pen = true; } else pen = false;
    });
    if (lyD) s += '<path d="'+lyD+'" fill="none" stroke="#A9B4C0" stroke-width="1.6" stroke-dasharray="4 4"/>';
    var solidTo = vocTrendPartialDay ? n-1 : n;       // 진행 중인 달은 점선으로 이어 '확정 전'임을 보인다
    s += '<defs><linearGradient id="vtg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="'+acc+'" stop-opacity=".18"/><stop offset="1" stop-color="'+acc+'" stop-opacity="0"/></linearGradient></defs>';
    s += '<path d="'+path('v', solidTo)+' L'+x(solidTo-1)+','+y(0)+' L'+x(0)+','+y(0)+' Z" fill="url(#vtg)"/>';
    s += '<path d="'+path('v', solidTo)+'" fill="none" stroke="'+acc+'" stroke-width="2.4" stroke-linejoin="round"/>';
    if (vocTrendPartialDay && n>1) s += '<path d="M'+x(n-2)+','+y(pts[n-2].v)+'L'+x(n-1)+','+y(pts[n-1].v)+'" fill="none" stroke="'+acc+'" stroke-width="2" stroke-dasharray="4 3"/>';
    var peak = 0; pts.forEach(function(p,i){ if (p.v > pts[peak].v) peak = i; });
    pts.forEach(function(p,i){
      var last = (i===n-1);
      s += '<circle cx="'+x(i)+'" cy="'+y(p.v)+'" r="'+(last||i===peak? fs*0.36 : fs*0.26)+'" fill="'+(last&&vocTrendPartialDay?'#fff':(i===peak||last?acc:'#fff'))+'" stroke="'+acc+'" stroke-width="2"/>';
      if (i===peak || last){
        var lbl = numFmt(p.v) + (last&&vocTrendPartialDay ? ' · 1~'+vocTrendPartialDay+'일' : '');
        // 진행 중인 마지막 달은 선 아래에 적어 점선과 겹치지 않게
        var ly2 = (last&&vocTrendPartialDay) ? y(p.v)+fs*1.6 : y(p.v)-fs*0.8;
        s += '<text x="'+(last?x(i)-fs*0.3:x(i))+'" y="'+ly2+'" font-size="'+(fs*0.95)+'" font-weight="700" fill="'+acc+'" text-anchor="'+(last?'end':'middle')+'">'+lbl+'</text>';
      }
    });
    box.innerHTML = '<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" style="font-family:inherit">'+s+'</svg>';
  }
  if (window.ResizeObserver){
    document.addEventListener('DOMContentLoaded', function(){
      var el = document.getElementById('voc-trend-chart');
      if (el) new ResizeObserver(function(){ drawVocTrendChart(); }).observe(el);
    });
  }

  function vocPopulateFilterOptions(){
    function distinct(field){
      var set={}; DATA.forEach(function(r){ if(r[field]) set[r[field]]=true; });
      return Object.keys(set).sort(function(a,b){ return a.localeCompare(b,'ko'); });
    }
    function fill(selId, defaultLabel, values){
      var sel = document.getElementById(selId);
      if (!sel) return;
      var cur = sel.value;
      sel.innerHTML = '<option value="">'+defaultLabel+'</option>' +
        values.map(function(v){ return '<option value="'+v+'">'+v+'</option>'; }).join('');
      if (values.indexOf(cur)!==-1) sel.value = cur;
    }
    fill('voc-f-channel', '접수경로: 전체', distinct('route'));
    fill('voc-f-category', '구분: 전체', distinct('gubun'));
    fill('voc-f-type', '유형: 전체', distinct('type'));
    fill('voc-f-region1', '대표지역: 전체', distinct('region1'));
    fill('voc-f-region2', '상세지역: 전체', distinct('region2'));
    fill('voc-f-subject', '접수주체: 전체', distinct('subject'));
    fill('voc-f-contract', '계약종별: 전체', distinct('contract'));
    fill('voc-f-voucher', '바우처구분: 전체', distinct('voucher'));
    fill('voc-f-month', '해당월: 전체', distinct('haedangwol').reverse());
  }

  function vocResetFilters(){
    ['voc-f-channel','voc-f-category','voc-f-type','voc-f-region1','voc-f-region2','voc-f-subject','voc-f-contract','voc-f-voucher','voc-f-month'].forEach(function(id){
      var el = document.getElementById(id); if (el) el.value = '';
    });
    var kwEl = document.getElementById('voc-f-keyword'); if (kwEl) kwEl.value = '';
    vocApplyFilter();
  }

  function vocRunAll(rawRows){
    DATA = rawRows.map(function(r){
      return { date:r[0], name:r[1], memo:r[2], done:r[3], gubun:r[4], type:r[5], route:r[6], kw:r[7],
        region1:r[8], region2:r[9], subject:r[10], contract:r[11], voucher:r[12], haedangwol:r[13], method:r[14] };
    });
    vocPopulateFilterOptions();

    var monthKeys = allDataMonths();
    var latestKey = monthKeys[monthKeys.length-1];
    var y = parseInt(latestKey.slice(0,4),10), mi = parseInt(latestKey.slice(5,7),10)-1;
    var py=y, pm=mi-1; if (pm<0){ pm=11; py--; }
    var lyKey = (y-1)+'-'+String(mi+1).padStart(2,'0');

    // ---- KPI (monthTotal 그대로 사용) ----
    var curN = monthTotal(y,mi,null), prevN = monthTotal(py,pm,null);
    // [v2] 최신월이 아직 진행 중이면(말일 2일 전까지 안 찼으면) 전월도 같은 날짜까지만 세어 비교한다.
    //      이슈 모니터링 화면과 같은 기준 — 월 중간 값을 전월 전체와 비교해 '감소'로 보이는 것을 막는다.
    var cutDay = 0;
    DATA.forEach(function(r){ if(r.haedangwol!==latestKey) return; var dd=parseInt(String(r.date).slice(8,10),10); if(dd>cutDay) cutDay=dd; });
    var dimCur = new Date(y, mi+1, 0).getDate();
    var partial = cutDay>0 && cutDay < dimCur-2;
    var prevKeyK = moKey(py,pm);
    if (partial){
      prevN = 0;
      DATA.forEach(function(r){ if(r.haedangwol===prevKeyK && parseInt(String(r.date).slice(8,10),10)<=cutDay) prevN++; });
    }
    var rangeTxt = partial ? ' 1~'+cutDay+'일' : ' 전체';
    vocTrendPartialDay = partial ? cutDay : 0;
    document.getElementById('voc-kpi-cur').innerHTML = numFmt(curN) + '<span class="unit">건</span>';
    document.getElementById('voc-kpi-cur-label').textContent = y+'년 '+(mi+1)+'월'+rangeTxt;
    document.getElementById('voc-kpi-prev').innerHTML = numFmt(prevN) + '<span class="unit">건</span>';
    document.getElementById('voc-kpi-prev-label').textContent = py+'년 '+(pm+1)+'월'+rangeTxt+(partial?' (같은 기간)':'');
    var deltaEl = document.getElementById('voc-kpi-delta');
    if (!prevN){ deltaEl.textContent='-'; }
    else { var d0=fmtChangeDisplay(curN,prevN); deltaEl.textContent=d0.txt; deltaEl.className='rate-badge '+(d0.cls==='up'?'bad':d0.cls==='down'?'good':'dim'); }

    // ---- 최근 12개월 월별 총량 (연간 키워드별 민원 건수 집계에 사용) ----
    var trendPts=[];
    var ty=y, tm=mi;
    for (var i=0;i<12;i++){ trendPts.unshift({y:ty,m:tm,total:monthTotal(ty,tm,null)}); tm--; if(tm<0){tm=11; ty--;} }

    // ---- 유선/챗봇 주요 키워드 (당월): monthRouteByKw + topN ----
    document.getElementById('voc-kw-channel-tag').textContent = y+'년 '+(mi+1)+'월';
    var wireByKw = monthRouteByKw(y,mi,null,'유선'), botByKw = monthRouteByKw(y,mi,null,'챗봇');
    var wireN = monthRouteCount(y,mi,null,'유선'), botN = monthBotCount(y,mi,null);
    document.getElementById('voc-kw-wire-title').textContent = '유선 ('+numFmt(wireN)+'건)';
    document.getElementById('voc-kw-bot-title').textContent = '챗봇 ('+numFmt(botN)+'건)';
    function kwRowsHtml(byKw){
      return topN(byKw,5).map(function(o,i){ return '<tr><td><span class="kw-rank">'+(i+1)+'</span>'+o.k+'</td><td class="num">'+numFmt(o.v)+'</td></tr>'; }).join('')
        || '<tr><td colspan="2" style="color:var(--text-soft);">데이터 없음</td></tr>';
    }
    document.getElementById('voc-kw-wire-body').innerHTML = kwRowsHtml(wireByKw);
    document.getElementById('voc-kw-bot-body').innerHTML = kwRowsHtml(botByKw);

    // ---- 챗봇 · 유선 채널 현황: 두 채널만 순수 비교 (현장/메일/팩스 등 제외) ----
    var routes = ['챗봇','유선'];
    function chanBoxHtml(yy,mm){
      var counts = routes.map(function(rt){ return {rt:rt, n:monthRouteCount(yy,mm,null,rt)}; });
      var tot = counts.reduce(function(s,o){ return s+o.n; }, 0);
      counts = counts.filter(function(o){ return o.n>0; }).sort(function(a,b){ return b.n-a.n; });
      if (!counts.length) return '<div class="cb-row"><span>데이터 없음</span></div>';
      return counts.map(function(o,i){
        var pct = tot? (o.n/tot*100).toFixed(1) : '0.0';
        return '<div class="cb-row"><span>'+o.rt+'</span>'+(i===0?'<b>':'')+numFmt(o.n)+'건 ('+pct+'%)'+(i===0?'</b>':'')+'</div>';
      }).join('');
    }
    document.getElementById('voc-ch-cur-title').textContent = y+'년 '+(mi+1)+'월 (당월)';
    document.getElementById('voc-ch-ly-title').textContent = (y-1)+'년 '+(mi+1)+'월 (전년동월)';
    document.getElementById('voc-ch-cur-body').innerHTML = chanBoxHtml(y,mi);
    document.getElementById('voc-ch-ly-body').innerHTML = chanBoxHtml(y-1,mi);
    var lyBotN = monthBotCount(y-1,mi,null), lyTotal = monthTotal(y-1,mi,null);
    var noteEl = document.getElementById('voc-ch-note');
    if (lyBotN===0 && botN>0){
      noteEl.textContent = '※ 챗봇 채널은 전년동월엔 없었으며, 1년 새 당월 접수의 '+(curN?(botN/curN*100).toFixed(0):0)+'%를 차지하는 채널로 성장';
    } else if (!lyTotal){
      noteEl.textContent = '※ 전년동월 데이터가 없어 비교할 수 없습니다.';
    } else {
      var bd = fmtChangeDisplay(botN, lyBotN);
      noteEl.textContent = '※ 챗봇 접수 '+bd.txt+' (전년동월 대비)';
    }

    // ---- 상위 키워드 5: monthByKw + topN (키워드/건수/비율만 표시) ----
    var curByKw = monthByKw(y,mi,null);
    document.getElementById('voc-top5-body').innerHTML = topN(curByKw,5).map(function(o,i){
      var pct = curN? (o.v/curN*100).toFixed(1) : '0.0';
      return '<tr><td><span class="kw-rank">'+(i+1)+'</span>'+o.k+'</td><td class="num">'+numFmt(o.v)+'</td><td class="num">'+pct+'%</td></tr>';
    }).join('');

    // ---- 키워드 이슈 분석: 전월 대비 변동폭 TOP5 (monthByKw 그대로 사용) ----
    var prevByKw = monthByKw(py,pm,null);
    var allK = {}; Object.keys(curByKw).forEach(function(k){allK[k]=1;}); Object.keys(prevByKw).forEach(function(k){allK[k]=1;});
    var diffs = Object.keys(allK).map(function(k){ var c=curByKw[k]||0,p=prevByKw[k]||0; return {k:k,c:c,p:p,d:c-p}; })
      .sort(function(a,b){ return Math.abs(b.d)-Math.abs(a.d); }).slice(0,5);
    document.getElementById('voc-issue-body').innerHTML = diffs.map(function(item,i){
      return '<div class="issue-row"><span class="issue-rank">'+(i+1)+'</span><span class="issue-name">'+item.k+'</span>'+
        '<span class="issue-delta '+(item.d>=0?'up':'down')+'">'+numFmt(item.p)+' → '+numFmt(item.c)+' ('+(item.d >= 0 ? '▲' : '▼') + numFmt(Math.abs(item.d))+')</span></div>';
    }).join('') || '<div style="color:var(--text-soft); font-size:0.78vw;">비교할 데이터가 없습니다</div>';

    // ---- 연간 키워드별 민원 건수 (최근 12개월 누적, monthByKw 12회 합산) ----
    var kwYear = {};
    trendPts.forEach(function(p){ var mByKw = monthByKw(p.y,p.m,null); Object.keys(mByKw).forEach(function(k){ kwYear[k]=(kwYear[k]||0)+mByKw[k]; }); });
    document.getElementById('voc-annual-body').innerHTML = topN(kwYear,6).map(function(o,i){
      return '<tr><td><span class="kw-rank">'+(i+1)+'</span>'+o.k+'</td><td class="num">'+numFmt(o.v)+'</td></tr>';
    }).join('');

    // ---- 민원통계 탭 ----
    vocRenderSummaryTab(y,mi,py,pm);

    // ---- 접수내용 탭: 기본값 = 최신월 전체 ----
    vocApplyFilter();

    // ---- 데이터 탭: 전체 등록 데이터 ----
    document.getElementById('voc-data-count').textContent = numFmt(DATA.length) + '건 (전체 · 최신월 '+latestKey+')';
    vocRenderDataTab(DATA);
  }

  function vocRenderList(rows){
    var body = document.getElementById('voc-list-body');
    document.getElementById('voc-filter-count').textContent = numFmt(rows.length) + '건';
    if (rows.length === 0){
      body.innerHTML = '<div style="color:var(--text-soft); text-align:center; padding:2vw 0;">해당 조건의 접수내용이 없습니다</div>';
    } else {
      body.innerHTML = rows.map(function(r){
        return '<div class="voc-item" onclick="this.classList.toggle(\'open\')">' +
          '<div class="vi-meta">' + r.date + ' · ' + r.name + ' · ' + r.type + ' · ' + r.route + '</div>' +
          '<div class="vi-q"><span class="voc-tag q">' + r.gubun + '</span>' + r.memo + '</div>' +
          '<div class="vi-a"><span class="voc-tag a">처리</span>' + r.done + '</div>' +
        '</div>';
      }).join('');
    }
    vocRenderSummary(rows);
  }

  function vocRenderSummary(rows){
    var el = document.getElementById('voc-summary');
    if (rows.length === 0){ el.innerHTML = '자동 요약: 조건에 맞는 접수내용이 없습니다.'; return; }
    var channelCount = {}; rows.forEach(function(r){ channelCount[r.route]=(channelCount[r.route]||0)+1; });
    var byKw = {}; rows.forEach(function(r){ byKw[r.kw]=(byKw[r.kw]||0)+1; });
    var channelStr = Object.keys(channelCount).sort(function(a,b){return channelCount[b]-channelCount[a];})
      .map(function(k){ return k+' '+numFmt(channelCount[k])+'건'; }).join(' · ');
    var topKw = topN(byKw,3).map(function(o){ return o.k+'('+numFmt(o.v)+')'; }).join(', ');
    el.innerHTML = '자동 요약: 총 <b>' + numFmt(rows.length) + '건</b> · 채널 ' + channelStr + ' · 주요 키워드 ' + topKw;
  }

  function vocApplyFilter(){
    if (!DATA.length) return;
    var ch = document.getElementById('voc-f-channel').value;
    var cat = document.getElementById('voc-f-category').value;
    var typ = document.getElementById('voc-f-type').value;
    var r1 = document.getElementById('voc-f-region1').value;
    var r2 = document.getElementById('voc-f-region2').value;
    var subj = document.getElementById('voc-f-subject').value;
    var contract = document.getElementById('voc-f-contract').value;
    var voucher = document.getElementById('voc-f-voucher').value;
    var month = document.getElementById('voc-f-month').value;
    var kw = document.getElementById('voc-f-keyword').value.trim();
    var rows = DATA.filter(function(r){
      if (month && r.haedangwol !== month) return false;
      if (ch && r.route !== ch) return false;
      if (cat && r.gubun !== cat) return false;
      if (typ && r.type !== typ) return false;
      if (r1 && r.region1 !== r1) return false;
      if (r2 && r.region2 !== r2) return false;
      if (subj && r.subject !== subj) return false;
      if (contract && r.contract !== contract) return false;
      if (voucher && r.voucher !== voucher) return false;
      if (kw && r.memo.indexOf(kw)===-1 && r.kw.indexOf(kw)===-1) return false;
      return true;
    });
    rows.sort(function(a,b){
      if (a.haedangwol !== b.haedangwol) return b.haedangwol < a.haedangwol ? -1 : 1;
      return b.date < a.date ? -1 : b.date > a.date ? 1 : 0;
    });
    vocRenderList(rows);
  }

  function vocRenderDataTab(rows){
    document.getElementById('voc-data-body').innerHTML = rows.map(function(r){
      return '<tr><td>'+r.date+'</td><td>'+r.name+'</td><td>'+r.memo+'</td><td>'+r.route+'</td><td>'+r.method+'</td><td>'+r.kw+'</td></tr>';
    }).join('');
  }

  function vocExcelDateToStr(v){
    if (v instanceof Date && !isNaN(v)){
      var y=v.getUTCFullYear(), m=String(v.getUTCMonth()+1).padStart(2,'0'), d=String(v.getUTCDate()).padStart(2,'0');
      return y+'-'+m+'-'+d;
    }
    if (typeof v === 'number' && isFinite(v)){
      // 엑셀 날짜 일련번호(1900 날짜계) -> JS Date
      var utcDays = Math.floor(v - 25569);
      var jsDate = new Date(utcDays * 86400 * 1000);
      var y2=jsDate.getUTCFullYear(), m2=String(jsDate.getUTCMonth()+1).padStart(2,'0'), d2=String(jsDate.getUTCDate()).padStart(2,'0');
      return y2+'-'+m2+'-'+d2;
    }
    if (typeof v === 'string'){
      var s = v.trim().replace(/\./g,'-').replace(/\//g,'-');
      var m3 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m3) return m3[1]+'-'+String(m3[2]).padStart(2,'0')+'-'+String(m3[3]).padStart(2,'0');
      return s;
    }
    return '';
  }
  function handleVocFile(evt){
    var file = evt.target.files[0];
    if (!file) return;
    var statusEl = document.getElementById('voc-upload-status');
    statusEl.textContent = '';
    var reader = new FileReader();
    reader.onload = function(e){
      try{
        var data = new Uint8Array(e.target.result);
        // [v17 수정] cellDates:true를 쓰면 SheetJS가 날짜 셀을 JS Date로 변환할 때
        // 브라우저(시스템) 시간대의 영향을 받아, 한국시간(UTC+9) 환경에서 월말 날짜가
        // 다음/이전 달로 잘못 카운팅되는 문제가 있었음. cellDates 옵션을 꺼서 날짜 셀을
        // 원본 시리얼 숫자 그대로 받고, 아래 vocExcelDateToStr의 숫자 처리 분기(순수 UTC
        // 연산, 시간대 영향 없음)에서 변환하도록 수정.
        var wb = XLSX.read(data, {type:'array', cellDates:false});
        var ws = wb.Sheets[wb.SheetNames[0]];
        var json = XLSX.utils.sheet_to_json(ws, {defval:''});
        var rows = json.map(function(r){
          var arrivalStr = vocExcelDateToStr(r['접수일']);
          var haedangwol = arrivalStr ? arrivalStr.slice(0,7) : ''; // 접수일의 연-월만 사용 (일자는 버림)
          return [
            arrivalStr, String(r['고객명']||''), String(r['접수내용']||''), String(r['처리내용']||''),
            String(r['구분']||''), String(r['유형']||'일반'), String(r['접수경로']||''), String(r['키워드']||''),
            String(r['대표지역']||''), String(r['상세지역']||''), String(r['접수주체']||''), String(r['계약종별']||''),
            String(r['에너지바우처구분']||''), haedangwol, String(r['접수방법']||'')
          ];
        }).filter(function(r){ return r[0] && parseDate(r[0]); });
        if (!rows.length){
          statusEl.textContent = '업로드 오류: "접수일" 열에서 인식 가능한 날짜를 찾지 못했습니다. 헤더명과 날짜 형식(YYYY-MM-DD)을 확인해 주세요.';
          return;
        }
        vocRunAll(rows);
        statusEl.textContent = rows.length + '건 업로드 완료';
        lsSave('vocRawRows', rows);
      }catch(err){
        statusEl.textContent = '업로드 오류: ' + err.message;
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // 초기 로드: 내장된 VOC 전체 데이터로 계산 (엑셀 업로드 시 이 데이터를 대체)
  // 초기 로드시 자동 실행 없음 — 엑셀 업로드 전에는 전부 빈 상태(대시)로 유지

  // ===== [신규] 페이지 로드시 localStorage에 저장된 업로드 데이터 복원 =====
  // 각 섹션은 서로 독립적으로 시도 — 한 섹션 복원이 실패해도 나머지는 정상 복원되도록 try/catch로 분리
  function restoreUploadedData(){
    // 1) 열판매현황: 월별 매출실적(12개월)
    try{
      var hm = lsLoad('heatMonth', null);
      if (hm && Object.keys(hm).length){
        HEAT_MONTH_DATA = hm;
        Object.keys(hm).forEach(function(m){
          var statusEl = document.getElementById('heat-file-'+m+'-status');
          if (statusEl){
            statusEl.textContent = (hm[m].rowCount||0).toLocaleString('ko-KR')+'건 반영완료';
            statusEl.className = 'hur-status ok';
          }
        });
        renderHeatOverview();
        heatUpdateContractTable('ct', 'usage');
        heatUpdateContractTable('cr', 'revenue');
        heatUpdateRegionTable();
        heatUpdateCoolingShare();
      }
    }catch(e){}

    // 2) 온도 실적
    try{
      var ht = lsLoad('heatTemp', null);
      if (ht && Object.keys(ht).length){
        HEAT_TEMP_DATA = ht;
        var s1 = document.getElementById('heat-temp-status');
        if (s1){ s1.textContent = Object.keys(ht).length+'개월 반영완료'; s1.className = 'hur-status ok'; }
        heatUpdateTempChart();
      }
    }catch(e){}

    // 3) 실입주 기준 원단위
    try{
      var hw = lsLoad('heatWon', null);
      if (hw && Object.keys(hw).length){
        HEAT_WON_DATA = hw;
        var s2 = document.getElementById('heat-won-status');
        if (s2){ s2.textContent = Object.keys(hw).length+'개월 반영완료'; s2.className = 'hur-status ok'; }
        heatUpdateWonChart();
      }
    }catch(e){}

    // 4) 지역별 세대수
    try{
      var hh = lsLoad('heatHousehold', null);
      if (hh && Object.keys(hh).length){
        HEAT_HOUSEHOLD_DATA = hh;
        var s3 = document.getElementById('heat-household-status');
        if (s3){ s3.textContent = '반영완료'; s3.className = 'hur-status ok'; }
        heatUpdateHouseholdTable();
      }
    }catch(e){}

    // 5) 열판매현황(냉방)
    try{
      var hc = lsLoad('heatCooling', null);
      if (hc && Object.keys(hc).length){
        HEAT_COOLING_DATA = hc;
        var s4 = document.getElementById('heat-cooling-status');
        if (s4){ s4.textContent = '반영완료'; s4.className = 'hur-status ok'; }
        heatUpdateCoolingLeft();
        heatUpdateCoolingSummary();
        heatUpdateCoolingShare();
      }
    }catch(e){}

    // 6) 고객관리(연체) 현황
    try{
      var arRows = lsLoad('arrearsRows', null);
      var arYmd = lsLoad('arrearsYmd', null);
      if (arRows && arRows.length && arYmd){
        renderArrearsFromRows(arRows, arYmd);
      }
    }catch(e){}

    // 7) 주택용 개발현황
    try{
      var hdRows = lsLoad('householdDevRows', null);
      if (hdRows && hdRows.length){
        var rowCount = renderHouseholdDevFromRows(hdRows);
        var s5 = document.getElementById('hd-status');
        if (s5){ s5.textContent = rowCount.toLocaleString('ko-KR')+'행 반영완료'; s5.className = 'upload-status ok'; }
      }
    }catch(e){}

    // 8) 고객관리(민원) VOC 데이터
    try{
      var vocRows = lsLoad('vocRawRows', null);
      if (vocRows && vocRows.length){
        vocRunAll(vocRows);
        var s6 = document.getElementById('voc-upload-status');
        if (s6){ s6.textContent = vocRows.length + '건 업로드 완료'; }
      }
    }catch(e){}
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', restoreUploadedData);
  } else {
    restoreUploadedData();
  }

