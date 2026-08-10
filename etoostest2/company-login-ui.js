(()=>{
 const API='https://etoos247-qa-api.etoos247test.workers.dev',TK='etoostest2CompanySession';
 const token=()=>sessionStorage.getItem(TK)||'';
 if(location.pathname.includes('/etoostest2/workspace')&&!token()){location.replace('./');return}
 const replace=()=>{document.querySelectorAll('#status,.login-card p,.panel p').forEach(el=>{el.childNodes.forEach(n=>{if(n.nodeType===3)n.textContent=n.textContent.replaceAll('Google 로그인','회사 ID 로그인').replaceAll('Google 계정','회사 계정').replaceAll('Firebase 로그인 토큰','회사 로그인 세션')})})};
 new MutationObserver(replace).observe(document.body,{subtree:true,childList:true,characterData:true});replace();
 window.etoosCompanyAuth={getToken:token,setToken:t=>sessionStorage.setItem(TK,t),setLastLogin(data){if(!data.mustChangePassword)return;setTimeout(()=>{const status=document.getElementById('status');if(status){status.textContent='임시 비밀번호를 사용 중입니다. 비밀번호 변경 후 계속 사용하는 것을 권장합니다.';status.className='status warning'}},300)}};
 const area=document.getElementById('loginArea');if(area)area.classList.add('hidden');
 const bar=document.getElementById('accountBar');if(bar){const row=bar.querySelector('.button-row');const button=document.createElement('button');button.type='button';button.className='button secondary';button.textContent='비밀번호 변경';button.onclick=async()=>{const currentPassword=prompt('현재 비밀번호를 입력하세요.');if(currentPassword===null)return;const newPassword=prompt('새 비밀번호를 입력하세요. (5자 이상)');if(!newPassword)return;try{const response=await fetch(`${API}/api/company-auth/change-password`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token()}`},body:JSON.stringify({currentPassword,newPassword})}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'변경 실패');window.etoosCompanyAuth.setToken(data.sessionToken);alert('비밀번호를 변경했습니다.')}catch(error){alert(error.message)}};row?.prepend(button)}
})();
