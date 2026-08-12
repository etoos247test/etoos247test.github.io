
const DATA_FILES=["data-00.txt","data-01.txt","data-02.txt","data-03.txt","data-04.txt"];
const SUBJECTS=["국어","수학","통합사회","통합과학"];
const PREFIX={국어:"kor",수학:"math",통합사회:"soc",통합과학:"sci"};
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
const fmt=v=>v==null||!Number.isFinite(v)?"-":Math.round(v*100)/100;
let STORE=null,DS=null,showMode="all",lastRows=[];

async function loadData(){
  try{
    const parts=await Promise.all(DATA_FILES.map(x=>fetch(x+"?v=20260813b",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(x+" 로드 실패");return r.text()})));
    const bin=atob(parts.join(""));const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    if(!("DecompressionStream" in window))throw new Error("최신 Chrome·Edge·Safari에서 실행해 주세요.");
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const packed=JSON.parse(await new Response(stream).text());
    const unpackRow=(m,score,j)=>[String(j),...m.slice(0,7).map(x=>packed.str[x]),m[7],...score];
    STORE={default:0,datasets:packed.labels.map((label,i)=>({
      label,
      subjects:packed.subj[i],
      cum:packed.cum[i].map(r=>({u:r[0],s:r[1],p:r[2],r:r[3]})),
      support:packed.meta.map((m,j)=>unpackRow(m,packed.scores[j].slice(i*3,i*3+3),j))
    }))};
    init();
  }catch(e){$("#loadText").textContent="자료 로드 실패 · "+e.message;}
}
function init(){
  STORE.datasets.forEach((d,i)=>$("#dataset").insertAdjacentHTML("beforeend",`<option value="${i}">${esc(d.label)}</option>`));
  $("#dataset").value=String(STORE.default||0);
  buildScoreGrid();bind();applyDataset();$("#loading").classList.add("hidden");
}
function buildScoreGrid(){
  $("#scoreGrid").innerHTML=SUBJECTS.map(name=>{const p=PREFIX[name];return `<article class="subject" data-subject="${name}"><h3>${name}<span>${name.startsWith("통합")?"50점 만점":"100점 만점"}</span></h3><div class="inputs"><div class="field"><label>원점수</label><input id="${p}Raw" type="number" step="0.5"></div><div class="field"><label>표준점수</label><input id="${p}Std" type="number" step="1"></div><div class="field"><label>백분위</label><input id="${p}Pct" type="number" min="0" max="100" step="1"></div><div class="field"><label>등급</label><input id="${p}Grade" type="number" min="1" max="9" step="1"></div></div><div class="computed"><div><span>적용 원점수</span><b id="${p}RawOut">-</b><em id="${p}RawSrc"></em></div><div><span>적용 표준점수</span><b id="${p}StdOut">-</b><em id="${p}StdSrc"></em></div><div><span>적용 백분위</span><b id="${p}PctOut">-</b><em id="${p}PctSrc"></em></div><div><span>적용 등급</span><b id="${p}GradeOut">-</b><em id="${p}GradeSrc"></em></div></div></article>`}).join("");
}
function bind(){
  $("#dataset").addEventListener("change",applyDataset);$("#resetBtn").onclick=()=>{document.querySelectorAll(".inputs input").forEach(x=>x.value="");updateScores();render([])};
  document.querySelectorAll(".inputs input").forEach(x=>x.addEventListener("input",updateScores));
  ["basis","track","region","group","margin","keyword"].forEach(id=>$("#"+id).addEventListener(id==="keyword"?"input":"change",()=>{if(lastRows.length)search()}));
  $("#searchBtn").onclick=search;$("#fitOnly").onclick=()=>{showMode="fit";search()};$("#allBtn").onclick=()=>{showMode="all";search()};
}
function applyDataset(){
  DS=STORE.datasets[Number($("#dataset").value)||0];
  const regs=[...new Set(DS.support.map(r=>r[1]).filter(Boolean))].sort();$("#region").innerHTML='<option value="">전체</option>'+regs.map(x=>`<option>${esc(x)}</option>`).join("");
  $("#datasetNote").innerHTML=`<b>${esc(DS.label)}</b><br>지원참고표 ${DS.support.length.toLocaleString()}개 모집단위 · 상위누적 ${DS.cum.length.toLocaleString()}구간 · 국어/수학/통합사회/통합과학 원표백등 연결`;
  updateScores();search();
}
function interp(curve,from,to,x){
  const pts=curve.filter(r=>n(r[from])!=null&&n(r[to])!=null).map(r=>[n(r[from]),n(r[to])]).sort((a,b)=>a[0]-b[0]);
  if(!pts.length||x==null)return null;if(x<=pts[0][0])return pts[0][1];if(x>=pts.at(-1)[0])return pts.at(-1)[1];
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(x<=b[0]){if(a[0]===b[0])return b[1];const t=(x-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*t;}}
  return null;
}
function nearestGrade(curve,idx,x){if(x==null)return null;let best=null,d=Infinity;curve.forEach(r=>{const v=n(r[idx]);if(v==null)return;const nd=Math.abs(v-x);if(nd<d){d=nd;best=n(r[3])}});return best}
function subjectValue(name){
  const p=PREFIX[name],c=DS.subjects[name]||[];let raw=n($("#"+p+"Raw").value),std=n($("#"+p+"Std").value),pct=n($("#"+p+"Pct").value),grade=n($("#"+p+"Grade").value);
  const src={raw:raw!=null?"직접":"",std:std!=null?"직접":"",pct:pct!=null?"직접":"",grade:grade!=null?"직접":""};
  if(raw!=null){if(std==null){std=interp(c,0,1,raw);src.std="추산"}if(pct==null){pct=interp(c,0,2,raw);src.pct="추산"}if(grade==null){grade=nearestGrade(c,0,raw);src.grade="추산"}}
  else if(std!=null){raw=interp(c,1,0,std);src.raw="추산";if(pct==null){pct=interp(c,1,2,std);src.pct="추산"}if(grade==null){grade=nearestGrade(c,1,std);src.grade="추산"}}
  else if(pct!=null){raw=interp(c,2,0,pct);src.raw="추산";std=interp(c,2,1,pct);src.std="추산";if(grade==null){grade=nearestGrade(c,2,pct);src.grade="추산"}}
  else if(grade!=null){const rows=c.filter(r=>n(r[3])===grade);if(rows.length){raw=rows.reduce((a,r)=>a+n(r[0]),0)/rows.length;std=rows.reduce((a,r)=>a+n(r[1]),0)/rows.length;pct=rows.reduce((a,r)=>a+n(r[2]),0)/rows.length;src.raw=src.std=src.pct="등급추산"}}
  return {raw,std,pct,grade,src};
}
function setOut(p,k,v,src){$("#"+p+k+"Out").textContent=fmt(v);$("#"+p+k+"Src").textContent=src?`(${src})`:""}
function total(vals,key){return vals.every(v=>v[key]!=null)?vals.reduce((a,v)=>a+v[key],0):null}
function cumFor(metric,val){if(val==null)return null;let best=null,d=Infinity;for(const r of DS.cum){const v=n(r[metric]);if(v==null)continue;const nd=Math.abs(v-val);if(nd<d){d=nd;best=n(r.u)}}return best}
function currentTotals(){
  const vals=SUBJECTS.map(subjectValue);
  const raw=total(vals,"raw"),std=total(vals,"std");
  const pct=vals.every(v=>v.pct!=null)?vals[0].pct+vals[1].pct+(vals[2].pct+vals[3].pct)/2:null;
  return {vals,raw,std,pct,rr:cumFor("r",raw),sr:cumFor("s",std),pr:cumFor("p",pct)};
}
function updateScores(){
  if(!DS)return;const t=currentTotals();t.vals.forEach((v,i)=>{const p=PREFIX[SUBJECTS[i]];setOut(p,"Raw",v.raw,v.src.raw);setOut(p,"Std",v.std,v.src.std);setOut(p,"Pct",v.pct,v.src.pct);setOut(p,"Grade",v.grade,v.src.grade)});
  $("#rawTotal").textContent=fmt(t.raw);$("#stdTotal").textContent=fmt(t.std);$("#pctTotal").textContent=fmt(t.pct);$("#stdRank").textContent=t.sr==null?"-":`${fmt(t.sr)}%`;$("#pctRank").textContent=t.pr==null?"-":`${fmt(t.pr)}%`;
  const ranks=[["표준점수",t.sr],["백분위",t.pr],["원점수",t.rr]].filter(x=>x[1]!=null).sort((a,b)=>a[1]-b[1]);
  if(ranks.length<2)$("#advantage").textContent="점수를 입력하면 표준점수·백분위·원점수 중 어느 지표에서 상대적으로 유리한지 비교합니다.";
  else{const gap=ranks.at(-1)[1]-ranks[0][1];$("#advantage").innerHTML=gap<.5?`<b>점수유형 영향 작음</b> · 세 지표의 상위누적 차이가 크지 않습니다.`:`<b>${ranks[0][0]} 기준이 상대적으로 유리</b> · ${ranks[0][0]} 상위 ${fmt(ranks[0][1])}% / ${ranks.at(-1)[0]} 상위 ${fmt(ranks.at(-1)[1])}% (약 ${fmt(gap)}%p 차이)`;}
}
function chosenBasis(t){const b=$("#basis").value;if(b!=="auto")return b;if(t.std!=null)return"s";if(t.pct!=null)return"p";return"r"}
function statusFor(userRank,targetRank,margin){
  if(userRank==null||targetRank==null)return["unknown","점수확인"];
  const power=targetRank-userRank;if(power>=2)return["high","가능성 높음"];if(power>=0)return["fit","적정"];if(power>=-margin)return["reach","소신"];return["risk","위험"];
}
function search(){
  if(!DS)return;updateScores();const t=currentTotals(),basis=chosenBasis(t),uv=basis==="s"?t.std:basis==="p"?t.pct:t.raw,ur=cumFor(basis,uv),margin=Math.max(0,n($("#margin").value)??3);
  const track=$("#track").value,region=$("#region").value,group=$("#group").value,kw=$("#keyword").value.trim().toLowerCase();
  let rows=DS.support.map(r=>{const target=basis==="r"?n(r[9]):basis==="s"?n(r[10]):n(r[11]);const tr=cumFor(basis,target);const st=statusFor(ur,tr,margin);return {r,target,tr,st,power:tr!=null&&ur!=null?tr-ur:null}})
    .filter(o=>(!track||o.r[5]===track)&&(!region||o.r[1]===region)&&(!group||o.r[4]===group)&&(!kw||[o.r[1],o.r[2],o.r[3],o.r[5],o.r[6],o.r[7]].join(" ").toLowerCase().includes(kw)));
  if(showMode==="fit")rows=rows.filter(o=>o.st[0]==="high"||o.st[0]==="fit");
  const ord={high:0,fit:1,reach:2,risk:3,unknown:4};rows.sort((a,b)=>ord[a.st[0]]-ord[b.st[0]]||(a.tr??999)-(b.tr??999)||a.r[2].localeCompare(b.r[2],"ko"));
  lastRows=rows;render(rows,basis,uv,ur);
}
function render(rows,basis,uv,ur){
  const label={s:"표준점수",p:"백분위",r:"원점수"}[basis]||"";$("#summaryText").textContent=`${label} ${fmt(uv)} · 상위 ${ur==null?"-":fmt(ur)+"%"} · ${rows.length.toLocaleString()}개 모집단위`;
  if(!rows.length){$("#results").innerHTML='<div class="empty">조건에 맞는 모집단위가 없습니다.</div>';$("#more").textContent="";return}
  const max=300,show=rows.slice(0,max);$("#results").innerHTML=show.map(o=>{const r=o.r,gap=uv==null||o.target==null?null:uv-o.target;return `<article class="result"><div class="major"><h3>${esc(r[2])} · ${esc(r[7])}</h3><p>${esc(r[3])} · ${esc(r[4])}군 · ${esc(r[5])}${r[6]?` · ${esc(r[6])}`:""}${r[8]!=null?` · ${esc(r[8])}명`:""}</p></div><div class="metric"><span>지원기준 ${label}</span><b>${fmt(o.target)}</b></div><div class="metric optional"><span>필요점수 차이</span><b>${gap==null?"-":(gap>=0?"+":"")+fmt(gap)}</b></div><div class="metric optional"><span>기준 상위누적</span><b>${o.tr==null?"-":fmt(o.tr)+"%"}</b></div><span class="status ${o.st[0]}">${o.st[1]}</span></article>`}).join("");
  $("#more").textContent=rows.length>max?`상위 ${max.toLocaleString()}개만 표시했습니다. 검색어·지역·계열로 범위를 좁혀 주세요.`:"";
}
loadData();
