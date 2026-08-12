(()=>{
const API='https://my247-public.etoos247test.workers.dev';
const viewport=document.getElementById('noticeViewport');
const track=document.getElementById('noticeTrack');
const more=document.getElementById('noticeMore');
const board=document.getElementById('dailyTestBoard');
let notices=[],index=0,timer=null;
const fmt=s=>{if(!s)return'';const d=new Date(s);if(Number.isNaN(d.getTime()))return'';return`${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`};
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function openNotices(){const btn=document.querySelector('[data-top-view="notices"]')||document.querySelector('[data-view="notices"]');if(btn)btn.click();else document.getElementById('loginLauncher')?.click()}
function renderNotices(){
  if(!viewport||!track)return;
  if(!notices.length){track.innerHTML='<div class="notice-empty">현재 표시할 공지사항이 없습니다.</div>';return}
  track.innerHTML=notices.map(n=>`<button class="notice-item" type="button" data-notice="${String(n.id||'')}"><b>${escapeHtml(n.title||'공지사항')}</b><time>${fmt(n.created_at)}</time></button>`).join('');
  track.querySelectorAll('.notice-item').forEach(b=>b.addEventListener('click',openNotices));
  move();start();
}
function move(){if(track)track.style.transform=`translateY(${-index*28}px)`}
function next(){if(notices.length<2)return;index=(index+1)%notices.length;move()}
function start(){stop();if(notices.length>1)timer=setInterval(next,4200)}
function stop(){if(timer){clearInterval(timer);timer=null}}
if(viewport&&track){viewport.addEventListener('mouseenter',stop);viewport.addEventListener('mouseleave',start);viewport.addEventListener('focusin',stop);viewport.addEventListener('focusout',start);more?.addEventListener('click',openNotices);fetch(API+'/api/notices',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(d=>{notices=Array.isArray(d?.notices)?d.notices:[];renderNotices()}).catch(()=>{track.innerHTML='<div class="notice-empty">최근 공지사항을 준비 중입니다.</div>'})}

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
