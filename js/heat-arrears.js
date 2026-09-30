// 업로드 데이터 저장 · 열판매현황 · 고객관리(연체) 연체 현황 — index.html 안에 있던 스크립트를 그대로 옮김
  // ===== [신규] 열판매현황: 월별 매출실적 엑셀 업로드 -> 자동 집계 -> 계획(스냅샷)과 비교 =====
  // HEAT_MONTH_DATA[월(1~12)] = { byType:{주택용:{usage,revenue}, 업무용:{...}, 공공용:{...}}, byDistrict:{...}, totalUsage, totalRevenue, rowCount }
  // usage 단위는 엑셀 원본(당월사용량, Mcal), revenue는 열요금계(원). 표시할 때 Gcal(÷1000), 백만원(÷1e6)으로 환산.
  // ===== [신규] 업로드 데이터 영속화(localStorage) — 새로고침/재접속해도 유지, 버튼으로만 초기화 =====
  var LS_PREFIX = DEMO_PFX + 'r9_';
  var LS_KEYS = ['heatMonth','heatTemp','heatWon','heatHousehold','heatCooling','arrearsRows','arrearsYmd','householdDevRows','vocRawRows','mdData','salesNumData'];
  function lsSave(key, val){ try{ localStorage.setItem(LS_PREFIX+key, JSON.stringify(val)); }catch(e){} }
  function lsLoad(key, fallback){ try{ var v = localStorage.getItem(LS_PREFIX+key); return v===null ? fallback : JSON.parse(v); }catch(e){ return fallback; } }
  function clearAllUploadedData(){
    if (!confirm('업로드했던 모든 월별 실적 데이터와 마크다운으로 작성한 메모를 삭제할까요?\n(연체현황, 민원 데이터 + 각 페이지의 메모 입력란이 모두 지워지고 새로고침됩니다)')) return;
    LS_KEYS.forEach(function(k){ try{ localStorage.removeItem(LS_PREFIX+k); }catch(e){} });
    location.reload();
  }

  var HEAT_MONTH_DATA = {};

  // ===== [신규] 온도 실적(기상청 기온분석) 업로드 -> 인천 평균기온 추이 차트의 '2026' 라인만 갱신 =====
  // 3개년평균 라인은 고정값이라 건드리지 않음. 파일은 매달 최신본으로 통째로 덮어쓰기(연도 전체 재계산).
  var HEAT_TEMP_DATA = {}; // {월(1~12): 평균기온}

  function heatTempX(month){ return 60 + (month-1) * ((700-60)/11); }
  function heatTempY(temp){ return 200.0 - temp*5.84; }

  function handleHeatTempFile(evt){
    var file = evt.target.files[0];
    if (!file) return;
    var statusEl = document.getElementById('heat-temp-status');
    statusEl.textContent = '처리 중...';
    statusEl.className = 'hur-status';

    var reader = new FileReader();
    reader.onload = function(e){
      try{
        var bytes = new Uint8Array(e.target.result);
        var text;
        try{ text = new TextDecoder('euc-kr').decode(bytes); }
        catch(err){ text = new TextDecoder('utf-8').decode(bytes); }

        var lines = text.split(/\r\n|\n/);
        var headerIdx = -1;
        for (var i=0; i<lines.length; i++){
          if (lines[i].indexOf('년월') === 0){ headerIdx = i; break; }
        }
        if (headerIdx === -1) throw new Error('헤더(년월) 행을 찾을 수 없습니다');

        var header = lines[headerIdx].split('\t');
        var colTemp = -1;
        for (var c=0; c<header.length; c++){
          if (header[c].indexOf('평균기온') !== -1){ colTemp = c; break; }
        }
        if (colTemp === -1) throw new Error('평균기온 컬럼을 찾을 수 없습니다');

        var data = {};
        var count = 0;
        for (var r = headerIdx+1; r < lines.length; r++){
          var line = lines[r].trim();
          if (!line) continue;
          var cols = line.split('\t');
          var m = /^(\d{4})-(\d{2})$/.exec(cols[0]);
          if (!m) continue;
          var year = Number(m[1]), month = Number(m[2]);
          if (year !== 2026) continue; // 3개년평균은 고정값이라 2026년만 반영
          var temp = Number(cols[colTemp]);
          if (isNaN(temp)) continue;
          data[month] = temp;
          count++;
        }
        if (count === 0) throw new Error('2026년 데이터를 찾을 수 없습니다');

        HEAT_TEMP_DATA = data;
        statusEl.textContent = count+'개월 반영완료';
        statusEl.className = 'hur-status ok';
        heatUpdateTempChart();
        lsSave('heatTemp', HEAT_TEMP_DATA);
      }catch(err){
        statusEl.textContent = '오류: '+err.message;
        statusEl.className = 'hur-status err';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function heatUpdateTempChart(){
    var months = Object.keys(HEAT_TEMP_DATA).map(Number).sort(function(a,b){ return a-b; });
    if (!months.length) return;

    var pts = months.map(function(m){
      return heatTempX(m).toFixed(1) + ',' + heatTempY(HEAT_TEMP_DATA[m]).toFixed(1);
    }).join(' ');
    document.getElementById('temp-2026-line').setAttribute('points', pts);

    // 데이터 라벨(원+텍스트)은 가장 최신 월에만 표시: 2026 실적 + 3개년평균 둘 다
    var latest = months[months.length - 1];
    var lx = heatTempX(latest), ly = heatTempY(HEAT_TEMP_DATA[latest]);
    var dot = document.getElementById('temp-2026-dot');
    dot.setAttribute('cx', lx.toFixed(1));
    dot.setAttribute('cy', ly.toFixed(1));
    var label = document.getElementById('temp-2026-label');
    label.setAttribute('x', lx.toFixed(1));
    label.setAttribute('y', (ly - 13).toFixed(1));
    label.textContent = HEAT_TEMP_DATA[latest].toFixed(1) + '℃';

    var avgCell = document.getElementById('temp-avg-'+latest);
    if (avgCell){
      var avgVal = Number(avgCell.textContent);
      var ay = heatTempY(avgVal);
      var avgDot = document.getElementById('temp-avg-dot');
      avgDot.setAttribute('cx', lx.toFixed(1));
      avgDot.setAttribute('cy', ay.toFixed(1));
      var avgLabel = document.getElementById('temp-avg-label');
      avgLabel.setAttribute('x', lx.toFixed(1));
      avgLabel.setAttribute('y', (ay + 16).toFixed(1));
      avgLabel.textContent = avgVal.toFixed(1) + '℃';
    }

    for (var m=1; m<=12; m++){
      var cell = document.getElementById('temp-tbl-'+m);
      if (!cell) continue;
      if (HEAT_TEMP_DATA[m] !== undefined){
        cell.textContent = HEAT_TEMP_DATA[m].toFixed(1);
        cell.className = '';
      } else {
        cell.textContent = '-';
        cell.className = 'dim';
      }
    }
  }

  // ===== [신규] 실입주 기준 원단위 업로드 -> '2026' 라인만 갱신 (3개년평균은 고정 스냅샷, 절대 건드리지 않음) =====
  var HEAT_WON_DATA = {}; // {월(1~12): 원단위 값}
  function heatWonY(v){ return 235.0 - v*150; }

  function handleHeatWondanwiFile(evt){
    var file = evt.target.files[0];
    if (!file) return;
    var statusEl = document.getElementById('heat-won-status');
    statusEl.textContent = '처리 중...';
    statusEl.className = 'hur-status';

    var reader = new FileReader();
    reader.onload = function(e){
      try{
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, {type:'array'});
        var sheetName = wb.SheetNames.indexOf('Sheet1') !== -1 ? 'Sheet1' : wb.SheetNames[0];
        var ws = wb.Sheets[sheetName];
        var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null});

        var yearRow = null;
        for (var i=0; i<rows.length; i++){
          var first = rows[i] && rows[i][0];
          if (first && String(first).indexOf('2026') !== -1){ yearRow = rows[i]; break; }
        }
        if (!yearRow) throw new Error("'2026년' 행을 찾을 수 없습니다");

        var result = {};
        var count = 0;
        for (var m=1; m<=12; m++){
          var v = yearRow[m];
          if (v === null || v === undefined || v === '') continue;
          var num = Number(v);
          if (isNaN(num)) continue;
          result[m] = num;
          count++;
        }
        if (count === 0) throw new Error('2026년 데이터가 없습니다');

        HEAT_WON_DATA = result;
        statusEl.textContent = count+'개월 반영완료';
        statusEl.className = 'hur-status ok';
        heatUpdateWonChart();
        lsSave('heatWon', HEAT_WON_DATA);
      }catch(err){
        statusEl.textContent = '오류: '+err.message;
        statusEl.className = 'hur-status err';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function heatUpdateWonChart(){
    var months = Object.keys(HEAT_WON_DATA).map(Number).sort(function(a,b){ return a-b; });
    if (!months.length) return;

    var pts = months.map(function(m){
      return heatTempX(m).toFixed(1) + ',' + heatWonY(HEAT_WON_DATA[m]).toFixed(1);
    }).join(' ');
    document.getElementById('won-2026-line').setAttribute('points', pts);

    // 데이터 라벨(원+텍스트)은 가장 최신 월에만 표시: 2026 실적 + 3개년평균 둘 다
    var latest = months[months.length - 1];
    var lx = heatTempX(latest), ly = heatWonY(HEAT_WON_DATA[latest]);
    var dot = document.getElementById('won-2026-dot');
    dot.setAttribute('cx', lx.toFixed(1));
    dot.setAttribute('cy', ly.toFixed(1));
    var label = document.getElementById('won-2026-label');
    label.setAttribute('x', lx.toFixed(1));
    label.setAttribute('y', (ly - 12).toFixed(1));
    label.textContent = HEAT_WON_DATA[latest].toFixed(2);

    var avgCell = document.getElementById('won-avg-'+latest);
    if (avgCell){
      var avgVal = Number(avgCell.textContent);
      var ay = heatWonY(avgVal);
      var avgDot = document.getElementById('won-avg-dot');
      avgDot.setAttribute('cx', lx.toFixed(1));
      avgDot.setAttribute('cy', ay.toFixed(1));
      var avgLabel = document.getElementById('won-avg-label');
      avgLabel.setAttribute('x', lx.toFixed(1));
      avgLabel.setAttribute('y', (ay + 15).toFixed(1));
      avgLabel.textContent = avgVal.toFixed(2);
    }

    for (var m=1; m<=12; m++){
      var cell = document.getElementById('won-tbl-'+m);
      if (!cell) continue;
      if (HEAT_WON_DATA[m] !== undefined){
        cell.textContent = HEAT_WON_DATA[m].toFixed(2);
        cell.className = '';
      } else {
        cell.textContent = '-';
        cell.className = 'dim';
      }
    }
  }


  // ===== [신규] 지역별 세대수 업로드 -> '실적(공급)' 전체 갱신 (계획(CM)은 고정 스냅샷) =====
  // 세대수는 누계 합산이 아닌 시점값이라, KPI는 누적이 아니라 '최신월 값'을 그대로 보여줌
  var HEAT_HOUSEHOLD_DATA = {}; // {'기존지구':{월:세대수}, '검단':{월:세대수}}

  function handleHeatHouseholdFile(evt){
    var file = evt.target.files[0];
    if (!file) return;
    var statusEl = document.getElementById('heat-household-status');
    statusEl.textContent = '처리 중...';
    statusEl.className = 'hur-status';

    var reader = new FileReader();
    reader.onload = function(e){
      try{
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, {type:'array'});
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null});

        var result = {};
        var count = 0;
        for (var r=1; r<rows.length; r++){
          var row = rows[r];
          if (!row) continue;
          var region = row[0];
          if (region !== '기존지구' && region !== '검단') continue;
          var vals = {};
          for (var m=1; m<=12; m++){
            var v = row[m+1];
            if (v === null || v === undefined || v === '') continue;
            var num = Number(v);
            if (isNaN(num)) continue;
            vals[m] = num;
            count++;
          }
          result[region] = vals;
        }
        if (count === 0) throw new Error("'기존지구'/'검단' 행 또는 값을 찾을 수 없습니다");

        HEAT_HOUSEHOLD_DATA = result;
        statusEl.textContent = '반영완료';
        statusEl.className = 'hur-status ok';
        heatUpdateHouseholdTable();
        lsSave('heatHousehold', HEAT_HOUSEHOLD_DATA);
      }catch(err){
        statusEl.textContent = '오류: '+err.message;
        statusEl.className = 'hur-status err';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function heatUpdateHouseholdTable(){
    var keys = {'existing':'기존지구', 'gd':'검단'};
    var overallLatest = null;

    Object.keys(keys).forEach(function(key){
      var region = keys[key];
      var regionData = HEAT_HOUSEHOLD_DATA[region] || {};
      var months = Object.keys(regionData).map(Number).sort(function(a,b){ return a-b; });
      var latest = months.length ? months[months.length-1] : null;
      if (latest !== null && (overallLatest === null || latest > overallLatest)) overallLatest = latest;

      for (var m=1; m<=12; m++){
        var row = document.getElementById('hh-'+key+'-row-'+m);
        if (!row) continue;
        var plan = heatParsePlan('hh-'+key+'-plan-'+m);
        if (regionData[m] !== undefined){
          var act = regionData[m];
          var diff = act - plan;
          var rate = plan ? (act/plan*100) : 0;

          document.getElementById('hh-'+key+'-act-'+m).textContent = heatFmt(act);
          var diffEl = document.getElementById('hh-'+key+'-diff-'+m);
          diffEl.textContent = (diff >= 0 ? '▲' : '▼') + heatFmt(Math.abs(diff));
          diffEl.className = diff >= 0 ? 'diff-good' : 'diff-bad';
          var rateEl = document.getElementById('hh-'+key+'-rate-'+m);
          rateEl.textContent = Math.round(rate)+'%';
          rateEl.className = 'rate-badge ' + (rate >= 100 ? 'good' : 'bad');

          row.classList.remove('future');
          row.classList.toggle('current', m === latest);
        } else {
          row.classList.add('future');
          row.classList.remove('current');
        }
      }

      var badgeEl = document.getElementById('hh-'+key+'-kpi-badge');
      var valueEl = document.getElementById('hh-'+key+'-kpi-value');
      var unitEl = document.getElementById('hh-'+key+'-kpi-unit');
      var planLabelEl = document.getElementById('hh-'+key+'-kpi-planlabel');
      var planEl = document.getElementById('hh-'+key+'-kpi-plan');
      var diffEl2 = document.getElementById('hh-'+key+'-kpi-diff');

      if (latest !== null){
        var act2 = regionData[latest];
        var plan2 = heatParsePlan('hh-'+key+'-plan-'+latest);
        var diff2 = act2 - plan2;
        var rate2 = plan2 ? (act2/plan2*100) : 0;

        valueEl.textContent = heatFmt(act2);
        unitEl.textContent = '세대 ('+latest+'월 실적)';
        planLabelEl.textContent = latest+'월 계획';
        planEl.textContent = heatFmt(plan2);
        diffEl2.textContent = (diff2 >= 0 ? '▲' : '▼') + heatFmt(Math.abs(diff2));
        diffEl2.className = diff2 >= 0 ? 'diff-good' : 'diff-bad';
        badgeEl.textContent = (rate2 >= 100 ? '▲ ' : '▼ ') + rate2.toFixed(1) + '%';
        badgeEl.className = 'rate-badge ' + (rate2 >= 100 ? 'good' : 'bad');
      } else {
        valueEl.textContent = '-'; unitEl.textContent = '세대';
        planLabelEl.textContent = '계획'; planEl.textContent = '-';
        diffEl2.textContent = '-'; diffEl2.className = 'dim';
        badgeEl.textContent = '-'; badgeEl.className = 'rate-badge dim';
      }
    });

    var noteEl = document.getElementById('hh-unit-note');
    if (noteEl){
      if (overallLatest !== null){
        noteEl.textContent = '단위: 세대 | '+overallLatest+'월 기준 스냅샷 (세대수는 누계 합산이 아닌 시점값)';
      } else {
        noteEl.textContent = '단위: 세대 | 업로드된 실적 없음 (데이터 탭에서 업로드)';
      }
    }
  }

  // ===== [신규] 열판매현황(냉방) 업로드 -> 왼쪽 표 / 오른쪽 실적요약 / 냉방비중 갱신 =====
  // 계획, 연간계획은 전부 고정 스냅샷. 실적만 업로드 파일 기준으로 갱신.
  var HEAT_COOLING_DATA = {}; // {월: {usage, revenue}}

  function handleHeatCoolingFile(evt){
    var file = evt.target.files[0];
    if (!file) return;
    var statusEl = document.getElementById('heat-cooling-status');
    statusEl.textContent = '처리 중...';
    statusEl.className = 'hur-status';

    var reader = new FileReader();
    reader.onload = function(e){
      try{
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, {type:'array'});
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null});

        var result = {};
        var count = 0;
        for (var r=1; r<rows.length; r++){
          var row = rows[r];
          if (!row) continue;
          var metric = row[0]; // '판매량' | '매출'
          var kind = row[1];   // '계획' | '실적'
          if (kind !== '실적') continue;
          if (metric !== '판매량' && metric !== '매출') continue;
          var field = (metric === '판매량') ? 'usage' : 'revenue';
          for (var m=1; m<=12; m++){
            var v = row[m+2];
            if (v === null || v === undefined || v === '') continue;
            var num = Number(v);
            if (isNaN(num)) continue;
            if (!result[m]) result[m] = {};
            result[m][field] = num;
            count++;
          }
        }
        if (count === 0) throw new Error("'실적' 행 데이터를 찾을 수 없습니다");

        HEAT_COOLING_DATA = result;
        statusEl.textContent = '반영완료';
        statusEl.className = 'hur-status ok';

        heatUpdateCoolingLeft();
        heatUpdateCoolingSummary();
        heatUpdateCoolingShare();
        lsSave('heatCooling', HEAT_COOLING_DATA);
      }catch(err){
        statusEl.textContent = '오류: '+err.message;
        statusEl.className = 'hur-status err';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function heatUpdateCoolingLeft(){
    var months = Object.keys(HEAT_COOLING_DATA).map(Number).sort(function(a,b){ return a-b; });
    var latest = months.length ? months[months.length-1] : null;
    var cumUse = 0, cumRev = 0, hasCum = false;

    for (var m=1; m<=12; m++){
      var row = document.getElementById('cl-row-'+m);
      if (!row) continue;
      var d = HEAT_COOLING_DATA[m];
      if (d){
        row.classList.remove('future');
        row.classList.toggle('current', m === latest);

        if (d.usage !== undefined){
          var usePlan = heatParsePlan('cl-use-plan-'+m);
          var useDiff = d.usage - usePlan;
          var useRate = usePlan ? (d.usage/usePlan*100) : 0;
          document.getElementById('cl-use-act-'+m).textContent = heatFmt(d.usage);
          var ud = document.getElementById('cl-use-diff-'+m);
          ud.textContent = (useDiff >= 0 ? '▲' : '▼') + heatFmt(Math.abs(useDiff));
          ud.className = useDiff>=0 ? 'diff-good' : 'diff-bad';
          var ur = document.getElementById('cl-use-rate-'+m);
          ur.textContent = Math.round(useRate)+'%';
          ur.className = 'rate-badge ' + (useRate>=100?'good':'bad');
          cumUse += d.usage; hasCum = true;
        }
        if (d.revenue !== undefined){
          var revPlan = heatParsePlan('cl-rev-plan-'+m);
          var revDiff = d.revenue - revPlan;
          var revRate = revPlan ? (d.revenue/revPlan*100) : 0;
          document.getElementById('cl-rev-act-'+m).textContent = heatFmt(d.revenue);
          var rd = document.getElementById('cl-rev-diff-'+m);
          rd.textContent = (revDiff >= 0 ? '▲' : '▼') + heatFmt(Math.abs(revDiff));
          rd.className = revDiff>=0 ? 'diff-good' : 'diff-bad';
          var rr = document.getElementById('cl-rev-rate-'+m);
          rr.textContent = Math.round(revRate)+'%';
          rr.className = 'rate-badge ' + (revRate>=100?'good':'bad');
          cumRev += d.revenue;
        }
      } else {
        row.classList.add('future');
        row.classList.remove('current');
      }
    }

    if (hasCum){
      var t1 = document.getElementById('cl-use-act-total');
      t1.textContent = heatFmt(cumUse); t1.className = '';
      var t2 = document.getElementById('cl-rev-act-total');
      t2.textContent = heatFmt(cumRev); t2.className = '';
    }
  }

  function heatUpdateCoolingSummary(){
    var months = Object.keys(HEAT_COOLING_DATA).map(Number).sort(function(a,b){ return a-b; });
    if (!months.length) return;
    var latest = months[months.length-1];

    document.getElementById('cl-summary-tag').textContent = latest+'월 · 누적(1~'+latest+'월)';
    document.getElementById('cl-sec1-title').textContent = '① '+latest+'월 계획 대비 실적';
    document.getElementById('cl-sec2-title').textContent = '② 누적(1~'+latest+'월) 계획 대비 실적';

    var d = HEAT_COOLING_DATA[latest];
    if (d && d.usage !== undefined){
      var plan = heatParsePlan('cl-use-plan-'+latest);
      var diff = d.usage - plan;
      var rate = plan ? (d.usage/plan*100) : 0;
      document.getElementById('cl-latest-use-value').textContent = heatFmt(d.usage);
      document.getElementById('cl-latest-use-plan').textContent = heatFmt(plan);
      var de = document.getElementById('cl-latest-use-diff');
      de.textContent = (diff >= 0 ? '▲' : '▼') + heatFmt(Math.abs(diff)); de.className = diff>=0?'diff-good':'diff-bad';
      var be = document.getElementById('cl-latest-use-badge');
      be.textContent = (rate>=100?'▲ ':'▼ ')+rate.toFixed(0)+'%'; be.className = 'rate-badge '+(rate>=100?'good':'bad');
    }
    if (d && d.revenue !== undefined){
      var plan2 = heatParsePlan('cl-rev-plan-'+latest);
      var diff2 = d.revenue - plan2;
      var rate2 = plan2 ? (d.revenue/plan2*100) : 0;
      document.getElementById('cl-latest-rev-value').textContent = heatFmt(d.revenue);
      document.getElementById('cl-latest-rev-plan').textContent = heatFmt(plan2);
      var de2 = document.getElementById('cl-latest-rev-diff');
      de2.textContent = (diff2 >= 0 ? '▲' : '▼') + heatFmt(Math.abs(diff2)); de2.className = diff2>=0?'diff-good':'diff-bad';
      var be2 = document.getElementById('cl-latest-rev-badge');
      be2.textContent = (rate2>=100?'▲ ':'▼ ')+rate2.toFixed(0)+'%'; be2.className = 'rate-badge '+(rate2>=100?'good':'bad');
    }

    var cumUse=0, cumUsePlan=0, cumRev=0, cumRevPlan=0;
    months.forEach(function(m){
      var dm = HEAT_COOLING_DATA[m];
      if (dm.usage !== undefined){ cumUse += dm.usage; cumUsePlan += heatParsePlan('cl-use-plan-'+m); }
      if (dm.revenue !== undefined){ cumRev += dm.revenue; cumRevPlan += heatParsePlan('cl-rev-plan-'+m); }
    });
    var cumUseRate = cumUsePlan ? (cumUse/cumUsePlan*100) : 0;
    var cumUseDiff = cumUse - cumUsePlan;
    document.getElementById('cl-cum-use-value').textContent = heatFmt(cumUse);
    document.getElementById('cl-cum-use-plan').textContent = heatFmt(cumUsePlan);
    var cud = document.getElementById('cl-cum-use-diff');
    cud.textContent = (cumUseDiff >= 0 ? '▲' : '▼') + heatFmt(Math.abs(cumUseDiff)); cud.className = cumUseDiff>=0?'diff-good':'diff-bad';
    var cub = document.getElementById('cl-cum-use-badge');
    cub.textContent = (cumUseRate>=100?'▲ ':'▼ ')+cumUseRate.toFixed(0)+'%'; cub.className = 'rate-badge '+(cumUseRate>=100?'good':'bad');

    var cumRevRate = cumRevPlan ? (cumRev/cumRevPlan*100) : 0;
    var cumRevDiff = cumRev - cumRevPlan;
    document.getElementById('cl-cum-rev-value').textContent = heatFmt(cumRev);
    document.getElementById('cl-cum-rev-plan').textContent = heatFmt(cumRevPlan);
    var crd = document.getElementById('cl-cum-rev-diff');
    crd.textContent = (cumRevDiff >= 0 ? '▲' : '▼') + heatFmt(Math.abs(cumRevDiff)); crd.className = cumRevDiff>=0?'diff-good':'diff-bad';
    var crb = document.getElementById('cl-cum-rev-badge');
    crb.textContent = (cumRevRate>=100?'▲ ':'▼ ')+cumRevRate.toFixed(0)+'%'; crb.className = 'rate-badge '+(cumRevRate>=100?'good':'bad');
  }

  // 냉방비중: 냉방(HEAT_COOLING_DATA) / 전체(ov-* 셀, 이미 매출실적 업로드로 갱신되는 값) 비율
  function heatUpdateCoolingShare(){
    var months = Object.keys(HEAT_COOLING_DATA).map(Number).sort(function(a,b){ return a-b; });
    if (!months.length) return;
    var latest = months[months.length-1];

    function setShareRow(prefix, label, coolVal, totalVal){
      var labelEl = document.getElementById(prefix+'-label');
      if (labelEl) labelEl.textContent = label;
      var coolEl = document.getElementById(prefix+'-cool');
      var totalEl = document.getElementById(prefix+'-total');
      var fillEl = document.getElementById(prefix+'-fill');
      var pctEl = document.getElementById(prefix+'-pct');
      if (coolVal === null || totalVal === null || !totalVal){
        coolEl.textContent = '-'; totalEl.textContent = '-';
        fillEl.style.width = '0%'; pctEl.textContent = '-';
        return;
      }
      var pct = coolVal/totalVal*100;
      coolEl.textContent = heatFmt(coolVal);
      totalEl.textContent = heatFmt(totalVal);
      fillEl.style.width = Math.min(pct,100).toFixed(1)+'%';
      pctEl.textContent = pct.toFixed(1)+'%';
    }

    function ovActual(prefix, m){
      var cell = document.getElementById(prefix+'-'+m);
      if (!cell) return null;
      var t = cell.textContent.trim();
      if (t === '-' || t === '') return null;
      var v = Number(t.replace(/,/g,''));
      return isNaN(v) ? null : v;
    }

    // ① {latest}월 계획: 계획끼리는 항상 계산 가능 (냉방/전체 모두 고정 계획값)
    var coolUsePlan = heatParsePlan('cl-use-plan-'+latest);
    var totalUsePlan = heatParsePlan('ov-use-plan-'+latest);
    setShareRow('cl-share-use-plan', latest+'월 계획', coolUsePlan, totalUsePlan);

    var coolRevPlan = heatParsePlan('cl-rev-plan-'+latest);
    var totalRevPlan = heatParsePlan('ov-rev-plan-'+latest);
    setShareRow('cl-share-rev-plan', latest+'월 계획', coolRevPlan, totalRevPlan);

    // ② {latest}월 실적: 전체 실적(ov-use-act 등)이 같은 달에 업로드되어 있어야 계산 가능
    var d = HEAT_COOLING_DATA[latest] || {};
    var coolUseAct = d.usage !== undefined ? d.usage : null;
    var totalUseAct = ovActual('ov-use-act', latest);
    setShareRow('cl-share-use-act', latest+'월 실적', coolUseAct, totalUseAct);

    var coolRevAct = d.revenue !== undefined ? d.revenue : null;
    var totalRevAct = ovActual('ov-rev-act', latest);
    setShareRow('cl-share-rev-act', latest+'월 실적', coolRevAct, totalRevAct);

    // ③ 누적실적(~latest월): 냉방/전체 실적이 둘 다 있는 달만 합산
    var cumCoolUse=0, cumTotalUse=0, validUse=false;
    var cumCoolRev=0, cumTotalRev=0, validRev=false;
    months.forEach(function(m){
      var dm = HEAT_COOLING_DATA[m];
      var tUse = ovActual('ov-use-act', m);
      if (dm.usage !== undefined && tUse !== null){ cumCoolUse += dm.usage; cumTotalUse += tUse; validUse = true; }
      var tRev = ovActual('ov-rev-act', m);
      if (dm.revenue !== undefined && tRev !== null){ cumCoolRev += dm.revenue; cumTotalRev += tRev; validRev = true; }
    });
    setShareRow('cl-share-use-cum', '누적실적(~'+latest+'월)', validUse ? cumCoolUse : null, validUse ? cumTotalUse : null);
    setShareRow('cl-share-rev-cum', '누적실적(~'+latest+'월)', validRev ? cumCoolRev : null, validRev ? cumTotalRev : null);
  }


  function heatFmt(n){ return Math.round(n).toLocaleString('ko-KR'); }
  function heatParsePlan(id){
    var el = document.getElementById(id);
    if (!el) return 0;
    var v = Number(String(el.textContent).replace(/,/g,''));
    return isNaN(v) ? 0 : v;
  }

  // 계약종별(주택용/업무·공공용/소계) 실적값 계산: key는 'house'|'biz'|'sum', metric은 'usage'|'revenue'
  function heatMonthActual(month, key, metric){
    var d = HEAT_MONTH_DATA[month];
    if (!d) return null;
    var t = d.byType;
    function g(type){ return (t[type] ? t[type][metric] : 0) || 0; }
    var raw;
    if (key === 'house') raw = g('주택용');
    else if (key === 'biz') raw = g('업무용') + g('공공용');
    else raw = g('주택용') + g('업무용') + g('공공용');
    return metric === 'usage' ? raw/1000 : raw/1e6;
  }

  function handleHeatSalesFile(evt, month){
    var file = evt.target.files[0];
    if (!file) return;
    var statusEl = document.getElementById('heat-file-'+month+'-status');
    statusEl.textContent = '처리 중...';
    statusEl.className = 'hur-status';

    var reader = new FileReader();
    reader.onload = function(e){
      try{
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, {type:'array'});
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null});

        // 헤더 행 자동 탐색 ('계약종별' 컬럼이 있는 행)
        var headerRowIdx = -1;
        for (var i=0; i<Math.min(rows.length, 10); i++){
          if (rows[i] && rows[i].indexOf('계약종별') !== -1){ headerRowIdx = i; break; }
        }
        if (headerRowIdx === -1) throw new Error('헤더 행을 찾을 수 없습니다 (계약종별 컬럼 없음)');

        var header = rows[headerRowIdx];
        var idx = {};
        header.forEach(function(h,i){ if (h !== null && h !== undefined) idx[String(h).trim()] = i; });
        ['계약종별','지구명','당월사용량','열요금계'].forEach(function(n){
          if (idx[n] === undefined) throw new Error('필수 컬럼 누락: '+n);
        });

        var byType = {'주택용':{usage:0,revenue:0}, '업무용':{usage:0,revenue:0}, '공공용':{usage:0,revenue:0}};
        var byDistrict = {};
        // 지역별 판매현황: 주택용 판매량만 지구명이 '검단'인지 아닌지로 구분 (검단 아니면 전부 기존지구)
        var regionHouse = {'기존지구':0, '검단':0};
        var totalUsage = 0, totalRevenue = 0, rowCount = 0;

        for (var r = headerRowIdx+1; r < rows.length; r++){
          var row = rows[r];
          if (!row) continue;
          var type = row[idx['계약종별']];
          if (!type) continue;
          var usage = Number(row[idx['당월사용량']]) || 0;
          var revenue = Number(row[idx['열요금계']]) || 0;
          var district = row[idx['지구명']] || '기타';

          if (!byType[type]) byType[type] = {usage:0, revenue:0};
          byType[type].usage += usage;
          byType[type].revenue += revenue;

          if (!byDistrict[district]) byDistrict[district] = {usage:0, revenue:0};
          byDistrict[district].usage += usage;
          byDistrict[district].revenue += revenue;

          if (type === '주택용'){
            var regionKey = (district === '검단') ? '검단' : '기존지구';
            regionHouse[regionKey] += usage;
          }

          totalUsage += usage;
          totalRevenue += revenue;
          rowCount++;
        }
        if (rowCount === 0) throw new Error('유효한 데이터 행이 없습니다');

        HEAT_MONTH_DATA[month] = {byType:byType, byDistrict:byDistrict, regionHouse:regionHouse, totalUsage:totalUsage, totalRevenue:totalRevenue, rowCount:rowCount};
        statusEl.textContent = rowCount.toLocaleString('ko-KR')+'건 반영완료';
        statusEl.className = 'hur-status ok';

        renderHeatOverview();
        heatUpdateContractTable('ct', 'usage');
        heatUpdateContractTable('cr', 'revenue');
        heatUpdateRegionTable();
        heatUpdateCoolingShare();
        lsSave('heatMonth', HEAT_MONTH_DATA);
      }catch(err){
        statusEl.textContent = '오류: '+err.message;
        statusEl.className = 'hur-status err';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // ===== 열판매현황(첫 소버튼) 표 갱신: 월별 매출·판매량 계획/실적 =====
  function renderHeatOverview(){
    var uploadedMonths = Object.keys(HEAT_MONTH_DATA).map(Number);
    var latest = uploadedMonths.length ? Math.max.apply(null, uploadedMonths) : null;
    var cumRevAct = 0, cumUseAct = 0;

    for (var m=1; m<=12; m++){
      var d = HEAT_MONTH_DATA[m];
      var row = document.getElementById('ov-row-'+m);
      if (!row) continue;
      if (d){
        var revAct = d.totalRevenue/1e6;
        var useAct = d.totalUsage/1000;
        var revPlan = heatParsePlan('ov-rev-plan-'+m);
        var usePlan = heatParsePlan('ov-use-plan-'+m);
        var revRate = revPlan ? (revAct/revPlan*100) : 0;
        var useRate = usePlan ? (useAct/usePlan*100) : 0;

        var revActEl = document.getElementById('ov-rev-act-'+m);
        revActEl.textContent = heatFmt(revAct); revActEl.className = '';
        var revRateEl = document.getElementById('ov-rev-rate-'+m);
        revRateEl.textContent = Math.round(revRate)+'%'; revRateEl.className = revRate >= 100 ? 'rate-good' : 'rate-bad';

        var useActEl = document.getElementById('ov-use-act-'+m);
        useActEl.textContent = heatFmt(useAct); useActEl.className = '';
        var useRateEl = document.getElementById('ov-use-rate-'+m);
        useRateEl.textContent = Math.round(useRate)+'%'; useRateEl.className = useRate >= 100 ? 'rate-good' : 'rate-bad';

        row.classList.toggle('current', m === latest);
        cumRevAct += revAct; cumUseAct += useAct;
      } else {
        row.classList.remove('current');
      }
    }

    if (uploadedMonths.length){
      var revTotalEl = document.getElementById('ov-rev-act-total');
      revTotalEl.textContent = heatFmt(cumRevAct); revTotalEl.className = '';
      var useTotalEl = document.getElementById('ov-use-act-total');
      useTotalEl.textContent = heatFmt(cumUseAct); useTotalEl.className = '';
    }
  }

  // ===== 계약종별 판매량/매출 표 + 누계 KPI 카드 갱신 =====
  // prefix: 'ct'(계약종별 판매량, Gcal) | 'cr'(계약종별 매출, 백만원) / metric: 'usage' | 'revenue'
  function heatUpdateContractTable(prefix, metric){
    var keys = ['house','biz','sum'];
    var uploadedMonths = Object.keys(HEAT_MONTH_DATA).map(Number);
    var latest = uploadedMonths.length ? Math.max.apply(null, uploadedMonths) : null;

    keys.forEach(function(key){
      var cumPlan = 0, cumAct = 0;
      for (var m=1; m<=12; m++){
        var row = document.getElementById(prefix+'-'+key+'-row-'+m);
        if (!row) continue;
        var plan = heatParsePlan(prefix+'-'+key+'-plan-'+m);
        var d = HEAT_MONTH_DATA[m];
        if (d){
          var act = heatMonthActual(m, key, metric);
          var diff = act - plan;
          var rate = plan ? (act/plan*100) : 0;

          document.getElementById(prefix+'-'+key+'-act-'+m).textContent = heatFmt(act);
          var diffEl = document.getElementById(prefix+'-'+key+'-diff-'+m);
          diffEl.textContent = (diff >= 0 ? '▲' : '▼') + heatFmt(Math.abs(diff));
          diffEl.className = diff >= 0 ? 'diff-good' : 'diff-bad';
          var rateEl = document.getElementById(prefix+'-'+key+'-rate-'+m);
          rateEl.textContent = Math.round(rate)+'%';
          rateEl.className = 'rate-badge ' + (rate >= 100 ? 'good' : 'bad');

          row.classList.remove('future');
          row.classList.toggle('current', m === latest);
          cumPlan += plan;
          cumAct += act;
        } else {
          row.classList.add('future');
          row.classList.remove('current');
        }
      }

      var badgeEl = document.getElementById(prefix+'-'+key+'-kpi-badge');
      var valueEl = document.getElementById(prefix+'-'+key+'-kpi-value');
      var planEl = document.getElementById(prefix+'-'+key+'-kpi-plan');
      var diffEl2 = document.getElementById(prefix+'-'+key+'-kpi-diff');
      if (uploadedMonths.length){
        var rate2 = cumPlan ? (cumAct/cumPlan*100) : 0;
        var diff2 = cumAct - cumPlan;
        valueEl.textContent = heatFmt(cumAct);
        planEl.textContent = heatFmt(cumPlan);
        diffEl2.textContent = (diff2 >= 0 ? '▲' : '▼') + heatFmt(Math.abs(diff2));
        diffEl2.className = diff2 >= 0 ? 'diff-good' : 'diff-bad';
        badgeEl.textContent = (rate2 >= 100 ? '▲ ' : '▼ ') + rate2.toFixed(1) + '%';
        badgeEl.className = 'rate-badge ' + (rate2 >= 100 ? 'good' : 'bad');
      } else {
        valueEl.textContent = '-'; planEl.textContent = '-';
        diffEl2.textContent = '-'; diffEl2.className = 'dim';
        badgeEl.textContent = '-'; badgeEl.className = 'rate-badge dim';
      }
    });

    var noteEl = document.getElementById(prefix+'-unit-note');
    if (noteEl){
      var unitLabel = metric === 'usage' ? 'Gcal' : '백만원';
      if (uploadedMonths.length){
        var minM = Math.min.apply(null, uploadedMonths), maxM = Math.max.apply(null, uploadedMonths);
        noteEl.textContent = '단위: '+unitLabel+' | 누계('+minM+'~'+maxM+'월) 기준 실적 요약';
      } else {
        noteEl.textContent = '단위: '+unitLabel+' | 업로드된 실적 없음 (데이터 탭에서 업로드)';
      }
    }
  }

  // ===== 지역별 판매현황 표 + 누계 KPI 카드 갱신 (주택용 판매량만, 검단 vs 기존지구) =====
  function heatUpdateRegionTable(){
    var keys = {'existing':'기존지구', 'gd':'검단'};
    var uploadedMonths = Object.keys(HEAT_MONTH_DATA).map(Number);
    var latest = uploadedMonths.length ? Math.max.apply(null, uploadedMonths) : null;

    Object.keys(keys).forEach(function(key){
      var districtLabel = keys[key];
      var tkey = 'rg-'+key;
      var cumPlan = 0, cumAct = 0;
      for (var m=1; m<=12; m++){
        var row = document.getElementById(tkey+'-row-'+m);
        if (!row) continue;
        var plan = heatParsePlan(tkey+'-plan-'+m);
        var d = HEAT_MONTH_DATA[m];
        if (d && d.regionHouse){
          var act = d.regionHouse[districtLabel]/1000;
          var diff = act - plan;
          var rate = plan ? (act/plan*100) : 0;

          document.getElementById(tkey+'-act-'+m).textContent = heatFmt(act);
          var diffEl = document.getElementById(tkey+'-diff-'+m);
          diffEl.textContent = (diff >= 0 ? '▲' : '▼') + heatFmt(Math.abs(diff));
          diffEl.className = diff >= 0 ? 'diff-good' : 'diff-bad';
          var rateEl = document.getElementById(tkey+'-rate-'+m);
          rateEl.textContent = Math.round(rate)+'%';
          rateEl.className = 'rate-badge ' + (rate >= 100 ? 'good' : 'bad');

          row.classList.remove('future');
          row.classList.toggle('current', m === latest);
          cumPlan += plan;
          cumAct += act;
        } else {
          row.classList.add('future');
          row.classList.remove('current');
        }
      }

      var badgeEl = document.getElementById(tkey+'-kpi-badge');
      var valueEl = document.getElementById(tkey+'-kpi-value');
      var planEl = document.getElementById(tkey+'-kpi-plan');
      var diffEl2 = document.getElementById(tkey+'-kpi-diff');
      if (uploadedMonths.length){
        var rate2 = cumPlan ? (cumAct/cumPlan*100) : 0;
        var diff2 = cumAct - cumPlan;
        valueEl.textContent = heatFmt(cumAct);
        planEl.textContent = heatFmt(cumPlan);
        diffEl2.textContent = (diff2 >= 0 ? '▲' : '▼') + heatFmt(Math.abs(diff2));
        diffEl2.className = diff2 >= 0 ? 'diff-good' : 'diff-bad';
        badgeEl.textContent = (rate2 >= 100 ? '▲ ' : '▼ ') + rate2.toFixed(1) + '%';
        badgeEl.className = 'rate-badge ' + (rate2 >= 100 ? 'good' : 'bad');
      } else {
        valueEl.textContent = '-'; planEl.textContent = '-';
        diffEl2.textContent = '-'; diffEl2.className = 'dim';
        badgeEl.textContent = '-'; badgeEl.className = 'rate-badge dim';
      }
    });

    var noteEl = document.getElementById('rg-unit-note');
    if (noteEl){
      if (uploadedMonths.length){
        var minM = Math.min.apply(null, uploadedMonths), maxM = Math.max.apply(null, uploadedMonths);
        noteEl.textContent = '판매량 단위: Gcal | 누계('+minM+'~'+maxM+'월) 기준 실적 요약 (주택용 기준)';
      } else {
        noteEl.textContent = '판매량 단위: Gcal | 업로드된 실적 없음 (데이터 탭에서 업로드)';
      }
    }
  }
