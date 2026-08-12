(()=>{
const nav=document.getElementById('academyTopNav');
if(nav&&!nav.querySelector('[data-counseling-link]')){
  const link=document.createElement('a');
  link.href='./counseling/';
  link.dataset.counselingLink='1';
  link.textContent='상담일지';
  const daily=nav.querySelector('[href="#dailyTest"]');
  if(daily)nav.insertBefore(link,daily);else nav.appendChild(link);
}
if(!document.querySelector('link[data-home-motion]')){
  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='./home-motion.css?v=20260813a';
  css.dataset.homeMotion='1';
  document.head.appendChild(css);
}
if(!document.querySelector('script[data-home-motion]')){
  const s=document.createElement('script');
  s.src='./home-motion.js?v=20260813a';
  s.dataset.homeMotion='1';
  document.body.appendChild(s);
}
})();
