const API='https://etoos247-qa-api.etoos247test.workers.dev';
const TOKEN_KEY='etoostest2CompanySession',USER_KEY='etoostest2CompanyUser';
function readUser(){try{const raw=sessionStorage.getItem(USER_KEY),token=sessionStorage.getItem(TOKEN_KEY);if(!raw||!token)return null;return makeUser(JSON.parse(raw),token)}catch{return null}}
function makeUser(data,token){return {uid:data.uid||data.identity?.uid||'',email:data.email||data.identity?.email||'',displayName:data.name||data.identity?.name||'',getIdToken:async()=>sessionStorage.getItem(TOKEN_KEY)||token}}
async function call(path,body,token=''){const headers={'Content-Type':'application/json'};if(token)headers.Authorization=`Bearer ${token}`;const response=await fetch(`${API}${path}`,{method:'POST',headers,body:JSON.stringify(body||{}),cache:'no-store'}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||`API 오류 ${response.status}`);return data}
function notify(auth,user){auth.currentUser=user;for(const callback of auth.listeners)queueMicrotask(()=>callback(user))}
export function onAuthStateChanged(auth,callback){auth.listeners.add(callback);const user=readUser();auth.currentUser=user;queueMicrotask(()=>callback(user));return()=>auth.listeners.delete(callback)}
export async function signInWithPopup(auth){const id=document.getElementById('companyLoginId')?.value.trim(),password=document.getElementById('companyLoginPassword')?.value||'';if(!id||!password){const error=new Error('회사 ID와 비밀번호를 입력하세요.');error.code='auth/missing-credentials';throw error}const data=await call('/api/company-auth/login',{loginId:id,password});sessionStorage.setItem(TOKEN_KEY,data.sessionToken);const meta={uid:data.identity?.uid,email:data.identity?.email,name:data.identity?.name,mustChangePassword:data.mustChangePassword===true};sessionStorage.setItem(USER_KEY,JSON.stringify(meta));const user=makeUser(meta,data.sessionToken);notify(auth,user);window.etoosCompanyAuth?.setLastLogin?.(data);return {user}}
export async function signOut(auth){const token=sessionStorage.getItem(TOKEN_KEY);if(token){try{await call('/api/company-auth/logout',{},token)}catch{}}sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(USER_KEY);notify(auth,null);if(location.pathname.includes('/etoostest2/workspace'))location.replace('./')}
export async function setPersistence(){return true}
export const browserSessionPersistence={};
export function getAuth(){return {currentUser:readUser(),listeners:new Set()}}
export class GoogleAuthProvider{setCustomParameters(){}}
