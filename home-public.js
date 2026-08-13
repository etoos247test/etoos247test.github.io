// Main-page module bootstrap: public home always loads; RBAC activates only after its API is deployed.
import('./home-public-core.js?v=20260813a').catch(err=>console.error('Public home module load failed',err));
import('./login-tabs.js?v=20260813a').catch(err=>console.error('Login tabs module load failed',err));

(async()=>{
  const token=sessionStorage.getItem('my247Session');
  if(!token)return;
  try{
    const r=await fetch('https://my247-api.etoos247test.workers.dev/api/rbac/catalog',{
      headers:{Authorization:`Bearer ${token}`},
      cache:'no-store'
    });
    if(r.ok)await import('./rbac-admin.js?v=20260813a');
  }catch{}
})();
