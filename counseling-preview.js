(()=>{
function syncNavExtras(){
  const nav=document.getElementById('academyTopNav');
  if(!nav)return;

  if(!nav.querySelector('[data-counseling-link]')){
    const link=document.createElement('a');
    link.href='./counseling/';
    link.dataset.counselingLink='1';
    link.textContent='상담일지';
    const daily=nav.querySelector('[href="#dailyTest"]');
    if(daily)nav.insertBefore(link,daily);else nav.appendChild(link);
  }

  [...nav.querySelectorAll('a')].forEach(link=>{
    if(link.textContent.trim()==='정시배치표'){
      link.href='https://etoos247test.github.io/admission/regular/';
      link.removeAttribute('target');
      link.removeAttribute('rel');
    }
  });
}

syncNavExtras();
setTimeout(syncNavExtras,80);
setTimeout(syncNavExtras,220);
setTimeout(syncNavExtras,700);

const nav=document.getElementById('academyTopNav');
if(nav&&'MutationObserver'in window){
  new MutationObserver(()=>syncNavExtras()).observe(nav,{childList:true,subtree:true});
}

function loadStyle(marker,href){
  if(document.querySelector(`link[${marker}]`))return;
  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href=href;
  css.setAttribute(marker,'1');
  document.head.appendChild(css);
}
loadStyle('data-home-motion','./home-motion.css?v=20260813a');
loadStyle('data-home-weight','./home-weight.css?v=20260813a');
loadStyle('data-home-flow','./home-flow.css?v=20260813a');

if(!document.querySelector('script[data-home-motion]')){
  const s=document.createElement('script');
  s.src='./home-motion.js?v=20260813a';
  s.dataset.homeMotion='1';
  document.body.appendChild(s);
}
})();
