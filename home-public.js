// Main-page module bootstrap: keep public-home behavior and access control isolated.
Promise.all([
  import('./home-public-core.js?v=20260813a'),
  import('./rbac-admin.js?v=20260813a')
]).catch(err=>console.error('MY247 module load failed',err));
