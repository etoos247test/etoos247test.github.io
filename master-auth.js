(()=>{
const MAIN_API='https://my247-api.etoos247test.workers.dev';
const AUTH_API='https://my247-master-auth.etoos247test.workers.dev';
const TK='my247Session';
const FIREBASE_CONFIG={
  apiKey:'AIzaSyAg6PnWUVfvlc10R81wb2liVxyGMbqbw78',
  authDomain:'etoos247test-10ffa.firebaseapp.com',
  projectId:'etoos247test-10ffa',
  storageBucket:'etoos247test-10ffa.firebasestorage.app',
  messagingSenderId:'795523938504',
  appId:'1:795523938504:web:1f5815dc67dd0906310dfd',
  measurementId:'G-NS4NCBBG4S'
};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function entryStatus(message,kind=''){const e=$('#entryStatus');if(!e)return;e.textContent=message;e.className='entry-status '+kind}
function toast(message){const t=$('#toast');if(!t){alert(message);return}t.textContent=message;t.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.add('hidden'),3200)}
async function req(path,opt={}){const headers={...(opt.headers||{})};if(opt.body&&!headers['Content-Type'])headers['Content-Type']='application/json';const r=await fetch(AUTH_API+path,{...opt,headers,cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||`서버 오류 ${r.status}`);return d}
async function mainReq(path,opt={}){const headers={...(opt.headers||{})};if(opt.body&&!headers['Content-Type'])headers['Content-Type']='application/json';const r=await fetch(MAIN_API+path,{...opt,headers,cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||`서버 오류 ${r.status}`);return d}
async function ensureMasterServer(){try{const r=await fetch(AUTH_API+'/health',{cache:'no-store'});if(!r.ok)throw new Error();return true}catch{throw new Error('마스터 신청 기능을 준비 중입니다. 학원데스크에 문의하세요.')}}
let firebasePromise;
async function firebase(){
  if(!firebasePromise)firebasePromise=(async()=>{
    const appMod=await import('https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js');
    const authMod=await import('https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js');
    const app=appMod.getApps().length?appMod.getApps()[0]:appMod.initializeApp(FIREBASE_CONFIG);
    const auth=authMod.getAuth(app);
    await authMod.setPersistence(auth,authMod.browserSessionPersistence);
    const provider=new authMod.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    return{auth,provider,authMod};
  })();
  return firebasePromise;
}
async function googleIdentity(){
  const f=await firebase();
  const result=await f.authMod.signInWithPopup(f.auth,f.provider);
  const idToken=await result.user.getIdToken(true);
  return{idToken,user:result.user,signOut:()=>f.authMod.signOut(f.auth)};
}
async function saveSession(d){sessionStorage.setItem(TK,d.token);location.reload()}
async function discardSession(token){try{await mainReq('/api/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:'{}'})}catch{}}
async function idLogin(form,role){
  const b=form.querySelector('button[type="submit"]');b.disabled=true;entryStatus('계정을 확인하는 중입니다.');
  try{
    const mode=role==='student'?'student':'staff';
    const d=await mainReq('/api/auth/login',{method:'POST',body:JSON.stringify({loginId:form.loginId.value.trim(),password:form.password.value,mode})});
    if(d?.user?.role!==role){await discardSession(d.token);throw new Error(role==='teacher'?'교사 계정으로 로그인해 주세요.':'마스터 계정으로 로그인해 주세요.');}
    entryStatus('로그인되었습니다.','ok');await saveSession(d)
  }catch(e){entryStatus(e.message,'error')}finally{b.disabled=false}
}
async function masterGoogleLogin(){
  const b=$('#masterGoogleLogin');b.disabled=true;entryStatus('Google 계정을 확인하는 중입니다.');
  try{await ensureMasterServer();const g=await googleIdentity(),d=await req('/api/auth/google-master',{method:'POST',body:JSON.stringify({idToken:g.idToken})});entryStatus('마스터 로그인이 완료되었습니다.','ok');await saveSession(d)}catch(e){entryStatus(e.message,'error')}finally{b.disabled=false}
}
async function masterApply(){
  const b=$('#masterApply');b.disabled=true;entryStatus('Google 로그인 후 마스터 신청을 진행합니다.');
  let g;
  try{await ensureMasterServer();g=await googleIdentity();const d=await req('/api/master/apply',{method:'POST',body:JSON.stringify({idToken:g.idToken})});entryStatus(d.message,'ok');toast(d.message)}catch(e){entryStatus(e.message,'error')}finally{try{await g?.signOut()}catch{}b.disabled=false}
}
function openModal(html){const m=$('#modal'),body=$('#modalBody');if(!m||!body)return;body.innerHTML=html;m.classList.remove('hidden')}
async function authMe(){const token=sessionStorage.getItem(TK);if(!token)return null;const r=await fetch(MAIN_API+'/api/me',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});if(!r.ok)return null;return r.json()}
async function applications(){
  const token=sessionStorage.getItem(TK);if(!token)throw new Error('로그인이 필요합니다.');
  return req('/api/master/applications',{headers:{Authorization:`Bearer ${token}`}})
}
async function renderApplications(){
  openModal('<h2>마스터 신청 승인</h2><p>신청 목록을 불러오는 중입니다.</p>');
  try{
    const d=await applications(),a=d.applications||[];
    $('#modalBody').innerHTML=`<h2>마스터 신청 승인</h2><p class="master-help">Google 계정으로 본인 확인을 마친 신청자만 표시됩니다. 승인하면 해당 Google 계정이 마스터 권한으로 연결됩니다.</p><div class="master-application-list">${a.length?a.map(x=>`<article class="master-app-item"><div class="master-app-person">${x.photo_url?`<img src="${esc(x.photo_url)}" alt="">`:''}<div><strong>${esc(x.name)}</strong><span>${esc(x.email)}</span><small>신청 ${esc((x.requested_at||'').slice(0,16).replace('T',' '))}</small></div></div><div class="master-app-actions"><button type="button" class="primary" data-master-approve="${esc(x.firebase_uid)}">승인</button><button type="button" class="danger" data-master-reject="${esc(x.firebase_uid)}">거절</button></div></article>`).join(''):'<div class="empty">승인 대기 중인 마스터 신청이 없습니다.</div>'}</div>`;
    bindApprovalActions();
  }catch(e){$('#modalBody').innerHTML=`<h2>마스터 신청 승인</h2><div class="empty">${esc(e.message)}</div>`}
}
function bindApprovalActions(){
  document.querySelectorAll('[data-master-approve]').forEach(b=>b.onclick=async()=>{if(!confirm('이 신청자를 마스터로 승인할까요?'))return;b.disabled=true;try{const token=sessionStorage.getItem(TK);await req(`/api/master/applications/${encodeURIComponent(b.dataset.masterApprove)}/approve`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:'{}'});toast('마스터 승인을 완료했습니다.');await renderApplications();await refreshMasterTools()}catch(e){toast(e.message)}finally{b.disabled=false}});
  document.querySelectorAll('[data-master-reject]').forEach(b=>b.onclick=async()=>{if(!confirm('이 마스터 신청을 거절할까요?'))return;b.disabled=true;try{const token=sessionStorage.getItem(TK);await req(`/api/master/applications/${encodeURIComponent(b.dataset.masterReject)}/reject`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({note:'마스터 승인 거절'})});toast('마스터 신청을 거절했습니다.');await renderApplications();await refreshMasterTools()}catch(e){toast(e.message)}finally{b.disabled=false}})
}
async function refreshMasterTools(){
  const me=await authMe().catch(()=>null);if(me?.user?.role!=='master')return;
  if(String(me.user.loginId||'').startsWith('GMASTER-')){$('#passwordBtn')?.classList.add('hidden')}
  const menu=$('#staffMenu');if(!menu)return;
  let card=$('#masterApprovalMenu');
  if(!card){card=document.createElement('button');card.type='button';card.id='masterApprovalMenu';card.className='menu-card featured';card.innerHTML='<b>07</b><i>✓</i><h2>마스터 승인</h2><p>Google 본인확인을 마친 마스터 신청을 승인합니다.</p><span id="masterApprovalLabel">신청 확인 →</span>';menu.appendChild(card);card.onclick=renderApplications}
  try{const d=await applications(),n=(d.applications||[]).length;const label=$('#masterApprovalLabel');if(label)label.textContent=n?`승인 대기 ${n}명 →`:'신청 확인 →'}catch{}
}
function bind(){
  $('#studentLoginForm')?.addEventListener('submit',e=>{e.preventDefault();idLogin(e.currentTarget,'student')});
  $('#teacherLoginForm')?.addEventListener('submit',e=>{e.preventDefault();idLogin(e.currentTarget,'teacher')});
  $('#legacyMasterLoginForm')?.addEventListener('submit',e=>{e.preventDefault();idLogin(e.currentTarget,'master')});
  $('#masterGoogleLogin')?.addEventListener('click',masterGoogleLogin);
  $('#masterApply')?.addEventListener('click',masterApply);
  const target=$('#dashboardView');if(target)new MutationObserver(()=>refreshMasterTools()).observe(target,{attributes:true,attributeFilter:['class']});
  setTimeout(refreshMasterTools,500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
