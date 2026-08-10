(()=>{
 const API='https://etoos247-qa-api.etoos247test.workers.dev';
 const TK='etoostest2CompanySession';
 const UK='etoostest2CompanyUser';
 const token=()=>sessionStorage.getItem(TK)||'';
 const saved=(()=>{try{return JSON.parse(sessionStorage.getItem(UK)||'{}')}catch{return {}}})();
 if(location.pathname.includes('/etoostest2/workspace')&&!token()){location.replace('./');return}

 const replaceCopy=()=>{
   document.querySelectorAll('#status,.login-card p,.panel p').forEach(el=>{
     el.childNodes.forEach(n=>{
       if(n.nodeType!==3)return;
       const before=n.textContent||'';
       const after=before.replaceAll('Google 로그인','회사 ID 로그인').replaceAll('Google 계정','회사 계정').replaceAll('Firebase 로그인 토큰','회사 로그인 세션');
       if(after!==before)n.textContent=after;
     });
   });
 };
 let copyQueued=false;
 const observer=new MutationObserver(()=>{
   if(copyQueued)return;
   copyQueued=true;
   queueMicrotask(()=>{copyQueued=false;replaceCopy()});
 });
 observer.observe(document.body,{subtree:true,childList:true,characterData:true});
 replaceCopy();

 function applyCompanyMeta(){
   const meta=document.getElementById('accountMeta');
   if(meta){
     const role=saved.role==='master'?'관리자':saved.role==='teacher'?'교사':saved.role==='student'?'학생':'';
     meta.textContent=[saved.loginId||saved.studentId||'회사 계정',role].filter(Boolean).join(' · ');
   }
 }

 window.etoosCompanyAuth={
   getToken:token,
   setToken:t=>sessionStorage.setItem(TK,t),
   setLastLogin(data){
     if(!data.mustChangePassword)return;
     setTimeout(()=>{
       const status=document.getElementById('status');
       if(status){status.textContent='임시 비밀번호를 사용 중입니다. 비밀번호 변경 후 계속 사용하는 것을 권장합니다.';status.className='status warning'}
     },300);
   }
 };

 const nav=document.querySelector('.top-links');
 if(nav&&!nav.querySelector('[data-company-home]')){
   const home=document.createElement('a');
   home.href='./home.html?v=20260810a';
   home.dataset.companyHome='1';
   home.textContent='MY 247 대문';
   nav.prepend(home);
 }

 const area=document.getElementById('loginArea');
 if(area)area.classList.add('hidden');
 const bar=document.getElementById('accountBar');
 if(bar){
   const row=bar.querySelector('.button-row');
   if(row&&!row.querySelector('[data-company-home-button]')){
     const home=document.createElement('a');
     home.href='./home.html?v=20260810a';
     home.dataset.companyHomeButton='1';
     home.className='button secondary';
     home.textContent='대문';
     row.prepend(home);
   }
   const button=document.createElement('button');
   button.type='button';
   button.className='button secondary';
   button.textContent='비밀번호 변경';
   button.onclick=async()=>{
     const currentPassword=prompt('현재 비밀번호를 입력하세요.');
     if(currentPassword===null)return;
     const newPassword=prompt('새 비밀번호를 입력하세요. (5자 이상)');
     if(!newPassword)return;
     try{
       const controller=new AbortController();
       const timer=setTimeout(()=>controller.abort(),12000);
       const response=await fetch(`${API}/api/company-auth/change-password`,{
         method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token()}`},
         body:JSON.stringify({currentPassword,newPassword}),signal:controller.signal
       });
       clearTimeout(timer);
       const data=await response.json().catch(()=>({}));
       if(!response.ok)throw new Error(data.message||'변경 실패');
       window.etoosCompanyAuth.setToken(data.sessionToken);
       alert('비밀번호를 변경했습니다.');
     }catch(error){alert(error?.name==='AbortError'?'인증 서버 응답이 지연되고 있습니다.':(error.message||String(error)))}
   };
   row?.prepend(button);
 }

 applyCompanyMeta();
 setTimeout(applyCompanyMeta,500);
 setTimeout(applyCompanyMeta,1500);
})();
