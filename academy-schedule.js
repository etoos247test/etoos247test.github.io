(()=>{
const DATA_URL='./academy-schedule.json?v=20260813a';
const WEEK=['일','월','화','수','목','금','토'];
const MONTH_DAY=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric'});
const FULL_DATE=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'long'});

function loadCss(){
  if(document.querySelector('link[data-academy-schedule-css]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='./academy-schedule.css?v=20260813a';link.dataset.academyScheduleCss='1';
  document.head.appendChild(link);
}
function ymdSeoulNow(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const o=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return `${o.year}-${o.month}-${o.day}`;
}
function parseYmd(s){const [y,m,d]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1,d,12));}
function toYmd(d){return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;}
function shift(s,n){const d=parseYmd(s);d.setUTCDate(d.getUTCDate()+n);return toYmd(d)}
function dayIndex(s){return parseYmd(s).getUTCDay()}
function formatFull(s){return FULL_DATE.format(new Date(`${s}T12:00:00+09:00`))}
function formatMD(s){return MONTH_DAY.format(new Date(`${s}T12:00:00+09:00`))}
function weekDates(s){
  const dow=dayIndex(s); const mondayOffset=dow===0?-6:1-dow;
  return Array.from({length:7},(_,i)=>shift(s,mondayOffset+i));
}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

function fallback(){return {timezone:'Asia/Seoul',standardSchedule:[
  {time:'07:40 — 08:00',title:'등원 · 학습 준비',detail:'출결 확인, 휴대전화 보관, 당일 계획 점검'},
  {time:'08:00 — 10:00',title:'오전 집중학습 Ⅰ',detail:'개인 계획에 따른 인강·문제풀이 중심 학습'},
  {time:'10:10 — 12:00',title:'오전 집중학습 Ⅱ',detail:'과목별 학습과 질문 내용 정리'},
  {time:'12:00 — 13:00',title:'점심시간',detail:'식사 및 휴식, 지정된 시간에 재입실'},
  {time:'13:00 — 16:00',title:'오후 집중학습',detail:'주요 과목 학습과 당일 진도 수행'},
  {time:'16:10 — 18:00',title:'질문 · 보완학습',detail:'질의응답, 오답 보완, 일일테스트 준비'},
  {time:'18:00 — 19:00',title:'저녁시간',detail:'식사 및 휴식, 야간학습 준비'},
  {time:'19:00 — 22:00',title:'야간 자율학습',detail:'당일 학습 마무리 및 다음 날 계획 확인'}
],weekdays:{'0':{label:'일요일 단축 운영',open:'07:40',close:'18:00',schedule:[
  {time:'07:40 — 08:00',title:'등원 · 학습 준비',detail:'출결 확인, 당일 계획 점검'},
  {time:'08:00 — 10:00',title:'오전 집중학습 Ⅰ',detail:'개인 계획 학습'},
  {time:'10:10 — 12:00',title:'오전 집중학습 Ⅱ',detail:'과목별 학습과 질문 정리'},
  {time:'12:00 — 13:00',title:'점심시간',detail:'식사 및 휴식'},
  {time:'13:00 — 15:30',title:'오후 집중학습',detail:'주요 과목 학습'},
  {time:'15:40 — 17:30',title:'보완학습 · 주간정리',detail:'오답 보완과 다음 주 계획'},
  {time:'17:30 — 18:00',title:'학습 마무리 · 퇴실',detail:'18:00 운영 종료'}
]},'1':{label:'평일 운영',open:'07:40',close:'22:00'},'2':{label:'평일 운영',open:'07:40',close:'22:00'},'3':{label:'평일 운영',open:'07:40',close:'22:00'},'4':{label:'평일 운영',open:'07:40',close:'22:00'},'5':{label:'평일 운영',open:'07:40',close:'22:00'},'6':{label:'토요일 운영',open:'07:40',close:'22:00'}},events:{}}}

function effective(cfg,date){
  const base=cfg.weekdays?.[String(dayIndex(date))]||{};
  const event=cfg.events?.[date]||null;
  const schedule=event?.schedule || base.schedule || cfg.standardSchedule || [];
  return {
    label:event?.title || base.label || cfg.defaultLabel || '기본 운영',
    note:event?.note || (event?'특정 날짜 이벤트 운영시간표를 적용합니다.':`${WEEK[dayIndex(date)]}요일 기본 운영시간표입니다.`),
    open:event?.open ?? base.open ?? '07:40', close:event?.close ?? base.close ?? '22:00',
    closed:Boolean(event?.closed), schedule, event
  };
}

function renderRows(root,eff){
  if(eff.closed){root.className='schedule-list dynamic-schedule is-closed';root.innerHTML=`<div class="schedule-closed-title">휴원 · 운영 없음</div><div class="schedule-closed-note">${escapeHtml(eff.note)}</div>`;return}
  root.className='schedule-list dynamic-schedule';
  root.innerHTML=eff.schedule.map(r=>`<div class="schedule-row"><time>${escapeHtml(r.time)}</time><strong>${escapeHtml(r.title)}</strong><span>${escapeHtml(r.detail)}</span></div>`).join('');
}

async function init(){
  loadCss();
  const section=document.getElementById('academySchedule');
  if(!section){setTimeout(init,80);return}
  let cfg;try{const res=await fetch(DATA_URL,{cache:'no-store'});if(!res.ok)throw new Error(String(res.status));cfg=await res.json()}catch(e){cfg=fallback()}
  const content=section.querySelector(':scope > div:not(.info-kicker)');
  if(!content)return;
  content.innerHTML=`
    <div class="schedule-control">
      <button id="schedulePrevDay" type="button" aria-label="이전 날짜">←</button>
      <input id="academyScheduleDate" type="date" aria-label="운영시간표 날짜 선택">
      <button id="scheduleNextDay" type="button" aria-label="다음 날짜">→</button>
      <div class="schedule-selected"><strong id="scheduleSelectedDate">-</strong><span id="scheduleHours">-</span></div>
    </div>
    <div id="scheduleWeekStrip" class="schedule-week-strip"></div>
    <div id="scheduleEventBanner" class="schedule-event-banner"><strong>운영정보</strong><span>날짜를 선택하세요.</span></div>
    <div id="academyScheduleRows" class="schedule-list dynamic-schedule"></div>
    <p class="schedule-data-note">요일별 기본 운영시간을 적용하며, 특정 날짜 이벤트가 등록되어 있으면 해당 날짜 일정이 우선 적용됩니다. 일요일은 18:00에 운영을 종료합니다.</p>`;

  const dateInput=document.getElementById('academyScheduleDate');
  const selected=document.getElementById('scheduleSelectedDate');
  const hours=document.getElementById('scheduleHours');
  const banner=document.getElementById('scheduleEventBanner');
  const strip=document.getElementById('scheduleWeekStrip');
  const rows=document.getElementById('academyScheduleRows');
  let current=ymdSeoulNow(); dateInput.value=current;

  function draw(){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(current))current=ymdSeoulNow();
    const eff=effective(cfg,current); dateInput.value=current;
    selected.textContent=formatFull(current);
    hours.textContent=eff.closed?'휴원':`${eff.open} — ${eff.close} · ${eff.label}`;
    banner.className=`schedule-event-banner${eff.event?' is-event':''}${eff.closed?' is-closed':''}`;
    banner.innerHTML=`<strong>${escapeHtml(eff.event?'날짜 이벤트 · '+eff.label:eff.label)}</strong><span>${escapeHtml(eff.note)}</span>`;
    renderRows(rows,eff);
    strip.innerHTML=weekDates(current).map(d=>{
      const e=effective(cfg,d), idx=dayIndex(d);
      return `<button type="button" class="schedule-day-chip${d===current?' is-selected':''}${idx===0?' is-sunday':''}${e.event?' has-event':''}" data-date="${d}"><small>${WEEK[idx]}요일</small><strong>${escapeHtml(formatMD(d))}</strong><span>${e.closed?'휴원':escapeHtml(e.close+' 종료')}</span></button>`
    }).join('');
    strip.querySelectorAll('[data-date]').forEach(b=>b.addEventListener('click',()=>{current=b.dataset.date;draw()}));
  }
  dateInput.addEventListener('change',()=>{if(dateInput.value){current=dateInput.value;draw()}});
  document.getElementById('schedulePrevDay').addEventListener('click',()=>{current=shift(current,-1);draw()});
  document.getElementById('scheduleNextDay').addEventListener('click',()=>{current=shift(current,1);draw()});
  draw();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
