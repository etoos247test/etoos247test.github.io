const API='https://etoos247-qa-v2.etoos247test.workers.dev';
const TOKEN_KEY='etoostest2SessionToken',USER_KEY='etoostest2User';
function readUser(){try{const raw=sessionStorage.getItem(USER_KEY),token=sessionStorage.getItem(TOKEN_KEY);if(!raw||!token)return null;const d=JSON.parse(raw);return makeUser(d,token)}catch{return null}}
function makeUser(data,token){return {uid:data.uid||data.identity?.uid||'',email:data.email||data.identity?.email||'',displayName:data.name||data.identity?.name||'',getIdToken:async()=>sessionStorage.getItem(TOKEN_KEY)||token}}
async function call(path,body,token=''){const h={'Content-Type':'application/json'};if(token)h.Authorization=`Bearer ${token}`;const r=await fetch(`${API}${path}`,{method:'POST',headers:h,body:JSON.stringify(body||{}),cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||`API 오류 ${r.status}`);return d}
function notify(auth,user){auth.currentUser=user;for(const cb of auth.listeners)queueMicrotask(()=>cb(user))}
export function onAuthStateChanged(auth,callback){auth.listeners.add(callback);const user=readUser();auth.currentUser=user;queueMicrotask(()=>callback(user));return()=>auth.listeners.delete(callback)}
export async function signInWithPopup(auth){const id=document.getElementById('companyLoginId')?.value.trim(),password=document.getElementById('companyLoginPassword')?.value||'';if(!id||!password){const e=new Error('회사 ID와 비밀번호를 입력하세요.');e.code='auth/missing-credentials';throw e}const d=await call('/api/v2/login',{loginId:id,password});sessionStorage.setItem(TOKEN_KEY,d.sessionToken);const meta={uid:d.identity?.uid,email:d.identity?.email,name:d.identity?.name,mustChangePassword:d.mustChangePassword===true};sessionStorage.setItem(USER_KEY,JSON.stringify(meta));const user=makeUser(meta,d.sessionToken);notify(auth,user);window.etoosV2Auth?.setLastLogin?.(d);return {user}}
export async function signOut(auth){const token=sessionStorage.getItem(TOKEN_KEY);if(token){try{await call('/api/v2/logout',{},token)}catch{}}sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(USER_KEY);notify(auth,null)}
export async function setPersistence(){return true}
export const browserSessionPersistence={};
export function getAuth(){return {currentUser:readUser(),listeners:new Set()}}
export class GoogleAuthProvider{setCustomParameters(){}}
