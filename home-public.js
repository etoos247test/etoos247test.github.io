(()=>{
const API='https://my247-public.etoos247test.workers.dev';
const viewport=document.getElementById('noticeViewport');
const track=document.getElementById('noticeTrack');
const more=document.getElementById('noticeMore');
if(!viewport||!track)return;
let notices=[],index=0,timer=null;
const fmt=s=>{if(!s)return'';const d=new Date(s);if(Number.isNaN(d.getTime()))return'';return`${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`};
function openNotices(){const btn=document.querySelector('[data-top-view="notices"]')||document.querySelector('[data-view="notices"]');if(btn)btn.click();else document.getElementById('loginLauncher')?.click()}
function render(){
  if(!notices.length){track.innerHTML='<div class="notice-empty">현재 표시할 공지사항이 없습니다.</div>';return}
  track.innerHTML=notices.map(n=>`<button class="notice-item" type="button" data-notice="${String(n.id||'')}"><b>${escapeHtml(n.title||'공지사항')}</b><time>${fmt(n.created_at)}</time></button>`).join('');
  track.querySelectorAll('.notice-item').forEach(b=>b.addEventListener('click',openNotices));
  move();start();
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function move(){track.style.transform=`translateY(${-index*28}px)`}
function next(){if(notices.length<2)return;index=(index+1)%notices.length;move()}
function start(){stop();if(notices.length>1)timer=setInterval(next,4200)}
function stop(){if(timer){clearInterval(timer);timer=null}}
viewport.addEventListener('mouseenter',stop);viewport.addEventListener('mouseleave',start);viewport.addEventListener('focusin',stop);viewport.addEventListener('focusout',start);more?.addEventListener('click',openNotices);
fetch(API+'/api/notices',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(d=>{notices=Array.isArray(d?.notices)?d.notices:[];render()}).catch(()=>{track.innerHTML='<div class="notice-empty">최근 공지사항을 준비 중입니다.</div>'});
})();
