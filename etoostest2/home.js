(()=>{
  const API='https://etoos247-qa-api.etoos247test.workers.dev';
  const TK='etoostest2CompanySession';
  const UK='etoostest2CompanyUser';
  const token=sessionStorage.getItem(TK)||'';
  const saved=(()=>{try{return JSON.parse(sessionStorage.getItem(UK)||'{}')}catch{return {}}})();
  const $=id=>document.getElementById(id);

  if(!token){location.replace('./');return}

  const roleLabel=role=>role==='master'?'관리자':role==='teacher'?'교사':role==='student'?'학생':'사용자';
  const campusLabel=value=>value==='suseong1'?'수성1관':value==='suseong2'?'수성2관':value||'공통';

  function renderRole(role){
    document.querySelectorAll('[data-roles]').forEach(card=>{
      const roles=(card.dataset.roles||'').split(',');
      card.hidden=!roles.includes(role);
    });
  }

  function render(profile,identity={}){
    const role=profile?.role||saved.role||'student';
    const name=profile?.name||saved.name||identity.name||'사용자';
    const loginId=saved.loginId||profile?.student_id||'회사 계정';
    const campus=profile?.campus||saved.campus||'';
    $('welcomeName').textContent=name;
    $('profileName').textContent=name;
    $('profileId').textContent=`회사 ID · ${loginId}`;
    $('profileRole').textContent=roleLabel(role);
    $('profileCampus').textContent=role==='master'?'수성1·2관':campusLabel(campus);
    $('profileStatus').textContent=`${roleLabel(role)} 권한으로 기본 대문을 열었습니다. 내부 UID는 화면에 표시하지 않습니다.`;
    $('sessionState').textContent=`${roleLabel(role)} · ${loginId}`;
    renderRole(role);
  }

  async function api(path,options={}){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(API+path,{...options,headers:{...(options.headers||{}),Authorization:`Bearer ${token}`},signal:controller.signal,cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||`API 오류 ${response.status}`);
      return data;
    }finally{clearTimeout(timer)}
  }

  async function load(){
    render(saved,{name:saved.name});
    try{
      const data=await api('/api/me');
      const profile=data.profile||{};
      const merged={...saved,...profile,role:profile.role||saved.role,name:profile.name||saved.name,campus:profile.campus||saved.campus};
      sessionStorage.setItem(UK,JSON.stringify(merged));
      render(profile,data.identity||{});
    }catch(error){
      $('profileStatus').textContent=error?.name==='AbortError'
        ? '사용자 정보 조회가 지연되고 있습니다. 저장된 로그인 정보로 대문을 표시합니다.'
        : `사용자 정보 확인 실패 · ${error.message||error}`;
    }
  }

  $('logoutBtn').addEventListener('click',async()=>{
    try{await api('/api/company-auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})}catch{}
    sessionStorage.removeItem(TK);
    sessionStorage.removeItem(UK);
    location.replace('./');
  });

  load();
})();
