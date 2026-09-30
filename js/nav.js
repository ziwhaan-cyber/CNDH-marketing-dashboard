// 페이지 전환 · 시연 모드 표시 — index.html 안에 있던 스크립트를 그대로 옮김
  // [v2 추가] 시연 모드 — 주소 끝에 ?demo=1 이 있을 때만 켜진다(평소 화면에는 영향 없음).
  // 저장 이름 앞에 'demo_'를 붙여 실제로 올린 데이터와 절대 섞이지 않게 한다.
  var DEMO = /[?&]demo=1(&|$)/.test(location.search);
  var DEMO_PFX = DEMO ? 'demo_' : '';

  // [v2] '엑셀 업로드' 버튼 옆에 브라우저 기본 '파일 선택 · 선택된 파일 없음' 칸이 또 보여 중복이었다.
  // 기본 칸은 CSS로 숨기고(버튼이 그 칸을 연다), 고른 파일 이름만 버튼 옆에 작게 보여준다.
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.upload-inline input[type=file], .nt-row input[type=file], .voc-upload input[type=file]').forEach(function(inp){
      var nm=document.createElement('span'); nm.className='file-name';
      inp.parentNode.insertBefore(nm, inp.nextSibling);
      inp.addEventListener('change', function(){ nm.textContent = inp.files && inp.files[0] ? inp.files[0].name : ''; });
    });
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
