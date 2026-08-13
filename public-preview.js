(()=>{
const $=s=>document.querySelector(s);
const entry=$('#entryView');
const topbar=$('.modern-topbar')||$('.topbar');

document.body.classList.add('public-preview-mode');

function go(id){const el=document.getElementById(id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'})}

function rebuildNav(){
  if(!topbar)return;
  let nav=$('#academyTopNav');
  if(!nav){nav=document.createElement('nav');nav.id='academyTopNav';nav.className='top-nav';topbar.appendChild(nav)}
  nav.innerHTML=`
    <a href="#publicNotices" data-go="publicNotices">학원공지</a>
    <a href="#qaPreview" data-go="qaPreview">질의응답</a>
    <a href="https://ipsywan.com/" target="_blank" rel="noopener">입시의완</a>
    <a href="./placement/">정시배치표</a>
    <a href="#publicSchedules" data-go="publicSchedules">시험일정</a>
    <a href="./meal/">오늘의 식단</a>
    <a href="#dailyTest" data-go="dailyTest">일일테스트</a>`;
  nav.querySelectorAll('[data-go]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();go(a.dataset.go)}));
}

function injectPublicHome(){
  if(!entry||$('#publicHomeInfo'))return;
  const ticker=document.createElement('section');
  ticker.id='noticeTicker';ticker.className='notice-ticker';ticker.setAttribute('aria-label','최근 공지사항');
  ticker.innerHTML=`<div class="notice-ticker-label"><i></i><span>최근 공지</span></div><div id="noticeViewport" class="notice-viewport"><div id="noticeTrack" class="notice-track"><div class="notice-empty">최근 공지사항을 불러오는 중입니다.</div></div></div><button id="noticeMore" class="notice-more" type="button">전체보기 →</button>`;
  entry.querySelector('.role-guide')?.insertAdjacentElement('beforebegin',ticker);

  const info=document.createElement('section');info.id='publicHomeInfo';info.className='public-home-info';
  info.innerHTML=`
  <div class="public-home-info-head"><div><small>ACADEMY LIFE GUIDE</small><h2>오늘의 학원생활</h2></div><p>현재는 전체 화면을 공개 미리보기로 운영합니다. 실제 서비스 완성 단계에서 교사·학생·마스터 로그인과 권한을 다시 연결할 예정입니다.</p></div>

  <section id="publicNotices" class="info-section"><div class="info-kicker"><small>01 · NOTICE</small><h3>학원공지</h3><p>공개 대상으로 등록된 최근 공지를 바로 확인합니다.</p></div><div id="publicNoticeList" class="public-list"><div class="public-empty">공지사항을 불러오는 중입니다.</div></div></section>

  <section id="publicSchedules" class="info-section"><div class="info-kicker"><small>02 · EXAM SCHEDULE</small><h3>시험일정</h3><p>공개 설정된 모의고사·시험일정을 날짜순으로 표시합니다.</p></div><div id="publicScheduleList" class="public-list"><div class="public-empty">시험일정을 불러오는 중입니다.</div></div></section>

  <section id="dailyTest" class="info-section"><div class="info-kicker"><small>03 · DAILY TEST</small><h3>일일테스트</h3><p>전주 · 금주 · 다음주 3주 범위를 한 번에 확인합니다. 일요일은 평가가 없습니다.</p></div><div><div id="dailyTestBoard" class="daily-test-board"></div><p class="temporary-note">※ 워드마스터 수능2000 범위와 듣기평가는 임시 편성입니다. 실제 진도에 맞춰 조정할 수 있습니다.</p></div></section>

  <section id="academySchedule" class="info-section"><div class="info-kicker"><small>04 · DAILY SCHEDULE</small><h3>학원 운영시간표</h3><p>기본 운영시간을 기준으로 한 임시 시간표입니다.</p></div><div><div class="schedule-list">
    <div class="schedule-row"><time>07:40 — 08:00</time><strong>등원 · 학습 준비</strong><span>출결 확인, 휴대전화 보관, 당일 계획 점검</span></div>
    <div class="schedule-row"><time>08:00 — 10:00</time><strong>오전 집중학습 Ⅰ</strong><span>개인 계획에 따른 인강·문제풀이 중심 학습</span></div>
    <div class="schedule-row"><time>10:10 — 12:00</time><strong>오전 집중학습 Ⅱ</strong><span>과목별 학습과 질문 내용 정리</span></div>
    <div class="schedule-row"><time>12:00 — 13:00</time><strong>점심시간</strong><span>식사 및 휴식, 지정된 시간에 재입실</span></div>
    <div class="schedule-row"><time>13:00 — 16:00</time><strong>오후 집중학습</strong><span>주요 과목 학습과 당일 진도 수행</span></div>
    <div class="schedule-row"><time>16:10 — 18:00</time><strong>질문 · 보완학습</strong><span>질의응답, 오답 보완, 일일테스트 준비</span></div>
    <div class="schedule-row"><time>18:00 — 19:00</time><strong>저녁시간</strong><span>식사 및 휴식, 야간학습 준비</span></div>
    <div class="schedule-row"><time>19:00 — 22:00</time><strong>야간 자율학습</strong><span>당일 학습 마무리 및 다음 날 계획 확인</span></div>
  </div><p class="temporary-note">※ 임시 운영시간표입니다. 실제 교시 운영에 맞춰 수정 예정입니다.</p></div></section>

  <section id="qaPreview" class="info-section"><div class="info-kicker"><small>05 · Q&A</small><h3>질의응답</h3><p>현재는 개인정보를 노출하지 않는 공개 미리보기 화면입니다.</p></div><div class="qa-preview-grid">
    <article class="guide-card"><b>Q</b><h4>질문 등록</h4><p>과목을 선택하고 질문 제목·내용을 입력하는 학생용 질문 화면을 구성합니다.</p></article>
    <article class="guide-card"><b>A</b><h4>교사 답변</h4><p>교사는 질문 목록을 확인하고 답변·처리상태를 관리하는 화면을 사용합니다.</p></article>
    <article class="guide-card"><b>✓</b><h4>진행상태</h4><p>질문 중 · 답변 완료 · 종료 상태를 구분하고 실제 학생 데이터는 로그인 적용 후 노출합니다.</p></article>
  </div></section>

  <section id="academyEtiquette" class="info-section"><div class="info-kicker"><small>06 · ETIQUETTE</small><h3>학원생활 에티켓</h3><p>서로의 집중시간을 지키기 위한 기본 생활수칙입니다.</p></div><div class="etiquette-grid">
    <article class="etiquette-card"><b>01</b><h4>휴대전화 보관</h4><p>등원 후 지정 장소에 보관하고 필요한 경우 교사의 안내에 따라 사용합니다.</p></article>
    <article class="etiquette-card"><b>02</b><h4>정숙한 학습공간</h4><p>교시 중 대화와 불필요한 이동을 줄여 주변 학생의 학습을 방해하지 않습니다.</p></article>
    <article class="etiquette-card"><b>03</b><h4>시간 준수</h4><p>등원, 교시 시작, 식사 후 복귀 시간을 지켜 학습 흐름을 유지합니다.</p></article>
    <article class="etiquette-card"><b>04</b><h4>좌석 정리</h4><p>개인 좌석과 공용공간을 깨끗하게 사용하고 퇴실 전 주변을 정리합니다.</p></article>
    <article class="etiquette-card"><b>05</b><h4>질문과 이동</h4><p>질문과 상담은 지정된 시간과 공간을 이용하고 이동 시 조용히 이동합니다.</p></article>
    <article class="etiquette-card"><b>06</b><h4>배려와 존중</h4><p>교사와 학생 모두 서로의 학습목표와 생활환경을 존중하는 언어를 사용합니다.</p></article>
  </div></section>

  <section id="academyGuide" class="info-section"><div class="info-kicker"><small>07 · LIFE INFO</small><h3>생활 안내</h3><p>학원생활에서 자주 확인하는 내용을 임시로 정리했습니다.</p></div><div class="guide-grid">
    <article class="guide-card"><b>A</b><h4>급식</h4><p>상단 ‘오늘의 식단’에서 오늘 기준 전후 3일의 점심·저녁 메뉴를 확인합니다.</p></article>
    <article class="guide-card"><b>B</b><h4>질의응답</h4><p>질문 화면은 현재 공개 미리보기이며, 실제 학생별 질문은 로그인 적용 후 연결합니다.</p></article>
    <article class="guide-card"><b>C</b><h4>외출 · 조퇴</h4><p>외출과 조퇴가 필요한 경우 담당 교사에게 먼저 알리고 절차에 따라 처리합니다.</p></article>
    <article class="guide-card"><b>D</b><h4>상담</h4><p>학습·성적·입시 상담이 필요한 경우 담당 교사에게 상담일정을 요청합니다.</p></article>
    <article class="guide-card"><b>E</b><h4>분실물</h4><p>분실물은 데스크에 신고하고 습득물은 임의 보관하지 않고 바로 전달합니다.</p></article>
    <article class="guide-card"><b>F</b><h4>건강 · 응급상황</h4><p>몸이 불편하거나 응급상황이 생기면 즉시 가까운 교사나 데스크에 알립니다.</p></article>
  </div><p class="temporary-note">※ 생활 안내 문구는 임시 입력본입니다.</p></section>`;
  entry.insertAdjacentElement('afterend',info);
}

rebuildNav();
injectPublicHome();
setTimeout(rebuildNav,50);
})();
