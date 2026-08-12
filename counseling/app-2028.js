(()=>{
const COUNSEL_STORAGE='etoos247_counseling_preview_v1';
const SCORE_STORAGE='etoos247_mock_scores_2028_preview_v1';
const students=[
  {id:'M001',name:'김도윤',campus:'수성1관'},
  {id:'M002',name:'이서윤',campus:'수성1관'},
  {id:'M003',name:'박준호',campus:'수성1관'},
  {id:'M004',name:'최지우',campus:'수성2관'},
  {id:'M005',name:'정민재',campus:'수성2관'}
];
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const localStamp=iso=>new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));
const fmt=v=>v==null||v===''||Number.isNaN(Number(v))?'-':String(v);
const avg=vals=>{const a=vals.filter(v=>v!=null&&v!=='').map(Number).filter(Number.isFinite);return a.length?Math.round((a.reduce((x,y)=>x+y,0)/a.length)*10)/10:null};
const num=id=>{const el=$(id);if(!el||el.value==='')return null;const n=Number(el.value);return Number.isFinite(n)?n:null};
const withInquiry=r=>({...r,
  inquiryStd:avg([r.socialStd,r.scienceStd]),
  inquiryPct:avg([r.socialPct,r.sciencePct]),
  inquiryGrade:avg([r.socialGrade,r.scienceGrade])
});
function read(key){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}}
function write(key,v){localStorage.setItem(key,JSON.stringify(v))}
function seedCounsel(){
  if(localStorage.getItem(COUNSEL_STORAGE))return;
  write(COUNSEL_STORAGE,[
    {id:'demo-c1',studentId:'M001',studentName:'김도윤',subject:'수학',counselor:'교사 자동입력',counselingDate:today(),inputAt:new Date().toISOString(),counseleeType:'학생',counseleeName:'김도윤',content:'주간 학습계획과 오답 정리 방식을 점검했습니다.',demo:true},
    {id:'demo-c2',studentId:'M002',studentName:'이서윤',subject:'입시',counselor:'교사 자동입력',counselingDate:today(),inputAt:new Date().toISOString(),counseleeType:'학생',counseleeName:'이서윤',content:'희망 대학과 현재 성적 흐름을 기준으로 학습 우선순위를 정리했습니다.',demo:true}
  ]);
}
function seedScores(){
  if(localStorage.getItem(SCORE_STORAGE))return;
  write(SCORE_STORAGE,[
    {id:'demo-s1',studentId:'M001',studentName:'김도윤',examDate:'2027-03-18',examName:'3월 개정형 진단 · 예시',korStd:118,korPct:78,korGrade:3,mathStd:122,mathPct:82,mathGrade:3,engGrade:2,socialStd:58,socialPct:76,socialGrade:3,scienceStd:55,sciencePct:71,scienceGrade:4,demo:true},
    {id:'demo-s2',studentId:'M001',studentName:'김도윤',examDate:'2027-06-10',examName:'6월 개정형 모의평가 · 예시',korStd:124,korPct:84,korGrade:3,mathStd:128,mathPct:88,mathGrade:2,engGrade:2,socialStd:61,socialPct:81,socialGrade:3,scienceStd:59,sciencePct:77,scienceGrade:3,demo:true},
    {id:'demo-s3',studentId:'M001',studentName:'김도윤',examDate:'2027-08-19',examName:'8월 개정형 모의평가 · 예시',korStd:128,korPct:88,korGrade:2,mathStd:132,mathPct:91,mathGrade:2,engGrade:1,socialStd:64,socialPct:85,socialGrade:2,scienceStd:62,sciencePct:82,scienceGrade:3,demo:true},
    {id:'demo-s4',studentId:'M002',studentName:'이서윤',examDate:'2027-06-10',examName:'6월 개정형 모의평가 · 예시',korStd:130,korPct:90,korGrade:2,mathStd:125,mathPct:85,mathGrade:3,engGrade:2,socialStd:67,socialPct:91,socialGrade:2,scienceStd:60,sciencePct:79,scienceGrade:3,demo:true}
  ]);
}
function counselStudent(){return students.find(s=>s.id===$('#counselStudent')?.value)||students[0]}
function scoreStudent(){return students.find(s=>s.id===$('#scoreStudent')?.value)||students[0]}
function renderCounsel(){
  const s=counselStudent();
  const rows=read(COUNSEL_STORAGE).filter(r=>r.studentId===s.id).sort((a,b)=>String(b.counselingDate||'').localeCompare(String(a.counselingDate||''))||String(b.inputAt||'').localeCompare(String(a.inputAt||'')));
  $('#studentLogTitle').textContent=`${s.name} 학생 상담일지`;
  $('#studentLogCount').textContent=`${rows.length}건`;
  const box=$('#studentCounselingList');
  if(!rows.length){box.innerHTML='<div class="counseling-empty">등록된 상담기록이 없습니다.</div>';return}
  box.innerHTML=rows.map(r=>`<article class="counseling-record"><div class="record-date"><strong>${esc(r.counselingDate)}</strong><span>${esc(r.subject)}</span></div><div class="record-body"><div class="record-meta"><b>${esc(r.counselor)}</b><span>피상담자 ${esc(r.counseleeType)} · ${esc(r.counseleeName||'-')}</span><time>입력 ${esc(localStamp(r.inputAt))}</time>${r.demo?'<em>예시</em>':''}</div><p>${esc(r.content)}</p></div></article>`).join('');
}
function syncCounselStudent(){
  const s=counselStudent();
  $('#studentLinkKey').textContent=`${s.id} · ${s.name} · ${s.campus}`;
  if($('#counseleeType').value==='학생')$('#counseleeName').value=s.name;
  if($('#scoreStudent').value!==s.id)$('#scoreStudent').value=s.id;
  renderCounsel();renderScores();
}
function syncScoreStudent(){
  const s=scoreStudent();
  if($('#counselStudent').value!==s.id)$('#counselStudent').value=s.id;
  $('#studentLinkKey').textContent=`${s.id} · ${s.name} · ${s.campus}`;
  if($('#counseleeType').value==='학생')$('#counseleeName').value=s.name;
  renderCounsel();renderScores();
}
function syncCounselee(){
  const s=counselStudent();
  if($('#counseleeType').value==='학생')$('#counseleeName').value=s.name;
  else if($('#counseleeName').value===s.name)$('#counseleeName').value='';
}
function updateInquiryPreview(){
  const std=avg([num('#socialStd'),num('#scienceStd')]);
  const pct=avg([num('#socialPct'),num('#sciencePct')]);
  const grade=avg([num('#socialGrade'),num('#scienceGrade')]);
  $('#inquiryStd').value=std??'';$('#inquiryPct').value=pct??'';$('#inquiryGrade').value=grade??'';
}
function scoreRows(){
  const s=scoreStudent();
  return read(SCORE_STORAGE).filter(r=>r.studentId===s.id).map(withInquiry).sort((a,b)=>String(a.examDate||'').localeCompare(String(b.examDate||'')));
}
function renderSummary(rows,s){
  const box=$('#scoreSummary');
  if(!rows.length){box.innerHTML=`<article><small>누계 시험</small><strong>0회</strong><span>${esc(s.name)} 학생</span></article><article><small>최근 탐구평균 백분위</small><strong>-</strong><span>성적 입력 전</span></article><article><small>최근 탐구평균 등급</small><strong>-</strong><span>성적 입력 전</span></article>`;return}
  const last=rows.at(-1);
  box.innerHTML=`<article><small>누계 시험</small><strong>${rows.length}회</strong><span>${esc(last.examName)}</span></article><article><small>최근 탐구평균 백분위</small><strong>${fmt(last.inquiryPct)}</strong><span>통합사회 ${fmt(last.socialPct)} · 통합과학 ${fmt(last.sciencePct)}</span></article><article><small>최근 탐구평균 등급</small><strong>${fmt(last.inquiryGrade)}</strong><span>통합사회 ${fmt(last.socialGrade)} · 통합과학 ${fmt(last.scienceGrade)}</span></article>`;
}
function renderTable(rows){
  const wrap=$('#scoreTableWrap');
  if(!rows.length){wrap.innerHTML='<div class="score-empty">등록된 모의고사 성적이 없습니다.</div>';return}
  const desc=[...rows].reverse();
  wrap.innerHTML=`<table class="score-table"><thead><tr><th>시험</th><th>국어 표</th><th>국어 백</th><th>국어 등</th><th>수학 표</th><th>수학 백</th><th>수학 등</th><th>영어 등</th><th>통합사회 표</th><th>통합사회 백</th><th>통합사회 등</th><th>통합과학 표</th><th>통합과학 백</th><th>통합과학 등</th><th>탐구평균 표</th><th>탐구평균 백</th><th>탐구평균 등</th></tr></thead><tbody>${desc.map(r=>`<tr><td class="exam-cell"><strong>${esc(r.examName)}${r.demo?'<span class="demo-tag">예시</span>':''}</strong><span>${esc(r.examDate)}</span></td><td>${fmt(r.korStd)}</td><td>${fmt(r.korPct)}</td><td>${fmt(r.korGrade)}</td><td>${fmt(r.mathStd)}</td><td>${fmt(r.mathPct)}</td><td>${fmt(r.mathGrade)}</td><td>${fmt(r.engGrade)}</td><td>${fmt(r.socialStd)}</td><td>${fmt(r.socialPct)}</td><td>${fmt(r.socialGrade)}</td><td>${fmt(r.scienceStd)}</td><td>${fmt(r.sciencePct)}</td><td>${fmt(r.scienceGrade)}</td><td class="avg-cell">${fmt(r.inquiryStd)}</td><td class="avg-cell">${fmt(r.inquiryPct)}</td><td class="avg-cell">${fmt(r.inquiryGrade)}</td></tr>`).join('')}</tbody></table>`;
}
function drawChart(rows){
  const svg=$('#scoreChart'),metric=$('#scoreGraphMetric').value,W=900,H=350,L=60,R=24,T=28,B=62,PW=W-L-R,PH=H-T-B;
  let series=[];let yTicks=[];let y;
  if(metric==='standard'){
    series=[{key:'korStd',label:'국어',cls:'korean'},{key:'mathStd',label:'수학',cls:'math'},{key:'socialStd',label:'통합사회',cls:'social'},{key:'scienceStd',label:'통합과학',cls:'science'},{key:'inquiryStd',label:'탐구평균',cls:'inquiryavg'}];
    const vals=rows.flatMap(r=>series.map(s=>Number(r[s.key])).filter(Number.isFinite));
    const min=vals.length?Math.floor((Math.min(...vals)-5)/10)*10:40,max=vals.length?Math.ceil((Math.max(...vals)+5)/10)*10:140,span=Math.max(20,max-min),step=span/4;
    yTicks=[0,1,2,3,4].map(i=>Math.round((max-step*i)*10)/10);y=v=>T+(max-v)/(max-min||1)*PH;
  }else if(metric==='percentile'){
    series=[{key:'korPct',label:'국어',cls:'korean'},{key:'mathPct',label:'수학',cls:'math'},{key:'socialPct',label:'통합사회',cls:'social'},{key:'sciencePct',label:'통합과학',cls:'science'},{key:'inquiryPct',label:'탐구평균',cls:'inquiryavg'}];
    yTicks=[100,75,50,25,0];y=v=>T+(100-v)/100*PH;
  }else{
    series=[{key:'korGrade',label:'국어',cls:'korean'},{key:'mathGrade',label:'수학',cls:'math'},{key:'engGrade',label:'영어',cls:'english'},{key:'socialGrade',label:'통합사회',cls:'social'},{key:'scienceGrade',label:'통합과학',cls:'science'},{key:'inquiryGrade',label:'탐구평균',cls:'inquiryavg'}];
    yTicks=[1,3,5,7,9];y=v=>T+(v-1)/8*PH;
  }
  const x=i=>rows.length<=1?L+PW/2:L+i*(PW/(rows.length-1));let html='';
  yTicks.forEach(v=>{const yy=y(v);html+=`<line class="chart-grid" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"></line><text class="chart-axis-label" x="${L-12}" y="${yy+4}" text-anchor="end">${v}</text>`});
  if(!rows.length){html+=`<text x="450" y="175" text-anchor="middle" class="chart-axis-label">등록된 성적이 없습니다.</text>`;svg.innerHTML=html;$('#scoreLegend').innerHTML='';return}
  rows.forEach((r,i)=>{const label=(r.examDate||'').slice(5).replace('-','.');html+=`<text class="chart-x-label" x="${x(i)}" y="${H-26}" text-anchor="middle">${esc(label)}</text>`});
  series.forEach(s=>{const pts=rows.map((r,i)=>({x:x(i),v:r[s.key]})).filter(p=>p.v!=null&&Number.isFinite(Number(p.v))).map(p=>({...p,y:y(Number(p.v))}));if(!pts.length)return;const d=pts.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');html+=`<path d="${d}" class="chart-line series-${s.cls}"></path>`;pts.forEach(p=>html+=`<circle cx="${p.x}" cy="${p.y}" r="4.5" class="chart-point series-${s.cls}"><title>${esc(s.label)} ${fmt(p.v)}</title></circle>`)});
  svg.innerHTML=html;$('#scoreLegend').innerHTML=series.map(s=>`<span class="${s.cls}"><i></i>${s.label}</span>`).join('');
}
function renderScores(){
  const s=scoreStudent(),rows=scoreRows();
  $('#scoreGraphTitle').textContent=`${s.name} 학생 2028 개정형 모의고사 추이`;
  $('#scoreTableTitle').textContent=`${s.name} 학생 모의고사 성적 누계`;
  $('#scoreCount').textContent=`${rows.length}회`;
  renderSummary(rows,s);renderTable(rows);drawChart(rows);
}
function clearScore(){
  ['#korStd','#korPct','#korGrade','#mathStd','#mathPct','#mathGrade','#engGrade','#socialStd','#socialPct','#socialGrade','#scienceStd','#sciencePct','#scienceGrade'].forEach(id=>{if($(id))$(id).value=''});
  $('#examName').value='';updateInquiryPreview();
}
seedCounsel();seedScores();
const options=students.map(s=>`<option value="${s.id}">${s.id} · ${s.name} · ${s.campus}</option>`).join('');
$('#counselStudent').innerHTML=options;$('#scoreStudent').innerHTML=options;
$('#counselDate').value=today();$('#counselInputDate').value=localStamp(new Date().toISOString());$('#examDate').value=today();
$('#counselStudent').addEventListener('change',syncCounselStudent);$('#scoreStudent').addEventListener('change',syncScoreStudent);$('#counseleeType').addEventListener('change',syncCounselee);$('#scoreGraphMetric').addEventListener('change',renderScores);
['#socialStd','#socialPct','#socialGrade','#scienceStd','#sciencePct','#scienceGrade'].forEach(id=>$(id).addEventListener('input',updateInquiryPreview));
$('#counselingForm').addEventListener('submit',e=>{
  e.preventDefault();const s=counselStudent(),inputAt=new Date().toISOString();
  const record={id:'c-'+Date.now(),studentId:s.id,studentName:s.name,subject:$('#counselSubject').value,counselor:'교사 자동입력',counselingDate:$('#counselDate').value,inputAt,counseleeType:$('#counseleeType').value,counseleeName:$('#counseleeName').value.trim(),content:$('#counselBody').value.trim(),demo:false};
  if(!record.counselingDate||!record.content)return;const all=read(COUNSEL_STORAGE);all.push(record);write(COUNSEL_STORAGE,all);$('#counselInputDate').value=localStamp(inputAt);$('#counselBody').value='';renderCounsel();
});
$('#scoreForm').addEventListener('submit',e=>{
  e.preventDefault();const s=scoreStudent();
  const record={id:'s-'+Date.now(),studentId:s.id,studentName:s.name,examDate:$('#examDate').value,examName:$('#examName').value.trim(),korStd:num('#korStd'),korPct:num('#korPct'),korGrade:num('#korGrade'),mathStd:num('#mathStd'),mathPct:num('#mathPct'),mathGrade:num('#mathGrade'),engGrade:num('#engGrade'),socialStd:num('#socialStd'),socialPct:num('#socialPct'),socialGrade:num('#socialGrade'),scienceStd:num('#scienceStd'),sciencePct:num('#sciencePct'),scienceGrade:num('#scienceGrade'),demo:false};
  if(!record.examDate||!record.examName)return;const all=read(SCORE_STORAGE);all.push(record);write(SCORE_STORAGE,all);clearScore();renderScores();
});
syncCounselStudent();updateInquiryPreview();renderScores();
})();