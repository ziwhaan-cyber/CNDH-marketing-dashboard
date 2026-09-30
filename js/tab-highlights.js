// [v2 추가] 탭별 '핵심 한 줄'과 표 안의 강조
// 표만 있는 탭은 어디부터 봐야 할지 보이지 않아서, 탭마다 가장 중요한 숫자 하나를 소버튼 줄 오른쪽에 크게 적고
// 표 안에서는 연체 단계·이번 달·최고치를 색으로 짚어 준다. 계산은 이미 화면에 있는 데이터로만 한다.
(function(){
  var esc=function(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
  var n=function(x){ return Number(x||0).toLocaleString('ko-KR'); };
  var eok=function(w){ return w>=1e8 ? (w/1e8).toFixed(1)+'억원' : w>=1e4 ? n(Math.round(w/1e4))+'만원' : n(w)+'원'; };
  var pct=function(a,b){ return b ? Math.round(a/b*100) : 0; };

  // 소버튼 줄 오른쪽 자리를 만든다
  function slot(pageId){
    var sub=document.querySelector('#'+pageId+' .page-top .subnav'); if(!sub) return null;
    var el=sub.querySelector('.tab-hl');
    if(!el){ el=document.createElement('div'); el.className='tab-hl'; sub.appendChild(el); }
    return el;
  }
  function put(el,html){ if(!el) return; el.innerHTML=html?'<span class="hl-lbl">핵심</span>'+html:''; el.hidden=!html; }
  function active(pageId,attr){ var b=document.querySelector('#'+pageId+' .subnav-btn.active'); return b?b.getAttribute(attr):''; }

  /* ---------- 고객관리(연체) ---------- */
  function arrLine(){
    var tab=active('page-arrears','data-arr-tab');
    if(tab==='arr-tab-status'){
      var rows=lsLoad('arrearsRows',null); if(!rows||!rows.length) return '';
      var tot=0, lc=0, la=0, mc=0;
      rows.forEach(function(r){ var m=Number(r['연체개월'])||0, a=Number(r['합계'])||0; tot+=a; if(m>=6){ lc++; la+=a; } else if(m>=3) mc++; });
      return lc
        ? '<span class="hl-it">장기(6개월 이상) <b>'+n(lc)+'개소</b> · '+eok(la)+' <em>전체 금액의 '+pct(la,tot)+'%</em></span>'
        : '<span class="hl-it">장기 연체 없음 · 중기(3~5개월) <b>'+n(mc)+'개소</b>가 가장 무거운 단계</span>';
    }
    if(tab==='arr-tab-notice'){
      if(typeof NT_ROWS==='undefined'||!NT_ROWS.length) return '<span class="hl-it muted">① 미납내역 엑셀을 올리면 안내 대상이 채워집니다</span>';
      var one=NT_ROWS.filter(function(r){ return r.n===1; }).length, two=NT_ROWS.length-one;
      var noMail=NT_ROWS.filter(function(r){ return !r.email; }).length;
      return '<span class="hl-it">안내 대상 <b>'+n(NT_ROWS.length)+'개소</b> <em>1개월 '+one+' · 2개월 '+two+'</em></span>'
        +(noMail?'<span class="hl-it warn">이메일 없음 <b>'+noMail+'</b></span>':'');
    }
    if(tab==='arr-tab-overdue'){
      // 미납관리 화면이 저장하는 요약(count·amount·longTerm)만 읽는다
      var m=homeRead('minap_summary'); if(!m) return '<span class="hl-it muted">엑셀을 올리면 미납 현황이 채워집니다</span>';
      return '<span class="hl-it">미납 금액 <b>'+eok(m.amount)+'</b></span>'
        +(m.longTerm?'<span class="hl-it">3개월 이상 <b>'+n(m.longTerm)+'개소</b></span>':'');
    }
    return '';
  }

  /* ---------- 고객관리(민원) ---------- */
  function vocLine(){
    var tab=active('page-voc','data-voc-tab');
    if(typeof DATA==='undefined'||!DATA.length) return '';
    var months=allDataMonths(), key=months[months.length-1];
    var y=+key.slice(0,4), mi=+key.slice(5,7)-1, py=mi?y:y-1, pm=mi?mi-1:11, pk=moKey(py,pm);
    var cut=(typeof vocTrendPartialDay!=='undefined')?vocTrendPartialDay:0;
    var inCut=function(r){ return !cut||parseInt(String(r.date).slice(8,10),10)<=cut; };
    if(tab==='voc-overview'){
      var cur=0, prv=0, ck={}, pkw={};
      DATA.forEach(function(r){
        if(r.haedangwol===key){ cur++; ck[r.kw]=(ck[r.kw]||0)+1; }
        else if(r.haedangwol===pk&&inCut(r)){ prv++; pkw[r.kw]=(pkw[r.kw]||0)+1; }
      });
      var d=cur-prv, top=Object.keys(ck).map(function(k){ return {k:k,d:ck[k]-(pkw[k]||0)}; }).sort(function(a,b){ return b.d-a.d; })[0];
      return '<span class="hl-it">'+(mi+1)+'월'+(cut?' 1~'+cut+'일':'')+' <b>'+n(cur)+'건</b> <em class="'+(d>0?'up':'dn')+'">전월 같은 기간 '+(d>0?'+':'')+n(d)+'건 ('+(d>0?'▲':'▼')+Math.abs(pct(d,prv))+'%)</em></span>'
        +(top&&top.d>0?'<span class="hl-it">가장 늘어난 키워드 <b>'+esc(top.k)+'</b> <em class="up">+'+top.d+'</em></span>':'');
    }
    if(tab==='voc-voucher'){
      var ms=recentMonths(12), vs=ms.map(function(m){ return (monthByKw(m.y,m.mi,null)['에너지바우처'])||0; });
      var tots=ms.map(function(m){ return monthTotal(m.y,m.mi,null); });
      var pi=vs.indexOf(Math.max.apply(null,vs));
      return '<span class="hl-it">에너지바우처 최다 <b>'+ms[pi].label+' '+vs[pi]+'건</b> <em>그달 민원의 '+pct(vs[pi],tots[pi])+'%</em></span>'
        +'<span class="hl-it">이번 달 <b>'+vs[vs.length-1]+'건</b></span>';
    }
    if(tab==='voc-monitor'){
      var v=homeRead('voc_im_summary'); if(!v) return '';
      return (v.topIssue?'<span class="hl-it">뜬 이슈 <b>'+n(v.issues)+'건</b> <em>가장 큰 것 · '+esc(v.topIssue)+'</em></span>':'<span class="hl-it">뜬 이슈 없음</span>')
        +(v.sites?'<span class="hl-it warn">다발 단지 <b>'+esc(v.sites)+'</b></span>':'');
    }
    if(tab==='voc-data'){
      return '<span class="hl-it">등록된 민원 <b>'+n(DATA.length)+'건</b> <em>'+months[0]+' ~ '+key+'</em></span>';
    }
    return '';
  }

  /* ---------- 표 안의 강조 ---------- */
  function markArrTable(){
    var body=document.getElementById('arr-table-body'); if(!body) return;
    [].forEach.call(body.rows,function(tr){
      var m=parseInt(tr.cells[0]&&tr.cells[0].textContent,10);
      tr.classList.toggle('stage-mid', m>=3&&m<=5); tr.classList.toggle('stage-long', m>=6);
    });
    var lb=document.getElementById('fc-long-count'), mb=document.getElementById('fc-mid-count');
    if(lb) lb.parentNode.classList.toggle('stage-long', /\d/.test(lb.textContent)&&parseInt(lb.textContent,10)>0);
    if(mb) mb.parentNode.classList.toggle('stage-mid', /\d/.test(mb.textContent)&&parseInt(mb.textContent,10)>0);
  }
  function markVoucher(){
    ['voc-sum-trend','voc-sum-vtype'].forEach(function(id){
      var head=document.getElementById(id+'-head'), body=document.getElementById(id+'-body'); if(!head||!body) return;
      var last=head.children.length-1;
      [head].concat([].slice.call(body.rows)).forEach(function(tr){ [].forEach.call(tr.children,function(td,i){ td.classList.toggle('cur-col', i===last&&i>0); }); });
    });
    // 에너지바우처 줄의 최고치
    var vb=document.getElementById('voc-sum-trend-body'), vr=vb&&vb.rows[1]; if(!vr) return;
    var cells=[].slice.call(vr.cells,1), vals=cells.map(function(c){ return parseInt(c.textContent.replace(/,/g,''),10)||0; });
    var mx=Math.max.apply(null,vals);
    cells.forEach(function(c,i){ c.classList.toggle('peak', mx>0&&vals[i]===mx); });
  }

  function render(){
    try{ put(slot('page-arrears'),arrLine()); }catch(e){}
    try{ put(slot('page-voc'),vocLine()); }catch(e){}
    try{ markArrTable(); }catch(e){}
    try{ markVoucher(); }catch(e){}
  }
  window.renderTabHighlights=render;

  // 기존 함수는 그대로 두고, 끝난 뒤에 한 번씩 다시 그린다
  ['showArrTab','showVocTab','renderArrearsFromRows','vocRunAll','ntRefreshAll','renderHome'].forEach(function(name){
    var f=window[name]; if(typeof f!=='function') return;
    window[name]=function(){ var r=f.apply(this,arguments); try{ render(); }catch(e){} return r; };
  });
  window.addEventListener('storage',function(){ setTimeout(render,50); });
  document.addEventListener('DOMContentLoaded',function(){ setTimeout(render,0); });
})();
