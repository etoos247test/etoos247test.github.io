(()=>{
const $=s=>document.querySelector(s);
const topbar=$('.modern-topbar')||$('.topbar');
const loginLauncher=$('#loginLauncher');
const accountBar=$('#accountBar');
const dash=$('#dashboardView');
const profileMeta=$('#profileMeta');
const staffMenu=$('#staffMenu');
let masterTeacherMode=false;

function isLoggedIn(){return !!accountBar&&!accountBar.classList.contains('hidden')}
function isMaster(){return /·\s*마스터\s*$/.test(profileMeta?.textContent||'')}
function openLogin(){loginLauncher?.click()}

function injectTopNav(){
  if(!topbar||$('#academyTopNav'))return;
  const nav=document.createElement('nav');
  nav.id='academyTopNav';
  nav.className='top-nav';
  nav.setAttribute('aria-label','주요 메뉴');
  nav.innerHTML=`
    <button type="button" data-top-view="notices">학원공지</button>
    <button type="button" data-top-view="questions">질의응답</button>
    <a href="https://ipsywan.com/" target="_blank" rel="noopener">입시의완</a>
    <a href="./placement/">정시배치표</a>
    <button type="button" data-top-view="schedules">시험일정</button>
    <a href="./meal/">오늘의 식단</a>`;
  topbar.insertBefore(nav,loginLauncher||accountBar||null);
  nav.querySelectorAll('[data-top-view]').forEach(b=>b.addEventListener('click',()=>openTopView(b.dataset.topView)));
}

function openTopView(view){
  if(!isLoggedIn()){openLogin();return}
  if(isMaster()&&!masterTeacherMode)enterTeacherMode();
  setTimeout(()=>{
    const selector=`[data-view="${view}"]`;
    const button=(!$('#studentMenu')?.classList.contains('hidden')?$('#studentMenu')?.querySelector(selector):null)
      || staffMenu?.querySelector(selector)
      || document.querySelector(selector);
    button?.click();
  },0);
}

function injectMasterGateway(){
  if(!dash||$('#masterGateway'))return;
  const gateway=document.createElement('section');
  gateway.id='masterGateway';
  gateway.className='master-gateway hidden';
  gateway.innerHTML=`
    <button id="masterOpsGateway" class="master-gateway-card" type="button">
      <small>MASTER 01</small><strong>설정 · 승인</strong>
      <p>교사·학생 ID 관리와 마스터 신청 승인을 한곳에서 처리합니다.</p><span>운영 설정 열기 →</span>
    </button>
    <button id="masterTeacherGateway" class="master-gateway-card teacher-entry" type="button">
      <small>MASTER 02</small><strong>교사용 화면</strong>
      <p>일반 교사와 동일한 공지·질의응답·입시 업무 화면으로 이동합니다.</p><span>교사용 화면 열기 →</span>
    </button>`;
  const welcome=dash.querySelector('.welcome');
  welcome?.insertAdjacentElement('afterend',gateway);
  gateway.querySelector('#masterOpsGateway')?.addEventListener('click',openMasterOps);
  gateway.querySelector('#masterTeacherGateway')?.addEventListener('click',enterTeacherMode);

  const bar=document.createElement('div');
  bar.id='masterTeacherBar';
  bar.className='master-teacher-bar hidden';
  bar.innerHTML=`<button id="masterBackGateway" type="button">← 마스터 화면</button><span>교사용 화면</span>`;
  staffMenu?.insertAdjacentElement('beforebegin',bar);
  bar.querySelector('#masterBackGateway')?.addEventListener('click',leaveTeacherMode);
}

function injectMasterOps(){
  if($('#masterOpsPanel'))return;
  const panel=document.createElement('div');
  panel.id='masterOpsPanel';
  panel.className='login-overlay hidden master-ops-overlay';
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-label','마스터 설정 승인');
  panel.innerHTML=`
    <div class="login-sheet master-ops-sheet">
      <button class="panel-close" id="masterOpsClose" type="button">×</button>
      <div class="sheet-head"><small>MASTER CONTROL</small><h2>설정 · 승인</h2><p>학원 운영에 필요한 계정 설정과 마스터 승인 업무를 분리해 관리합니다.</p></div>
      <div class="master-ops-grid">
        <button id="masterUserAdmin" class="master-op-card" type="button"><small>01 · ACCOUNT</small><strong>교사·학생 ID 관리</strong><p>ID 발급, 임시 비밀번호 초기화, 계정 사용 여부를 관리합니다.</p><span>계정 설정 →</span></button>
        <button id="masterApprovalOpen" class="master-op-card" type="button"><small>02 · APPROVAL</small><strong>마스터 신청 승인</strong><p>Google 본인확인을 마친 마스터 신청을 확인하고 승인 또는 거절합니다.</p><span>승인 목록 →</span></button>
      </div>
    </div>`;
  document.body.appendChild(panel);
  panel.querySelector('#masterOpsClose')?.addEventListener('click',closeMasterOps);
  panel.addEventListener('click',e=>{if(e.target===panel)closeMasterOps()});
  panel.querySelector('#masterUserAdmin')?.addEventListener('click',()=>{closeMasterOps();$('#accountAdminBtn')?.click()});
  panel.querySelector('#masterApprovalOpen')?.addEventListener('click',()=>openApprovalWithRetry());
}

function openMasterOps(){
  injectMasterOps();
  $('#masterOpsPanel')?.classList.remove('hidden');
  document.body.classList.add('panel-open');
}
function closeMasterOps(){
  $('#masterOpsPanel')?.classList.add('hidden');
  if(document.querySelectorAll('.login-overlay:not(.hidden)').length===0)document.body.classList.remove('panel-open');
}
function openApprovalWithRetry(attempt=0){
  const approval=$('#masterApprovalMenu');
  if(approval){closeMasterOps();approval.click();return}
  if(attempt<8){setTimeout(()=>openApprovalWithRetry(attempt+1),250);return}
  const p=$('#masterOpsPanel .sheet-head p');
  if(p)p.textContent='마스터 승인 목록을 아직 불러오지 못했습니다. 잠시 후 다시 눌러 주세요.';
}

function enterTeacherMode(){
  if(!isMaster())return;
  masterTeacherMode=true;
  document.body.classList.add('master-teacher-mode');
  $('#masterGateway')?.classList.add('hidden');
  $('#masterTeacherBar')?.classList.remove('hidden');
  staffMenu?.classList.remove('hidden');
  $('#masterApprovalMenu')?.classList.add('hidden');
  $('#accountAdminBtn')?.classList.add('hidden');
  const msg=$('#welcomeMessage');if(msg)msg.textContent='교사용 업무 화면입니다.';
}
function leaveTeacherMode(){
  masterTeacherMode=false;
  document.body.classList.remove('master-teacher-mode');
  $('#masterGateway')?.classList.remove('hidden');
  $('#masterTeacherBar')?.classList.add('hidden');
  staffMenu?.classList.add('hidden');
  $('#accountAdminBtn')?.classList.add('hidden');
  const msg=$('#welcomeMessage');if(msg)msg.textContent='마스터 운영 메뉴를 선택하세요.';
}

function syncMasterView(){
  const master=isLoggedIn()&&isMaster();
  if(!master){
    masterTeacherMode=false;
    document.body.classList.remove('master-teacher-mode');
    $('#masterGateway')?.classList.add('hidden');
    $('#masterTeacherBar')?.classList.add('hidden');
    return;
  }
  $('#accountAdminBtn')?.classList.add('hidden');
  if(masterTeacherMode){
    $('#masterGateway')?.classList.add('hidden');
    $('#masterTeacherBar')?.classList.remove('hidden');
    staffMenu?.classList.remove('hidden');
    $('#masterApprovalMenu')?.classList.add('hidden');
  }else{
    $('#masterGateway')?.classList.remove('hidden');
    $('#masterTeacherBar')?.classList.add('hidden');
    if(!dash?.classList.contains('hidden'))staffMenu?.classList.add('hidden');
    const msg=$('#welcomeMessage');if(msg)msg.textContent='마스터 운영 메뉴를 선택하세요.';
  }
}

injectTopNav();
injectMasterGateway();
injectMasterOps();
new MutationObserver(syncMasterView).observe(accountBar,{attributes:true,attributeFilter:['class']});
new MutationObserver(syncMasterView).observe(profileMeta,{childList:true,subtree:true});
new MutationObserver(syncMasterView).observe(dash,{attributes:true,attributeFilter:['class']});
new MutationObserver(()=>{if(masterTeacherMode)$('#masterApprovalMenu')?.classList.add('hidden')}).observe(staffMenu,{childList:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#masterOpsPanel')?.classList.contains('hidden'))closeMasterOps()});
setTimeout(syncMasterView,650);
})();