(()=>{
const STORAGE='etoos247_counseling_preview_v1';
const students=[
{id:'M001',name:'김도윤',campus:'수성1관'},{id:'M002',name:'이서윤',campus:'수성1관'},{id:'M003',name:'박준호',campus:'수성1관'},{id:'M004',name:'최지우',campus:'수성2관'},{id:'M005',name:'정민재',campus:'수성2관'}];
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const localStamp=iso=>{const d=new Date(iso);return new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)};
function read(){try{return JSON.parse(localStorage.getItem(STORAGE)||'[]')}catch{return[]}}
function write(v){localStorage.setItem(STORAGE,JSON.stringify(v))}
function seed(){if(localStorage.getItem(STORAGE))return;write([{id:'demo-1',studentId:'M001',studentName:'김도윤',subject:'수학',counselor:'교사 자동입력',counselingDate:today(),inputAt:new Date().toISOString(),counseleeType:'학생',counseleeName:'김도윤',content:'주간 학습계획과 수학 오답 정리 방식을 점검했습니다. 다음 상담 때 계획 이행률을 다시 확인합니다.',demo:true},{id:'demo-2',studentId:'M002',studentName:'이서윤',subject:'입시',counselor:'교사 자동입력',counselingDate:today(),inputAt:new Date().toISOString(),counseleeType:'학생',counseleeName:'이서윤',content:'희망 대학과 현재 성적 흐름을 기준으로 학습 우선순위를 임시 정리했습니다.',demo:true}])}
function selected(){return students.find(s=>s.id===$('#counselStudent').value)||students[0]}
function syncStudent(){const s=selected();$('#studentLinkKey').textContent=`${s.id} · ${s.name} · ${s.campus}`;if($('#counseleeType').value==='학생')$('#counseleeName').value=s.name;render()}
function syncCounselee(){const s=selected();if($('#counseleeType').value==='학생')$('#counseleeName').value=s.name;else if($('#counseleeName').value===s.name)$('#counseleeName').value=''}
function render(){const s=selected();const rows=read().filter(x=>x.studentId===s.id).sort((a,b)=>String(b.counselingDate||'').localeCompare(String(a.counselingDate||''))||String(b.inputAt||'').localeCompare(String(a.inputAt||'')));$('#studentLogTitle').textContent=`${s.name} 학생 상담일지`;$('#studentLogCount').textContent=`${rows.length}건`;const box=$('#studentCounselingList');if(!rows.length){box.innerHTML='<div class="counseling-empty">등록된 상담기록이 없습니다.</div>';return}box.innerHTML=rows.map(r=>`<article class="counseling-record"><div class="record-date"><strong>${esc(r.counselingDate)}</strong><span>${esc(r.subject)}</span></div><div class="record-body"><div class="record-meta"><b>${esc(r.counselor)}</b><span>피상담자 ${esc(r.counseleeType)} · ${esc(r.counseleeName||'-')}</span><time>입력 ${esc(localStamp(r.inputAt))}</time>${r.demo?'<em>예시</em>':''}</div><p>${esc(r.content)}</p></div></article>`).join('')}
seed();
$('#counselStudent').innerHTML=students.map(s=>`<option value="${s.id}">${s.id} · ${s.name} · ${s.campus}</option>`).join('');
$('#counselDate').value=today();
$('#counselInputDate').value=localStamp(new Date().toISOString());
$('#counselStudent').addEventListener('change',syncStudent);
$('#counseleeType').addEventListener('change',syncCounselee);
$('#counselingForm').addEventListener('submit',e=>{e.preventDefault();const s=selected(),inputAt=new Date().toISOString(),record={id:'preview-'+Date.now(),studentId:s.id,studentName:s.name,subject:$('#counselSubject').value,counselor:'교사 자동입력',counselingDate:$('#counselDate').value,inputAt,counseleeType:$('#counseleeType').value,counseleeName:$('#counseleeName').value.trim(),content:$('#counselBody').value.trim(),demo:false};if(!record.counselingDate||!record.content)return;const all=read();all.push(record);write(all);$('#counselInputDate').value=localStamp(inputAt);$('#counselBody').value='';render();const btn=$('#counselingForm button[type="submit"]');const old=btn.textContent;btn.textContent='저장됨 ✓';setTimeout(()=>btn.textContent=old,1300)});
syncStudent();
})();