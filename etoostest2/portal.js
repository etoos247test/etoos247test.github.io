(()=>{
  const API='https://etoos247-qa-api.etoos247test.workers.dev';
  const TK='etoostest2CompanySession';
  const UK='etoostest2CompanyUser';
  const WORKSPACE='./workspace.html?v=20260810e';
  const form=document.getElementById('companyPortalLogin');
  const status=document.getElementById('portalStatus');
  const button=document.getElementById('portalLoginButton');

  async function fetchWithTimeout(url, options={}, timeoutMs=12000){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      return await fetch(url,{...options,signal:controller.signal,cache:'no-store'});
    }finally{
      clearTimeout(timer);
    }
  }

  async function checkServer(){
    status.className='status';
    status.textContent='인증 서버 연결을 확인하는 중입니다.';
    try{
      const response=await fetchWithTimeout(API+'/api/company-auth/login',{method:'OPTIONS'},8000);
      if(!response.ok && response.status!==204) throw new Error(`인증 서버 HTTP ${response.status}`);
      status.className='status success';
      status.textContent='인증 서버 연결 정상 · 회사 ID와 비밀번호를 입력하세요.';
    }catch(error){
      status.className='status error';
      status.textContent=error?.name==='AbortError'
        ? '인증 서버가 8초 안에 응답하지 않습니다. 잠시 후 다시 로그인해 주세요.'
        : `인증 서버 연결 실패 · ${error.message||error}`;
    }
  }

  if(sessionStorage.getItem(TK)){
    location.replace(WORKSPACE);
    return;
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    button.disabled=true;
    status.className='status';
    status.textContent='회사 계정을 확인하는 중입니다.';
    try{
      const response=await fetchWithTimeout(API+'/api/company-auth/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          loginId:document.getElementById('portalLoginId').value.trim(),
          password:document.getElementById('portalPassword').value
        })
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.message||`API 오류 ${response.status}`);
      if(!data.sessionToken) throw new Error('로그인은 확인됐지만 세션 토큰을 받지 못했습니다.');
      sessionStorage.setItem(TK,data.sessionToken);
      sessionStorage.setItem(UK,JSON.stringify({
        uid:data.identity?.uid||'',
        email:data.identity?.email||'',
        name:data.identity?.name||'',
        mustChangePassword:data.mustChangePassword===true
      }));
      status.className='status success';
      status.textContent=`${data.identity?.name||'사용자'}님 확인 완료. 업무화면을 여는 중입니다.`;
      location.replace(WORKSPACE);
    }catch(error){
      status.className='status error';
      status.textContent=error?.name==='AbortError'
        ? '인증 서버가 12초 안에 응답하지 않았습니다. Worker 배포 상태를 확인해 주세요.'
        : (error.message||String(error));
    }finally{
      button.disabled=false;
    }
  });

  checkServer();
})();
