// 페이지 전환 · 시연 모드 표시 — index.html 안에 있던 스크립트를 그대로 옮김
  // [v2 추가] 시연 모드 — 주소 끝에 ?demo=1 이 있을 때만 켜진다(평소 화면에는 영향 없음).
  // 저장 이름 앞에 'demo_'를 붙여 실제로 올린 데이터와 절대 섞이지 않게 한다.
  var DEMO = /[?&]demo=1(&|$)/.test(location.search);
  var DEMO_PFX = DEMO ? 'demo_' : '';

  // [v2] 16:9 화면 맞춤 — 글자·칸 크기가 모두 창 너비(vw) 기준인데, 창이 16:9보다 넓으면(주소창·작업표시줄 때문에 보통 그렇다)
  // 화면 틀만 좁아지고 글자는 그대로라 칸이 넘쳐 아래가 잘렸다(추이 그래프가 눌리고 AI 인사이트 글자가 잘림).
  // 틀을 항상 창 너비로 그린 뒤 통째로 줄여서(zoom) 글자와 칸이 같은 비율로 작아지게 한다.
  function fitSlide(){
    var s=document.querySelector('.slide'); if(!s) return;
    var W=window.innerWidth, H=window.innerHeight;
    var target=Math.min(W, 1920, (H-2)*16/9);           // 원래 규칙과 같은 크기: 창 너비·1920px·창 높이×16/9 중 작은 값
    s.style.zoom=(target/W).toFixed(4);
  }
  document.addEventListener('DOMContentLoaded', fitSlide);
  window.addEventListener('resize', fitSlide);

  // [v2] '엑셀 업로드' 버튼 옆에 브라우저 기본 '파일 선택 · 선택된 파일 없음' 칸이 또 보여 중복이었다.
  // 기본 칸은 CSS로 숨기고(버튼이 그 칸을 연다), 고른 파일 이름만 버튼 옆에 작게 보여준다.
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.upload-inline input[type=file], .nt-row input[type=file], .voc-upload input[type=file]').forEach(function(inp){
      var nm=document.createElement('span'); nm.className='file-name';
      inp.parentNode.insertBefore(nm, inp.nextSibling);
      inp.addEventListener('change', function(){ nm.textContent = inp.files && inp.files[0] ? inp.files[0].name : ''; });
    });
  });

  // [v2] 화면별 강조색 — 현황·미납관리·이슈 모니터링은 스틸 블루, 나머지 화면은 딥 티얼(theme.css의 [data-tone=steel]).
  // 탭을 바꾸는 방법이 여러 곳(버튼·현황 카드·데일리 체크)이라 함수마다 넣지 않고, 화면 표시가 바뀌는 것을 지켜본다.
  function applyTone(){
    var on=function(id){ var e=document.getElementById(id); return !!(e&&e.classList.contains('active')); };
    var steel = on('page-home') || (on('page-arrears')&&on('arr-tab-overdue')) || (on('page-voc')&&on('voc-monitor'));
    var tone = steel ? 'steel' : '';
    if ((document.documentElement.getAttribute('data-tone')||'') === tone) return;
    if (tone) document.documentElement.setAttribute('data-tone', tone); else document.documentElement.removeAttribute('data-tone');
    if (typeof drawVocTrendChart === 'function') { try{ drawVocTrendChart(); }catch(e){} }   // 그림으로 그린 추이 차트는 색을 다시 칠함
  }
  document.addEventListener('DOMContentLoaded', function(){
    applyTone();
    new MutationObserver(applyTone).observe(document.body, {subtree:true, attributes:true, attributeFilter:['class']});
  });

  // [신규] 페이지 전환 로직: 클릭한 버튼의 data-target에 해당하는 .page만 보이게 전환
  // [추가] 홈 카드 → 해당 페이지와 탭으로 이동
  function goHome(pageId,kind,tabId){
    var pb=document.querySelector('.page-btn[data-target="'+pageId+'"]');
    if(pb)showPage(pb);
    var sel=(kind==='arr')?'[data-arr-tab="'+tabId+'"]':'[data-voc-tab="'+tabId+'"]';
    var tb=document.querySelector('#'+pageId+' '+sel);
    if(tb){ tb.click(); }
  }

  function showPage(btn){
    var targetId = btn.getAttribute('data-target');

    // 모든 버튼에서 active 제거 후, 클릭한 버튼에만 부여
    document.querySelectorAll('.page-btn').forEach(function(b){
      b.classList.remove('active');
    });
    btn.classList.add('active');

    // 모든 페이지 숨기고, 대상 페이지만 표시
    document.querySelectorAll('.page').forEach(function(p){
      p.classList.remove('active');
    });
    document.getElementById(targetId).classList.add('active');
  }

  // [신규] 열판매현황 내부 소버튼(서브탭) 전환 로직
  function showHeatTab(btn){
    var target = btn.getAttribute('data-heat-tab');
    document.querySelectorAll('#page-heat .subnav-btn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    document.querySelectorAll('#page-heat .heat-tab').forEach(function(t){ t.classList.remove('active'); });
    document.getElementById(target).classList.add('active');
  }
