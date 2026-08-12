(()=>{
const $=s=>document.querySelector(s);
const STORAGE='etoos247_counseling_preview_v1';
const students=[
  {id:'M001',name:'김도윤',campus:'수성1관'},
  {id:'M002',name:'이서윤',campus:'수성1관'},
  {id:'M003',name:'박준호',campus:'수성1관'},
  {id:'M004',name:'최지우',campus:'수성2관'},
  {id:'M005',name:'정민재',campus:'수성2관'}
];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const localStamp=iso=>{const d=new Date(iso);return new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)};
function read(){try{return JSON.parse(localStorage.getItem(STORAGE)||'[]')}catch{return[]}}
function write(v){localStorage.setItem(STORAGE,JSON.stringify(v))}
function seed(){if(localStorage.getItem(STORAGE))return;write([
  {id:'demo-1',studentId:'M001',studentName:'김도윤',subject:'수학',counselor:'교사 자동입력',counselingDate:today(),inputAt:new Date().toISOString(),counseleeType:'학생',counseleeName:'김도윤',content:'주간 학습계획과 수학 오답 정리 방식을 점검했습니다. 다음 상담 때 계획 이행률을 다시 확인합니다.',demo:true},
  {id:'demo-2',studentId:'M002',studentName:'이서윤',subject:'입시',counselor:'교사 자동입력',counselingDate:today(),inputAt:new Date().toISOString(),counseleeType:'학생',counseleeName:'이서윤',content:'희망 대학과 현재 성적 흐름을 기준으로 학습 우선순위를 임시 정리했습니다.',demo:true}
])}
function insertNav(){const nav=$('#academyTopNav');if(!nav||nav.querySelector('[data-counseling-link]'))return;const a=document.createElement('a');a.href='#counselingLog';a.dataset.counselingLink='1';a.textContent='상담일지';a.addEventListener('click',e=>{e.preventDefault();$('#counselingLog')?.scrollIntoView({behavior:'smooth',block:'start'})});const daily=nav.querySelector('[href="#dailyTest"]');if(daily)nav.insertBefore(a,daily);else nav.appendChild(a)}
function sectionHtml(){return `
<section id="counselingLog" class="info-section counseling-section">
  <div class="info-kicker"><small>06 · COUNSELING LOG</small><h3>상담일지</h3><p>학생을 선택하면 해당 학생의 상담기록만 누적해서 확인합니다.</p></div>
  <div class="counseling-wrap">
    <div class="counseling-alert"><strong>공개 미리보기</strong><span>현재는 임시 학생과 브라우저 저장을 사용합니다. 실제 개인정보는 입력하지 마세요. 로그인 적용 후 실제 학생 ID·교사 계정과 연결합니다.</span></div>
    <form id="counselingForm" class="counseling-form">
      <div class="counseling-field span-2"><label for="counselStudent">학생 선택</label><select id="counselStudent" name="studentId" required>${students.map(s=>`<option value="${s.id}">${s.id} · ${s.name} · ${s.campus}</option>`).join('')}</select></div>
      <div class="counseling-field"><label for="counselSubject">과목</label><select id="counselSubject" name="subject"><option>국어</option><option>수학</option><option>영어</option><option>탐구</option><option>입시</option><option>생활</option><option>기타</option></select></div>
      <div class="counseling-field"><label for="counselTeacher">교사</label><input id="counselTeacher" value="교사 자동입력" readonly><small>로그인 적용 시 현재 교사명·ID 자동 저장</small></div>
      <div class="counseling-field"><label for="counselDate">상담일</label><input id="counselDate" name="counselingDate" type="date" required></div>
      <div class="counseling-field"><label for="counselInputDate">입력일</label><input id="counselInputDate" readonly><small>저장 시각 자동 기록</small></div>
      <div class="counseling-field"><label for="counseleeType">피상담자</label><div class="counselee-row"><select id="counseleeType" name="counseleeType"><option>학생</option><option>학부모</option><option>학생+학부모</option><option>기타</option></select><input id="counseleeName" name="counseleeName" placeholder="피상담자 이름"></div></div>
      <div class="counseling-field"><label>학생 연동키</label><div id="studentLinkKey" class="student-link-key">-</div><small>학생 ID를 기준으로 상담기록 누적</small></div>
      <div class="counseling-field span-2"><label for="counselBody">상담 내용</label><textarea id="counselBody" name="content" rows="6" placeholder="상담 내용, 학습상태, 조정사항, 다음 확인사항 등을 기록하세요." required></textarea></div>
      <div class="counseling-actions span-2"><button type="submit">상담일지 저장</button><span>입력일과 교사는 직접 수정하지 않는 구조입니다.</span></div>
    </form>
    <div class="student-log-head"><div><small>STUDENT HISTORY</small><h4 id="studentLogTitle">학생별 상담일지</h4></div><span id="studentLogCount">0건</span></div>
    <div id="studentCounselingList" class="student-counseling-list"></div>
  </div>
</section>`}
function inject(){const root=$('#publicHomeInfo');if(!root||$('#counselingLog'))return;const qa=$('#qaPreview');if(qa)qa.insertAdjacentHTML('afterend',sectionHtml());else root.insertAdjacentHTML('beforeend',sectionHtml());bind()}
function selected(){return students.find(s=>s.id===$('#counselStudent')?.value)||students[0]}
function syncStudent(){const s=selected();$('#studentLinkKey').textContent=`${s.id} · ${s.name} · ${s.campus}`;if($('#counseleeType').value==='학생')$('#counseleeName').value=s.name;render()}
function syncCounselee(){const s=selected();if($('#counseleeType').value==='학생')$('#counseleeName').value=s.name;else if($('#counseleeName').value===s.name)$('#counseleeName').value=''}
function render(){const s=selected();const rows=read().filter(x=>x.studentId===s.id).sort((a,b)=>String(b.counselingDate||'').localeCompare(String(a.counselingDate||''))||String(b.inputAt||'').localeCompare(String(a.inputAt||'')));$('#studentLogTitle').textContent=`${s.name} 학생 상담일지`;$('#studentLogCount').textContent=`${rows.length}건`;const box=$('#studentCounselingList');if(!rows.length){box.innerHTML='<div class="counseling-empty">등록된 상담기록이 없습니다.</div>';return}box.innerHTML=rows.map(r=>`<article class="counseling-record"><div class="record-date"><strong>${esc(r.counselingDate)}</strong><span>${esc(r.subject)}</span></div><div class="record-body"><div class="record-meta"><b>${esc(r.counselor)}</b><span>피상담자 ${esc(r.counseleeType)} · ${esc(r.counseleeName||'-')}</span><time>입력 ${esc(localStamp(r.inputAt))}</time>${r.demo?'<em>예시</em>':''}</div><p>${esc(r.content)}</p></div></article>`).join('')}
function bind(){const form=$('#counselingForm');if(!form)return;$('#counselDate').value=today();$('#counselInputDate').value=localStamp(new Date().toISOString());$('#counselStudent').addEventListener('change',syncStudent);$('#counseleeType').addEventListener('change',syncCounselee);form.addEventListener('submit',e=>{e.preventDefault();const s=selected(),inputAt=new Date().toISOString(),record={id:'preview-'+Date.now(),studentId:s.id,studentName:s.name,subject:$('#counselSubject').value,counselor:'교사 자동입력',counselingDate:$('#counselDate').value,inputAt,counseleeType:$('#counseleeType').value,counseleeName:$('#counseleeName').value.trim(),content:$('#counselBody').value.trim(),demo:false};if(!record.counselingDate||!record.content)return;const all=read();all.push(record);write(all);$('#counselInputDate').value=localStamp(inputAt);$('#counselBody').value='';render();const btn=form.querySelector('button[type="submit"]');const old=btn.textContent;btn.textContent='저장됨 ✓';setTimeout(()=>btn.textContent=old,1300)});syncStudent()}
seed();
function start(){insertNav();inject();if(!$('#counselingLog'))setTimeout(start,80)}
start();
})();