import baseWorker from './index.js';

const E = new TextEncoder();
const ITER = 100000;
const CAMPUS = new Set(['suseong1', 'suseong2']);
const ACCOUNT_TYPES = new Set(['student', 'teacher', 'submaster']);
const ALL_PERMISSIONS = [
  ['account.read','계정·조직','계정 목록 조회'],
  ['account.create.student','계정·조직','학생 ID 발급'],
  ['account.create.teacher','계정·조직','교사 ID 발급'],
  ['account.create.submaster','계정·조직','준마스터 ID 발급'],
  ['account.password.reset','계정·조직','임시 비밀번호 초기화'],
  ['account.status.manage','계정·조직','계정 사용·중지 관리'],
  ['account.permission.manage','계정·조직','권한·담당관 변경'],
  ['notice.read','공지','공지 조회'],
  ['notice.create','공지','공지 등록'],
  ['notice.edit','공지','공지 수정'],
  ['notice.delete','공지','공지 삭제'],
  ['schedule.read','시험일정','시험일정 조회'],
  ['schedule.create','시험일정','시험일정 등록'],
  ['schedule.edit','시험일정','시험일정 수정'],
  ['schedule.delete','시험일정','시험일정 삭제'],
  ['question.read','질의응답','학생 질문 조회'],
  ['question.reply','질의응답','학생 질문 답변'],
  ['question.close','질의응답','질문 종료'],
  ['admission.read','입시','입시탐색기·상담자료 조회'],
  ['counseling.read','상담','상담자료 조회'],
  ['counseling.write','상담','상담자료 등록·수정'],
  ['intake.read','접수','QR 접수 조회'],
  ['intake.manage','접수','상담배정·등록처리'],
  ['notification.read','알림','알림메시지 조회'],
  ['notification.send','알림','알림메시지 발송'],
  ['planner.read','플래너','학생 플래너 조회'],
  ['planner.stats.read','플래너','학습통계 조회']
];
const ALL_KEYS = new Set(ALL_PERMISSIONS.map(x => x[0]));
const LEGACY_TEACHER = new Set([
  'notice.read','notice.create','notice.edit','notice.delete',
  'schedule.read','schedule.create','schedule.edit','schedule.delete',
  'question.read','question.reply','question.close','admission.read'
]);

const now = () => new Date().toISOString();
const txt = (v, n = 2000) => String(v ?? '').trim().slice(0, n);
const lid = v => txt(v, 64).toUpperCase();
const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
class HttpError extends Error { constructor(status, message){ super(message); this.status = status; } }
const fail = (s,m) => { throw new HttpError(s,m); };
function cors(req, env){ const o=req.headers.get('origin'), a=env.ALLOWED_ORIGIN||'https://etoos247test.github.io'; return {'Access-Control-Allow-Origin':o===a?o:a,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, PATCH, OPTIONS','Access-Control-Max-Age':'86400','Vary':'Origin'}; }
function json(req, env, data, status=200){ return new Response(JSON.stringify(data), {status, headers:{...cors(req,env),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}}); }
async function sha(v){ return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', E.encode(v)))); }
async function derive(p,salt,it=ITER){ const k=await crypto.subtle.importKey('raw',E.encode(String(p)),'PBKDF2',false,['deriveBits']); return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:Math.min(it,100000)},k,256)); }
async function hashPassword(p){ p=String(p||''); if(p.length<5) fail(400,'비밀번호는 5자 이상이어야 합니다.'); const s=new Uint8Array(16); crypto.getRandomValues(s); return `pbkdf2-sha256$${ITER}$${hex(s)}$${hex(await derive(p,s))}`; }

async function actor(req, env){
  const m=/^Bearer\s+(sid_[A-Za-z0-9_-]+)$/.exec(req.headers.get('authorization')||'');
  if(!m) fail(401,'로그인이 필요합니다.');
  const h=await sha(m[1]);
  const u=await env.DB.prepare('SELECT u.*,s.expires_at FROM core_sessions s JOIN core_users u ON u.id=s.user_id WHERE s.token_hash=?').bind(h).first();
  if(!u || u.active!==1 || u.expires_at<=now()) fail(401,'유효하지 않은 로그인입니다.');
  return u;
}
async function userCampuses(env,u){
  if(u.role==='master') return ['suseong1','suseong2'];
  if(u.role==='student') return u.campus?[u.campus]:[];
  const r=await env.DB.prepare('SELECT campus FROM core_user_campuses WHERE user_id=? ORDER BY campus').bind(u.id).all();
  return r.results.map(x=>x.campus);
}
async function accountType(env,u){
  if(u.role==='master') return 'master';
  if(u.role==='student') return 'student';
  const r=await env.DB.prepare('SELECT account_type FROM core_user_profiles WHERE user_id=?').bind(u.id).first();
  return r?.account_type || 'teacher';
}
async function permissions(env,u){
  if(u.role==='master') return [...ALL_KEYS];
  if(u.role==='student') return [];
  const profile=await env.DB.prepare('SELECT account_type FROM core_user_profiles WHERE user_id=?').bind(u.id).first();
  if(!profile) return [...LEGACY_TEACHER];
  const r=await env.DB.prepare('SELECT permission_key FROM core_user_permissions WHERE user_id=? AND allowed=1').bind(u.id).all();
  return r.results.map(x=>x.permission_key).filter(x=>ALL_KEYS.has(x));
}
async function has(env,u,key){ return u.role==='master' || (await permissions(env,u)).includes(key); }
async function requirePermission(env,u,key){ if(!(await has(env,u,key))) fail(403,'이 기능을 사용할 권한이 없습니다.'); }
async function audit(env,u,action,key,detail=null){ await env.DB.prepare('INSERT INTO core_audit_logs(id,actor_id,action,target_type,target_key,detail_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),u.id,action,'user',key,detail?JSON.stringify(detail):null,now()).run(); }
async function byLogin(env,id){ return env.DB.prepare('SELECT * FROM core_users WHERE login_id=?').bind(lid(id)).first(); }
async function decorate(env,u){ return {accountType:await accountType(env,u),permissions:await permissions(env,u),campuses:await userCampuses(env,u)}; }
function permissionCatalog(){
  const groups={};
  for(const [key,group,label] of ALL_PERMISSIONS){ (groups[group] ||= []).push({key,label}); }
  return Object.entries(groups).map(([group,items])=>({group,items}));
}
async function visibleUser(env,actorUser,target){
  if(actorUser.role==='master') return true;
  const mine=new Set(await userCampuses(env,actorUser));
  const theirs=await userCampuses(env,target);
  return theirs.length>0 && theirs.every(c=>mine.has(c));
}
async function assertCampusSubset(env,actorUser,campuses){
  const clean=[...new Set((campuses||[]).filter(x=>CAMPUS.has(x)))];
  if(!clean.length) fail(400,'담당관을 하나 이상 선택하세요.');
  if(actorUser.role!=='master'){
    const mine=new Set(await userCampuses(env,actorUser));
    if(clean.some(c=>!mine.has(c))) fail(403,'본인 담당관 밖의 권한은 부여할 수 없습니다.');
  }
  return clean;
}
async function safeGrantable(env,actorUser,requested){
  const clean=[...new Set((requested||[]).filter(x=>ALL_KEYS.has(x)))];
  if(actorUser.role==='master') return clean;
  const mine=new Set(await permissions(env,actorUser));
  if(clean.some(x=>!mine.has(x))) fail(403,'본인에게 없는 권한은 다른 계정에 부여할 수 없습니다.');
  return clean;
}

async function listRbacUsers(req,env,u){
  await requirePermission(env,u,'account.read');
  const rows=(await env.DB.prepare("SELECT * FROM core_users ORDER BY CASE role WHEN 'master' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END,name").all()).results;
  const out=[];
  for(const x of rows){
    if(!(await visibleUser(env,u,x))) continue;
    const d=await decorate(env,x);
    out.push({loginId:x.login_id,name:x.name,role:x.role,accountType:d.accountType,campuses:d.campuses,campus:x.campus||'',studentNo:x.student_no||'',active:x.active===1,mustChangePassword:x.must_change_password===1,lastLoginAt:x.last_login_at||'',permissions:d.permissions});
  }
  return {users:out,permissionCatalog:permissionCatalog()};
}
async function createRbacUser(req,env,u){
  const b=await req.json().catch(()=>({}));
  const type=txt(b.accountType,20);
  if(!ACCOUNT_TYPES.has(type)) fail(400,'계정 구분을 확인하세요.');
  await requirePermission(env,u,`account.create.${type}`);
  const id=lid(b.loginId), name=txt(b.name,40);
  if(!/^[A-Z0-9._-]{3,64}$/.test(id)||name.length<2) fail(400,'계정 정보를 확인하세요.');
  if(await byLogin(env,id)) fail(409,'이미 사용 중인 ID입니다.');
  const uid=crypto.randomUUID(), n=now();
  let coreRole=type==='student'?'student':'teacher';
  let campus=null, studentNo=null, camps=[];
  if(type==='student'){
    campus=txt(b.campus,20);
    if(!CAMPUS.has(campus)) fail(400,'학생 소속관을 선택하세요.');
    await assertCampusSubset(env,u,[campus]);
    studentNo=lid(b.studentNo||id);
  } else camps=await assertCampusSubset(env,u,b.campuses);
  const perms=type==='student'?[]:await safeGrantable(env,u,b.permissions);
  const stm=[env.DB.prepare('INSERT INTO core_users(id,login_id,password_hash,name,role,campus,student_no,active,must_change_password,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,1,?,?)').bind(uid,id,await hashPassword(b.temporaryPassword),name,coreRole,campus,studentNo,n,n), env.DB.prepare('INSERT INTO core_user_profiles(user_id,account_type,created_at,updated_at) VALUES(?,?,?,?)').bind(uid,type,n,n)];
  for(const c of camps) stm.push(env.DB.prepare('INSERT INTO core_user_campuses(user_id,campus,created_at) VALUES(?,?,?)').bind(uid,c,n));
  for(const p of perms) stm.push(env.DB.prepare('INSERT INTO core_user_permissions(user_id,permission_key,allowed,granted_by,updated_at) VALUES(?,?,1,?,?)').bind(uid,p,u.id,n));
  await env.DB.batch(stm);
  await audit(env,u,'rbac.user.create',id,{accountType:type,campuses:type==='student'?[campus]:camps,permissions:perms});
  return {ok:true,loginId:id};
}
async function updateAccess(req,env,u,id){
  await requirePermission(env,u,'account.permission.manage');
  const target=await byLogin(env,id); if(!target) fail(404,'계정을 찾을 수 없습니다.');
  if(target.role==='master') fail(403,'마스터 권한은 이 화면에서 변경할 수 없습니다.');
  if(!(await visibleUser(env,u,target))) fail(403,'관리할 수 없는 계정입니다.');
  const b=await req.json().catch(()=>({}));
  const currentType=await accountType(env,target), requestedType=txt(b.accountType||currentType,20);
  if(!ACCOUNT_TYPES.has(requestedType)) fail(400,'계정 구분을 확인하세요.');
  if(requestedType!==currentType){ await requirePermission(env,u,`account.create.${requestedType}`); }
  const n=now(), stm=[];
  if(requestedType==='student'){
    if(target.role!=='student') fail(400,'교사·준마스터 계정을 학생 계정으로 전환하는 기능은 지원하지 않습니다. 새 학생 ID를 발급하세요.');
    const campus=txt(b.campus||target.campus,20); if(!CAMPUS.has(campus)) fail(400,'학생 소속관을 선택하세요.');
    await assertCampusSubset(env,u,[campus]);
    stm.push(env.DB.prepare('UPDATE core_users SET campus=?,updated_at=? WHERE id=?').bind(campus,n,target.id));
  } else {
    if(target.role==='student') fail(400,'학생 계정을 교사·준마스터로 전환하는 기능은 지원하지 않습니다. 새 직원 ID를 발급하세요.');
    const camps=await assertCampusSubset(env,u,b.campuses);
    const perms=await safeGrantable(env,u,b.permissions);
    stm.push(env.DB.prepare('DELETE FROM core_user_campuses WHERE user_id=?').bind(target.id));
    for(const c of camps) stm.push(env.DB.prepare('INSERT INTO core_user_campuses(user_id,campus,created_at) VALUES(?,?,?)').bind(target.id,c,n));
    stm.push(env.DB.prepare('DELETE FROM core_user_permissions WHERE user_id=?').bind(target.id));
    for(const p of perms) stm.push(env.DB.prepare('INSERT INTO core_user_permissions(user_id,permission_key,allowed,granted_by,updated_at) VALUES(?,?,1,?,?)').bind(target.id,p,u.id,n));
  }
  stm.push(env.DB.prepare('INSERT INTO core_user_profiles(user_id,account_type,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET account_type=excluded.account_type,updated_at=excluded.updated_at').bind(target.id,requestedType,n,n));
  await env.DB.batch(stm);
  await audit(env,u,'rbac.user.access',target.login_id,{accountType:requestedType,campuses:b.campuses||[b.campus].filter(Boolean),permissions:b.permissions||[]});
  return {ok:true};
}
async function resetRbacPassword(req,env,u,id){
  await requirePermission(env,u,'account.password.reset');
  const target=await byLogin(env,id); if(!target) fail(404,'계정을 찾을 수 없습니다.');
  if(target.role==='master'&&u.role!=='master') fail(403,'마스터 비밀번호는 초기화할 수 없습니다.');
  if(!(await visibleUser(env,u,target))) fail(403,'관리할 수 없는 계정입니다.');
  const b=await req.json().catch(()=>({})), n=now();
  await env.DB.batch([env.DB.prepare('UPDATE core_users SET password_hash=?,must_change_password=1,failed_count=0,locked_until=NULL,updated_at=? WHERE id=?').bind(await hashPassword(b.temporaryPassword),n,target.id),env.DB.prepare('DELETE FROM core_sessions WHERE user_id=?').bind(target.id)]);
  await audit(env,u,'rbac.user.password.reset',target.login_id); return {ok:true};
}
async function activeRbac(req,env,u,id){
  await requirePermission(env,u,'account.status.manage');
  const target=await byLogin(env,id); if(!target) fail(404,'계정을 찾을 수 없습니다.');
  if(target.role==='master') fail(403,'마스터 계정은 중지할 수 없습니다.');
  if(!(await visibleUser(env,u,target))) fail(403,'관리할 수 없는 계정입니다.');
  const b=await req.json().catch(()=>({})), a=b.active?1:0, n=now();
  await env.DB.batch([env.DB.prepare('UPDATE core_users SET active=?,updated_at=? WHERE id=?').bind(a,n,target.id),env.DB.prepare('DELETE FROM core_sessions WHERE user_id=?').bind(target.id)]);
  await audit(env,u,'rbac.user.active',target.login_id,{active:!!a}); return {ok:true};
}

function permissionForRequest(req,path,role){
  if(role==='student') return null;
  if(req.method==='GET'&&path==='/api/notices') return 'notice.read';
  if(req.method==='POST'&&path==='/api/notices') return 'notice.create';
  if(req.method==='PATCH'&&/^\/api\/notices\/[^/]+$/.test(path)) return 'notice.edit';
  if(req.method==='POST'&&/^\/api\/notices\/[^/]+\/delete$/.test(path)) return 'notice.delete';
  if(req.method==='GET'&&path==='/api/schedules') return 'schedule.read';
  if(req.method==='POST'&&path==='/api/schedules') return 'schedule.create';
  if(req.method==='PATCH'&&/^\/api\/schedules\/[^/]+$/.test(path)) return 'schedule.edit';
  if(req.method==='POST'&&/^\/api\/schedules\/[^/]+\/delete$/.test(path)) return 'schedule.delete';
  if(req.method==='GET'&&path==='/api/questions') return 'question.read';
  if(req.method==='GET'&&/^\/api\/questions\/[^/]+$/.test(path)) return 'question.read';
  if(req.method==='POST'&&/^\/api\/questions\/[^/]+\/messages$/.test(path)) return 'question.reply';
  if(req.method==='POST'&&/^\/api\/questions\/[^/]+\/close$/.test(path)) return 'question.close';
  if(req.method==='GET'&&/^\/api\/files\//.test(path)) return 'question.read';
  return null;
}
async function decorateBaseJson(req,env,res){
  if(!res.ok || !(res.headers.get('content-type')||'').includes('application/json')) return res;
  const d=await res.clone().json().catch(()=>null); if(!d?.user?.loginId) return res;
  const u=await byLogin(env,d.user.loginId); if(!u) return res;
  const extra=await decorate(env,u); d.user.accountType=extra.accountType; d.permissions=extra.permissions; d.campuses=extra.campuses;
  return json(req,env,d,res.status);
}

async function route(req,env){
  const url=new URL(req.url), path=url.pathname;
  if(req.method==='OPTIONS') return baseWorker.fetch(req,env);
  if(req.method==='POST'&&path==='/api/auth/login') return decorateBaseJson(req,env,await baseWorker.fetch(req,env));
  if(req.method==='GET'&&path==='/api/me'){
    const u=await actor(req,env), extra=await decorate(env,u);
    return json(req,env,{user:{loginId:u.login_id,name:u.name,role:u.role,campus:u.campus||'',studentNo:u.student_no||'',active:u.active===1,mustChangePassword:u.must_change_password===1,accountType:extra.accountType},campuses:extra.campuses,permissions:extra.permissions});
  }
  if(path.startsWith('/api/rbac/')){
    const u=await actor(req,env);
    if(req.method==='GET'&&path==='/api/rbac/catalog') return json(req,env,{permissionCatalog:permissionCatalog()});
    if(req.method==='GET'&&path==='/api/rbac/users') return json(req,env,await listRbacUsers(req,env,u));
    if(req.method==='POST'&&path==='/api/rbac/users') return json(req,env,await createRbacUser(req,env,u),201);
    let m;
    if(req.method==='PATCH'&&(m=/^\/api\/rbac\/users\/([^/]+)\/access$/.exec(path))) return json(req,env,await updateAccess(req,env,u,decodeURIComponent(m[1])));
    if(req.method==='POST'&&(m=/^\/api\/rbac\/users\/([^/]+)\/reset-password$/.exec(path))) return json(req,env,await resetRbacPassword(req,env,u,decodeURIComponent(m[1])));
    if(req.method==='PATCH'&&(m=/^\/api\/rbac\/users\/([^/]+)\/active$/.exec(path))) return json(req,env,await activeRbac(req,env,u,decodeURIComponent(m[1])));
    fail(404,'요청한 권한 관리 기능을 찾을 수 없습니다.');
  }
  if(path==='/api/users' || /^\/api\/users\//.test(path)){
    const u=await actor(req,env);
    if(u.role!=='master') fail(403,'마스터 전용 기존 계정 관리 API입니다.');
    return baseWorker.fetch(req,env);
  }
  const protectedKey = /^\/api\/(notices|schedules|questions|files)/.test(path);
  if(protectedKey){
    const u=await actor(req,env), key=permissionForRequest(req,path,u.role);
    if(key) await requirePermission(env,u,key);
  }
  return baseWorker.fetch(req,env);
}

export default {
  async fetch(req,env){
    try { return await route(req,env); }
    catch(e){ return json(req,env,{ok:false,message:e.message||'서버 오류'},e.status||500); }
  }
};
