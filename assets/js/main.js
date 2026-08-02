(() => {
  const core = document.createElement('script');
  core.src = './assets/js/main-core.js';
  core.async = false;
  document.head.append(core);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = document.createElement('style');
  css.id = 'etoos-motion-effects';
  css.textContent = `
    body.etoos-intro-lock{overflow:hidden}
    .etoos-entry{position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden;isolation:isolate}
    .etoos-entry__panel{position:absolute;top:0;bottom:0;width:50.2%;background:linear-gradient(115deg,rgba(13,28,54,.98),rgba(5,10,22,.998)),repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 1px,transparent 1px 44px);box-shadow:0 0 70px rgba(40,100,255,.28);will-change:transform}
    .etoos-entry__panel--left{left:0;transform:translateX(-101%);animation:panelLeft 1.5s cubic-bezier(.72,0,.14,1) forwards}
    .etoos-entry__panel--right{right:0;transform:translateX(101%);animation:panelRight 1.5s cubic-bezier(.72,0,.14,1) forwards}
    .etoos-entry__seam{position:absolute;left:50%;top:0;width:2px;height:100%;transform:translateX(-50%) scaleY(0);background:linear-gradient(180deg,transparent,#7de7ff 30%,#fff 50%,#7de7ff 70%,transparent);filter:drop-shadow(0 0 18px #39d8ff);animation:seam 1.2s .38s ease-out forwards}
    .etoos-entry__core{position:absolute;left:50%;top:50%;width:18px;height:18px;border-radius:50%;transform:translate(-50%,-50%) scale(0);background:#fff;box-shadow:0 0 30px 12px #8eeaff,0 0 90px 42px rgba(40,100,255,.8),0 0 180px 90px rgba(255,91,53,.36);animation:coreBurst 1.05s .42s ease-out forwards}
    .etoos-entry__ring{position:absolute;left:50%;top:50%;width:44px;height:44px;border:2px solid rgba(151,236,255,.9);border-radius:50%;transform:translate(-50%,-50%) scale(.15);opacity:0;box-shadow:0 0 28px rgba(57,216,255,.48);animation:ringBurst .9s .58s ease-out forwards}
    .etoos-entry__ring.r2{animation-delay:.67s;border-color:rgba(255,255,255,.62)}
    .etoos-entry__copy{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.86);width:min(88vw,760px);text-align:center;color:#fff;opacity:0;filter:blur(9px);animation:entryCopy .78s .63s ease-out forwards}
    .etoos-entry__copy small{display:block;margin-bottom:11px;color:#83e6ff;font:900 11px/1.3 Inter,Pretendard,sans-serif;letter-spacing:.26em}
    .etoos-entry__copy strong{display:block;font:900 clamp(30px,6vw,68px)/1.06 Inter,Pretendard,sans-serif;letter-spacing:-.07em;text-shadow:0 0 28px rgba(57,216,255,.34)}
    .etoos-entry__particle{position:absolute;left:50%;top:50%;width:var(--s);height:var(--s);border-radius:50%;background:var(--c);box-shadow:0 0 12px var(--c);opacity:0;transform:translate(-50%,-50%);animation:particle .82s var(--d) cubic-bezier(.1,.8,.2,1) forwards}
    @keyframes panelLeft{0%{transform:translateX(-101%)}34%,50%{transform:translateX(0)}100%{transform:translateX(-104%)}}
    @keyframes panelRight{0%{transform:translateX(101%)}34%,50%{transform:translateX(0)}100%{transform:translateX(104%)}}
    @keyframes seam{0%{transform:translateX(-50%) scaleY(0);opacity:0}32%{transform:translateX(-50%) scaleY(1);opacity:1}100%{transform:translateX(-50%) scaleY(1);opacity:0}}
    @keyframes coreBurst{0%{transform:translate(-50%,-50%) scale(0);opacity:0}28%{transform:translate(-50%,-50%) scale(1);opacity:1}56%{transform:translate(-50%,-50%) scale(8);opacity:.9}100%{transform:translate(-50%,-50%) scale(22);opacity:0}}
    @keyframes ringBurst{0%{transform:translate(-50%,-50%) scale(.15);opacity:.9}100%{transform:translate(-50%,-50%) scale(14);opacity:0}}
    @keyframes entryCopy{0%{opacity:0;filter:blur(9px);transform:translate(-50%,-50%) scale(.86)}45%{opacity:1;filter:blur(0);transform:translate(-50%,-50%) scale(1)}100%{opacity:0;filter:blur(3px);transform:translate(-50%,-54%) scale(1.035)}}
    @keyframes particle{0%{opacity:0;transform:translate(-50%,-50%) scale(.2)}18%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) rotate(var(--r)) scale(.05)}}
    .etoos-entry.finish{animation:overlayOut .25s ease forwards}@keyframes overlayOut{to{opacity:0;visibility:hidden}}

    #improvement{position:relative;isolation:isolate}
    .improvement-portal{position:absolute;inset:0;z-index:40;pointer-events:none;overflow:hidden;background:linear-gradient(180deg,rgba(244,247,251,.97),rgba(244,247,251,.62) 48%,transparent 100%);animation:portalFade 1.36s ease forwards}
    .improvement-portal:before{content:'';position:absolute;inset:-20% 0 auto;height:34%;background:linear-gradient(180deg,transparent,rgba(57,216,255,.13),rgba(40,100,255,.3),rgba(255,255,255,.92),rgba(57,216,255,.13),transparent);animation:scanDown 1.15s cubic-bezier(.2,.8,.2,1) forwards}
    .improvement-portal:after{content:'';position:absolute;left:50%;top:22%;width:min(62vw,560px);aspect-ratio:1;border:1px solid rgba(40,100,255,.36);border-radius:50%;transform:translate(-50%,-50%) scale(.2);box-shadow:0 0 0 30px rgba(57,216,255,.045),0 0 0 70px rgba(40,100,255,.035);animation:radar 1.2s ease-out forwards}
    .improvement-portal__grid{position:absolute;inset:0;background-image:linear-gradient(rgba(40,100,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(40,100,255,.055) 1px,transparent 1px);background-size:42px 42px;mask-image:linear-gradient(to bottom,black,transparent 78%);opacity:0;animation:gridPulse .95s ease-out forwards}
    .improvement-portal__label{position:absolute;left:50%;top:22%;transform:translate(-50%,-50%);color:#102a40;font:900 clamp(17px,2.6vw,32px)/1 Inter,Pretendard,sans-serif;letter-spacing:.18em;white-space:nowrap;opacity:0;animation:portalLabel 1s .08s ease-out forwards}
    @keyframes scanDown{from{transform:translateY(-120%)}to{transform:translateY(410%)}}
    @keyframes radar{0%{opacity:0;transform:translate(-50%,-50%) scale(.15) rotate(-25deg)}30%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.65) rotate(90deg)}}
    @keyframes portalLabel{0%{opacity:0;filter:blur(7px);letter-spacing:.32em}35%{opacity:1;filter:blur(0)}100%{opacity:0;letter-spacing:.12em;transform:translate(-50%,-72%)}}
    @keyframes gridPulse{0%{opacity:0;transform:scale(1.08)}45%{opacity:1}100%{opacity:0;transform:scale(1)}}
    @keyframes portalFade{0%,72%{opacity:1}100%{opacity:0;visibility:hidden}}
    #improvement.improvement-energized{box-shadow:inset 0 0 0 1px rgba(57,216,255,.16),inset 0 80px 160px rgba(40,100,255,.055)}
    @media(max-width:600px){.etoos-entry__particle:nth-of-type(n+11){display:none}.etoos-entry__copy small{font-size:9px}.etoos-entry__copy strong{font-size:clamp(28px,10vw,44px)}.improvement-portal:after{width:92vw}.improvement-portal__label{font-size:18px;letter-spacing:.11em}}
    @media(prefers-reduced-motion:reduce){.etoos-entry,.improvement-portal{display:none!important}}
    @media print{.etoos-entry,.improvement-portal{display:none!important}}
  `;
  document.head.append(css);

  const playEntry = () => {
    if (reduced || document.querySelector('.etoos-entry')) return;
    const overlay = document.createElement('div');
    overlay.className = 'etoos-entry';
    overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML = '<div class="etoos-entry__panel etoos-entry__panel--left"></div><div class="etoos-entry__panel etoos-entry__panel--right"></div><div class="etoos-entry__seam"></div><div class="etoos-entry__core"></div><div class="etoos-entry__ring"></div><div class="etoos-entry__ring r2"></div><div class="etoos-entry__copy"><small>ETOOS 247 · DAEGU SUSEONG 1</small><strong>학습의 흐름을 다시 설계하다</strong></div>';
    const vectors=[[-240,-170,-80],[-170,-250,35],[-55,-280,105],[90,-250,145],[220,-150,210],[275,-20,260],[240,150,310],[120,250,380],[-30,285,430],[-180,235,500],[-270,105,560],[-290,-55,620],[-150,-105,690],[150,-95,740],[165,90,800],[-130,120,860]];
    vectors.forEach((v,i)=>{const p=document.createElement('i');p.className='etoos-entry__particle';p.style.setProperty('--x',v[0]+'px');p.style.setProperty('--y',v[1]+'px');p.style.setProperty('--r',v[2]+'deg');p.style.setProperty('--d',(.54+(i%4)*.035)+'s');p.style.setProperty('--s',(3+(i%3)*2)+'px');p.style.setProperty('--c',i%4===0?'#ff875e':i%3===0?'#fff':'#58ddff');overlay.append(p)});
    document.body.classList.add('etoos-intro-lock');
    document.body.append(overlay);
    setTimeout(()=>overlay.classList.add('finish'),1580);
    setTimeout(()=>{overlay.remove();document.body.classList.remove('etoos-intro-lock')},1860);
  };

  let busy=false,cooldown=0;
  const playImprovement = () => {
    const section=document.getElementById('improvement');
    if(!section||reduced||busy||Date.now()<cooldown)return;
    busy=true;cooldown=Date.now()+1800;
    section.querySelector('.improvement-portal')?.remove();
    const portal=document.createElement('div');
    portal.className='improvement-portal';
    portal.setAttribute('aria-hidden','true');
    portal.innerHTML='<div class="improvement-portal__grid"></div><div class="improvement-portal__label">SYSTEM REBUILD</div>';
    section.prepend(portal);section.classList.add('improvement-energized');
    const targets=[...section.querySelectorAll('.section-heading > *, .improvement-summary article, .improvement-core, .improvement-tabs, .improvement-pane.active > *, .improvement-actions')];
    targets.forEach((el,i)=>el.animate([{opacity:0,transform:'perspective(900px) translateY(48px) rotateX(11deg) scale(.95)',filter:'blur(7px)',clipPath:'inset(0 48% 0 48% round 16px)'},{opacity:1,transform:'perspective(900px) translateY(0) rotateX(0) scale(1)',filter:'blur(0)',clipPath:'inset(0 0 0 0 round 0)'}],{duration:680,delay:220+i*62,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'}));
    setTimeout(()=>{portal.remove();section.classList.remove('improvement-energized');busy=false},1500+targets.length*24);
  };

  const init = () => {
    playEntry();
    const section=document.getElementById('improvement');
    if(section){
      new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting&&e.intersectionRatio>=.22)playImprovement()}),{threshold:[0,.22,.45]}).observe(section);
      document.querySelectorAll('a[href="#improvement"]').forEach(a=>a.addEventListener('click',()=>setTimeout(playImprovement,420)));
      addEventListener('hashchange',()=>{if(location.hash==='#improvement')setTimeout(playImprovement,300)});
      if(location.hash==='#improvement')setTimeout(playImprovement,760);
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
