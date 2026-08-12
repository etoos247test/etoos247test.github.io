(()=>{
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sections=[...document.querySelectorAll('.info-section')];
const head=document.querySelector('.public-home-info-head');
const tone={
  publicNotices:'#2f6f54',
  publicSchedules:'#426f8b',
  dailyTest:'#95683d',
  academySchedule:'#527178',
  qaPreview:'#6c5f8c',
  academyEtiquette:'#8b6555',
  academyGuide:'#477862'
};
const revealSelectors=['.public-row','.schedule-row','.test-week','.guide-card','.etiquette-card'];

function prepareSection(section){
  if(!section)return;
  let i=0;
  section.querySelectorAll(revealSelectors.join(',')).forEach(el=>{
    if(el.classList.contains('motion-item'))return;
    el.classList.add('motion-item');
    el.style.setProperty('--motion-delay',`${Math.min(i++,7)*55}ms`);
  });
}
function prepareItems(){sections.forEach(prepareSection)}

function setAccent(section){
  if(!section)return;
  const accent=tone[section.id]||'#3f765d';
  document.documentElement.style.setProperty('--scroll-accent',accent);
  document.body.dataset.activeSection=section.id;
  document.querySelectorAll('#academyTopNav [data-go]').forEach(a=>{
    const target=(a.getAttribute('href')||'').replace('#','');
    if(target===section.id)a.setAttribute('aria-current','location');
    else a.removeAttribute('aria-current');
  });
}

function initObserver(){
  if(reduce||!('IntersectionObserver'in window)){
    head?.classList.add('is-visible');
    sections.forEach(s=>s.classList.add('is-visible'));
    return;
  }
  const reveal=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{if(entry.isIntersecting)entry.target.classList.add('is-visible')});
  },{threshold:.12,rootMargin:'0px 0px -8% 0px'});
  if(head)reveal.observe(head);
  sections.forEach(s=>reveal.observe(s));

  const active=new IntersectionObserver(entries=>{
    const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
    if(visible)setAccent(visible.target);
  },{threshold:[.22,.38,.55,.72],rootMargin:'-18% 0px -34% 0px'});
  sections.forEach(s=>active.observe(s));
}

function watchDynamicCards(){
  const root=document.getElementById('publicHomeInfo');
  if(!root||!('MutationObserver'in window))return;
  new MutationObserver(mutations=>{
    const touched=new Set();
    mutations.forEach(m=>m.addedNodes.forEach(n=>{
      if(!(n instanceof Element))return;
      const section=n.closest('.info-section');
      if(section)touched.add(section);
      n.querySelectorAll?.('.info-section').forEach(s=>touched.add(s));
    }));
    touched.forEach(prepareSection);
  }).observe(root,{childList:true,subtree:true});
}

let ticking=false;
function updateProgress(){
  const doc=document.documentElement;
  const max=Math.max(1,doc.scrollHeight-window.innerHeight);
  doc.style.setProperty('--scroll-progress',Math.min(1,Math.max(0,window.scrollY/max)).toFixed(4));
  ticking=false;
}
function onScroll(){if(!ticking){requestAnimationFrame(updateProgress);ticking=true}}

prepareItems();
watchDynamicCards();
requestAnimationFrame(()=>document.body.classList.add('motion-ready'));
initObserver();
updateProgress();
addEventListener('scroll',onScroll,{passive:true});
addEventListener('resize',onScroll,{passive:true});
})();
