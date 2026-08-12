(()=>{
const nav=document.getElementById('academyTopNav');
if(!nav||nav.querySelector('[data-counseling-link]'))return;
const link=document.createElement('a');
link.href='./counseling/';
link.dataset.counselingLink='1';
link.textContent='상담일지';
const daily=nav.querySelector('[href="#dailyTest"]');
if(daily)nav.insertBefore(link,daily);else nav.appendChild(link);
})();
