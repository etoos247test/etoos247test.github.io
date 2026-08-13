(()=>{
const $=s=>document.querySelector(s);
const loginPanel=$('#loginPanel');
const grid=loginPanel?.querySelector('.basic-login-grid');
const teacher=grid?.querySelector('.teacher-card');
const student=grid?.querySelector('.student-card');
const masterPanel=$('#masterPanel');
const master=masterPanel?.querySelector('.master-card');
if(!loginPanel||!grid||!teacher||!student||!master)return;

if(!$('#loginTabsStyle')){
  const style=document.createElement('style');
  style.id='loginTabsStyle';
  style.textContent=`
  .tabbed-login-sheet{width:min(640px,100%)!important}
  .login-role-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:-12px 0 18px;padding:5px;border:1px solid #d9ddd9;border-radius:6px;background:#eef1ed}
  .login-role-tab{min-height:44px;border:0;border-radius:4px;background:transparent;color:#68756e;font-size:11px;font-weight:950;letter-spacing:.08em;transition:.18s}
  .login-role-tab:hover{background:rgba(255,255,255,.65);color:#263b30}
  .login-role-tab[aria-selected="true"]{background:#1c3428;color:#fff;box-shadow:0 5px 15px rgba(27,52,40,.12)}
  .login-role-tab.needs-bootstrap::after{content:' · 최초설정';color:#f4c66d;font-size:9px;letter-spacing:0}
  .tabbed-login-sheet .basic-login-grid{display:block}
  .tabbed-login-sheet .login-tab-panel[hidden]{display:none!important}
  .tabbed-login-sheet .login-card{min-height:430px}
  .tabbed-login-sheet .master-card{min-height:470px}
  .master-bootstrap-callout{margin:18px 0 12px;padding:15px;border:1px solid #d6b56a;border-radius:4px;background:#fff8e8;color:#4c4024}
  .master-bootstrap-callout strong{display:block;font-size:13px}
  .master-bootstrap-callout p{margin:6px 0 12px!important;color:#766541!important;font-size:11px!important;line-height:1.65!important}
  .master-bootstrap-callout button{width:100%;min-height:43px;border:0;border-radius:3px;background:#6f531b;color:#fff;font-weight:950}
  .tabbed-login-sheet .login-extra-actions{margin-top:12px}
  @media(max-width:680px){.login-role-tabs{position:sticky;top:-64px;z-index:3}.tabbed-login-sheet .login-card{min-height:390px}}
  `;
  document.head.appendChild(style);
}

loginPanel.setAttribute('aria-label','교사 학생 마스터 로그인');
loginPanel.querySelector('.login-sheet')?.classList.add('tabbed-login-sheet');

const tabs=document.createElement('div');
tabs.className='login-role-tabs';
tabs.setAttribute('role','tablist');
tabs.setAttribute('aria-label','로그인 유형');
tabs.innerHTML=`
  <button id="loginTabTeacher" class="login-role-tab" type="button" role="tab" aria-selected="true" aria-controls="loginPanelTeacher">교사</button>
  <button id="loginTabStudent" class="login-role-tab" type="button" role="tab" aria-selected="false" aria-controls="loginPanelStudent" tabindex="-1">학생</button>
  <button id="loginTabMaster" class="login-role-tab" type="button" role="tab" aria-selected="false" aria-controls="loginPanelMaster" tabindex="-1">MASTER</button>`;
grid.insertAdjacentElement('beforebegin',tabs);

const panels=[
  {tab:$('#loginTabTeacher'),panel:teacher,id:'loginPanelTeacher'},
  {tab:$('#loginTabStudent'),panel:student,id:'loginPanelStudent'},
  {tab:$('#loginTabMaster'),panel:master,id:'loginPanelMaster'}
];

master.classList.add('master-tab-card');
grid.appendChild(master);
masterPanel?.remove();
$('#loginMasterOpen')?.remove();

for(const x of panels){
  x.panel.id=x.id;
  x.panel.classList.add('login-tab-panel');
  x.panel.setAttribute('role','tabpanel');
  x.panel.setAttribute('aria-labelledby',x.tab.id);
}
teacher.hidden=false;
student.hidden=true;
master.hidden=true;

function activate(index,focus=false){
  panels.forEach((x,i)=>{
    const on=i===index;
    x.tab.setAttribute('aria-selected',on?'true':'false');
    x.tab.tabIndex=on?0:-1;
    x.panel.hidden=!on;
  });
  if(focus)panels[index].tab.focus();
}

panels.forEach((x,i)=>{
  x.tab.addEventListener('click',()=>activate(i));
  x.tab.addEventListener('keydown',e=>{
    let n=null;
    if(e.key==='ArrowRight')n=(i+1)%panels.length;
    if(e.key==='ArrowLeft')n=(i-1+panels.length)%panels.length;
    if(e.key==='Home')n=0;
    if(e.key==='End')n=panels.length-1;
    if(n!==null){e.preventDefault();activate(n,true)}
  });
});

const masterIntro=master.querySelector('p');
const callout=document.createElement('div');
callout.id='masterBootstrapCallout';
callout.className='master-bootstrap-callout hidden';
callout.innerHTML=`<strong>최초 마스터 설정이 필요합니다.</strong><p>아직 서버에 마스터가 없습니다. GitHub Secret에 등록한 최초 설정 키로 첫 마스터를 한 번만 생성합니다.</p><button id="masterBootstrapTabBtn" type="button">최초 마스터 설정</button>`;
masterIntro?.insertAdjacentElement('afterend',callout);

const bootstrapButton=$('#bootstrapOpen');
const masterTab=$('#loginTabMaster');
function setBootstrapState(needsMaster){
  callout.classList.toggle('hidden',!needsMaster);
  masterTab?.classList.toggle('needs-bootstrap',!!needsMaster);
}
$('#masterBootstrapTabBtn')?.addEventListener('click',()=>bootstrapButton?.click());

if(bootstrapButton){
  new MutationObserver(()=>setBootstrapState(!bootstrapButton.classList.contains('hidden')))
    .observe(bootstrapButton,{attributes:true,attributeFilter:['class']});
}

fetch('https://my247-api.etoos247test.workers.dev/api/bootstrap/status',{cache:'no-store'})
  .then(r=>r.ok?r.json():null)
  .then(d=>{if(d&&typeof d.needsMaster==='boolean')setBootstrapState(d.needsMaster)})
  .catch(()=>{});
})();
