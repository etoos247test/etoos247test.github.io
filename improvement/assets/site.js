const toggle=document.querySelector('.mobile-toggle');
const nav=document.querySelector('.site-nav');
if(toggle&&nav){toggle.addEventListener('click',()=>nav.classList.toggle('open'));}
document.querySelectorAll('.site-nav a').forEach(a=>a.addEventListener('click',()=>nav?.classList.remove('open')));
