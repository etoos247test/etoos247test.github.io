(()=>{
const API='https://my247-public.etoos247test.workers.dev';
const viewport=document.getElementById('noticeViewport');
const track=document.getElementById('noticeTrack');
const more=document.getElementById('noticeMore');
const board=document.getElementById('dailyTestBoard');
const noticeList=document.getElementById('publicNoticeList');
const scheduleList=document.getElementById('publicScheduleList');
let notices=[],index=0,timer=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateObj=s=>{const d=new Date(s);return Number.isNaN(d.getTime())?null:d};
const shortDate=s=>{const d=dateObj(s);return d?`${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`:''};
const fullDate=s=>{const d=dateObj(s);return d?new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(d):''};
function go(id){document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})}
function renderNotices(){
  if(track){
    if(!notices.length)track.innerHTML='<div class="notice-empty">현재 표시할 공지사항이 없습니다.</div>';
    else{track.innerHTML=notices.slice(0,8).map(n=>`<button class="notice-item" type="button"><b>${esc(n.title||'공지사항')}</b><time>${shortDate(n.created_at)}</time></button>`).join('');track.querySelectorAll('.notice-item').forEach(b=>b.addEventListener('click',()=>go('publicNotices')));move();start()}
  }
  if(noticeList){noticeList.innerHTML=notices.length?notices.map((n,i)=>`<article class="public-row ${n.pinned?'pinned':''}"><div class="public-row-no">${n.pinned?'PIN':String(i+1).padStart(2,'0')}</div><div><strong>${esc(n.title||'공지사항')}</strong><span>${n.campus==='suseong1'?'수성1관':n.campus==='suseong2'?'수성2관':'전체'} · ${fullDate(n.created_at)}</span></div></article>`).join(''):'<div class="public-empty">현재 공개된 공지사항이 없습니다.</div>'}
}
function renderSchedules(items){
  if(!scheduleList)return;
  if(!items.length){scheduleList.innerHTML='<div class="public-empty">현재 등록된 공개 시험일정이 없습니다.</div>';return}
  scheduleList.innerHTML=items.map((s,i)=>`<article class="public-row schedule-public-row"><div class="public-row-no">${String(i+1).padStart(2,'0')}</div><div><strong>${esc(s.title||'시험일정')}</strong><span>${fullDate(s.exam_date)} · ${esc(s.period_label||'')}</span>${s.description?`<p>${esc(s.description)}</p>`:''}</div></article>`).join('')
}
function move(){if(track)track.style.transform=`translateY(${-index*28}px)`}
function next(){if(notices.length<2)return;index=(index+1)%Math.min(notices.length,8);move()}
function start(){stop();if(notices.length>1)timer=setInterval(next,4200)}
function stop(){if(timer){clearInterval(timer);timer=null}}
if(viewport&&track){viewport.addEventListener('mouseenter',stop);viewport.addEventListener('mouseleave',start);viewport.addEventListener('focusin',stop);viewport.addEventListener('focusout',start)}
more?.addEventListener('click',()=>go('publicNotices'));

async function loadPublicData(){
  let remote=null;
  try{
    const [nr,sr]=await Promise.all([
      fetch(API+'/api/notices',{cache:'no-store'}),
      fetch(API+'/api/schedules',{cache:'no-store'})
    ]);
    if(nr.ok&&sr.ok){const nd=await nr.json(),sd=await sr.json();remote={notices:Array.isArray(nd?.notices)?nd.notices:[],schedules:Array.isArray(sd?.schedules)?sd.schedules:[]}}
  }catch{}
  if(!remote){
    try{const r=await fetch('./public-data.json?v=20260812a',{cache:'no-store'});if(r.ok)remote=await r.json()}catch{}
  }
  notices=Array.isArray(remote?.notices)?remote.notices:[];
  renderNotices();
  renderSchedules(Array.isArray(remote?.schedules)?remote.schedules:[]);
}
loadPublicData();

function mondayOf(date){const d=new Date(date);d.setHours(0,0,0,0);const shift=(d.getDay()+6)%7;d.setDate(d.getDate()-shift);return d}
function addDays(date,n){const d=new Date(date);d.setDate(d.getDate()+n);return d}
function weekText(m){const e=addDays(m,6);return`${m.getMonth()+1}.${m.getDate()} ~ ${e.getMonth()+1}.${e.getDate()}`}
function dayNoFor(date){const base=new Date(2026,7,3);base.setHours(0,0,0,0);const week=Math.round((mondayOf(date)-base)/604800000);const dow=(date.getDay()+6)%7;const raw=week*6+dow+1;return((raw-1)%50+50)%50+1}
function wordRange(dayNo){const start=(dayNo-1)*40+1,end=dayNo*40;return{label:`DAY ${String(dayNo).padStart(2,'0')}`,range:`${String(start).padStart(4,'0')}~${String(end).padStart(4,'0')}`}}
function listeningLabel(dayIndex,weekOffset){const base=weekOffset*6+dayIndex+1;const no=((base-1)%24+24)%24+1;const plans=['수능형 듣기','문장 듣기','수능형 듣기','유형별 듣기','수능형 듣기','주간 재평가'];return`${plans[dayIndex]} ${String(no).padStart(2,'0')}`}
function renderDailyTests(){
  if(!board)return;
  const today=new Date(),current=mondayOf(today),weeks=[{label:'전주',offset:-1},{label:'금주',offset:0},{label:'다음주',offset:1}];
  board.innerHTML=weeks.map(w=>{const monday=addDays(current,w.offset*7);const rows=[0,1,2,3,4,5,6].map(i=>{const d=addDays(monday,i),sun=d.getDay()===0,day=['일','월','화','수','목','금','토'][d.getDay()];if(sun)return`<tr class="no-test"><td>${d.getMonth()+1}.${d.getDate()}<span>${day}</span></td><td><b>평가 없음</b><span>일요일</span></td><td><b>평가 없음</b><span>일요일</span></td></tr>`;const wn=wordRange(dayNoFor(d));return`<tr><td>${d.getMonth()+1}.${d.getDate()}<span>${day}</span></td><td><b>${wn.label}</b><span>${wn.range}</span></td><td><b>${listeningLabel((d.getDay()+6)%7,w.offset)}</b><span>약 15~20분</span></td></tr>`}).join('');return`<article class="test-week ${w.offset===0?'current':''}"><div class="test-week-head"><div><small>${w.offset===0?'THIS WEEK':'WEEK'}</small><strong>${w.label}</strong></div><span>${weekText(monday)}</span></div><table class="test-table"><thead><tr><th>날짜</th><th>워드마스터 수능2000</th><th>듣기평가</th></tr></thead><tbody>${rows}</tbody></table></article>`}).join('')
}
renderDailyTests();
})();
