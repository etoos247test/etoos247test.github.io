
const pages=[...document.querySelectorAll('.page')];
const nav=[...document.querySelectorAll('.nav a')];
const pageNow=document.getElementById('pageNow');
function currentIndex(){let idx=0;let min=Infinity;pages.forEach((p,i)=>{const d=Math.abs(p.getBoundingClientRect().top-90);if(d<min){min=d;idx=i;}});return idx;}
function setActive(){const i=currentIndex();pageNow.textContent=String(i+1).padStart(2,'0')+' / '+pages.length;nav.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+pages[i].id));}
function go(i){i=Math.max(0,Math.min(pages.length-1,i));pages[i].scrollIntoView({behavior:'smooth',block:'start'});history.replaceState(null,'','#'+pages[i].id);}
document.getElementById('prev').addEventListener('click',()=>go(currentIndex()-1));
document.getElementById('next').addEventListener('click',()=>go(currentIndex()+1));
document.getElementById('toTop').addEventListener('click',()=>go(0));
document.querySelector('.menu-btn').addEventListener('click',()=>document.querySelector('.nav').classList.toggle('open'));
nav.forEach(a=>a.addEventListener('click',()=>document.querySelector('.nav').classList.remove('open')));
window.addEventListener('scroll',()=>requestAnimationFrame(setActive),{passive:true});
window.addEventListener('load',setActive);
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='PageDown')go(currentIndex()+1);if(e.key==='ArrowLeft'||e.key==='PageUp')go(currentIndex()-1);});
let sx=0;document.addEventListener('touchstart',e=>{sx=e.changedTouches[0].clientX},{passive:true});document.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>70)go(currentIndex()+(dx<0?1:-1));},{passive:true});
