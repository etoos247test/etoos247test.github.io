(() => {
  "use strict";

  const qaSection = document.querySelector(".qa-section");
  const qaLayout = qaSection?.querySelector(".qa-layout");
  if (!qaSection || !qaLayout || document.getElementById("qaDemoPlan")) return;

  const panel = document.createElement("section");
  panel.className = "qa-demo-plan reveal visible";
  panel.id = "qaDemoPlan";
  panel.setAttribute("aria-labelledby", "qaDemoPlanTitle");
  panel.innerHTML = `
    <div class="qa-demo-plan-head">
      <div>
        <span class="qa-demo-kicker">DEMO ROADMAP · 시연용 구성</span>
        <h3 id="qaDemoPlanTitle">시연 이후의 구축 과정과 관리 계획</h3>
        <p>현재 단계는 사진 첨부·자동 변환·질문 작성 흐름을 확인하기 위한 시연입니다. 지금 저장한 질문은 외부 서버로 전송되지 않고 현재 기기의 브라우저에만 남습니다.</p>
      </div>
      <div class="qa-demo-now">
        <strong>현재 시연 단계</strong>
        <span>로그인 없음</span>
        <span>브라우저 임시 저장</span>
        <span>다른 기기와 공유 안 됨</span>
      </div>
    </div>

    <div class="qa-roadmap-grid" aria-label="정식 구축 단계">
      <article class="qa-roadmap-card current">
        <span class="qa-roadmap-number">01</span>
        <small>NOW · 기능 시연</small>
        <h4>사용 흐름 검증</h4>
        <ul>
          <li>사진첩 선택·카메라 촬영 확인</li>
          <li>HEIC 호환성과 1MB 자동 처리 점검</li>
          <li>질문 입력·미리보기·로컬 저장 시연</li>
          <li>학생 사용 불편과 오류 사례 수집</li>
        </ul>
      </article>

      <article class="qa-roadmap-card">
        <span class="qa-roadmap-number">02</span>
        <small>NEXT · 소규모 시험</small>
        <h4>중앙 저장 구조 결정</h4>
        <ul>
          <li>소수 학생·교직원 대상 시험 운영</li>
          <li>중앙 저장 서버와 비용 구조 선정</li>
          <li>학생 식별 방식과 로그인 범위 결정</li>
          <li>사진·질문 보관기간과 삭제 기준 확정</li>
        </ul>
      </article>

      <article class="qa-roadmap-card">
        <span class="qa-roadmap-number">03</span>
        <small>BUILD · 관리 화면</small>
        <h4>교직원 답변 시스템</h4>
        <ul>
          <li>과목별 질문함과 담당자 배정</li>
          <li>답변 대기·확인 중·완료 상태 관리</li>
          <li>사진 확대·답변 작성·학생 확인 기능</li>
          <li>마스터 권한과 담당자 권한 분리</li>
        </ul>
      </article>

      <article class="qa-roadmap-card">
        <span class="qa-roadmap-number">04</span>
        <small>RUN · 정식 운영</small>
        <h4>운영 안정화</h4>
        <ul>
          <li>접근 기록·오류 기록·답변 지연 점검</li>
          <li>퇴원생 계정 차단과 자료 자동 정리</li>
          <li>백업·복구·개인정보 처리 기준 적용</li>
          <li>월별 이용량과 개선 요구 검토</li>
        </ul>
      </article>
    </div>

    <div class="qa-management-plan">
      <div class="qa-management-title">
        <span class="qa-demo-kicker">MANAGEMENT PLAN</span>
        <h4>정식 운영 시 관리 기준</h4>
      </div>
      <div class="qa-management-grid">
        <div><strong>권한 관리</strong><p>학생은 본인 질문만, 담당 교직원은 배정 질문만, 마스터는 전체 현황만 관리하도록 구분합니다.</p></div>
        <div><strong>처리 관리</strong><p>접수 → 담당 확인 → 답변 작성 → 학생 확인의 상태를 기록하고 장기 미처리 질문을 별도 표시합니다.</p></div>
        <div><strong>자료 관리</strong><p>사진과 질문의 보관기간을 정하고, 기간 만료·퇴원·삭제 요청 시 함께 제거되도록 구성합니다.</p></div>
        <div><strong>품질 관리</strong><p>사진 변환 실패, 글자 식별 불가, 중복 질문, 답변 지연 사례를 정기적으로 검토해 화면과 규칙을 보완합니다.</p></div>
      </div>
    </div>

    <div class="qa-demo-caution">
      <strong>시연 시 안내</strong>
      <p>현재 저장 내용은 같은 기기·같은 브라우저에서만 확인됩니다. 브라우저 데이터 삭제, 개인 모드 종료 또는 기기 변경 시 사라질 수 있으며 교직원에게 실제 전송되지 않습니다.</p>
    </div>
  `;

  qaLayout.insertAdjacentElement("afterend", panel);

  const style = document.createElement("style");
  style.id = "qaDemoPlanStyle";
  style.textContent = `
    .qa-demo-plan{position:relative;z-index:1;margin-top:28px;padding:clamp(24px,4vw,46px);border:1px solid rgba(255,255,255,.14);border-radius:30px;background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(255,255,255,.045));backdrop-filter:blur(16px)}
    .qa-demo-plan-head{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:28px;align-items:end;padding-bottom:28px;border-bottom:1px solid rgba(255,255,255,.12)}
    .qa-demo-kicker{display:block;color:var(--cyan);font-size:10px;font-weight:950;letter-spacing:.18em}
    .qa-demo-plan-head h3{margin:8px 0 12px;font-size:clamp(28px,3.2vw,46px);line-height:1.16;letter-spacing:-.045em}
    .qa-demo-plan-head p{max-width:820px;margin:0;color:rgba(255,255,255,.62);font-size:13px}
    .qa-demo-now{padding:20px;border:1px solid rgba(57,216,255,.24);border-radius:20px;background:rgba(57,216,255,.08)}
    .qa-demo-now strong{display:block;margin-bottom:12px;color:var(--cyan);font-size:13px}
    .qa-demo-now span{display:block;padding:7px 0;border-top:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.7);font-size:11px;font-weight:800}
    .qa-roadmap-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:24px}
    .qa-roadmap-card{position:relative;min-height:310px;padding:23px 20px;border:1px solid rgba(255,255,255,.12);border-radius:22px;background:rgba(5,12,25,.28);overflow:hidden}
    .qa-roadmap-card.current{border-color:rgba(57,216,255,.4);background:linear-gradient(145deg,rgba(57,216,255,.14),rgba(40,100,255,.08))}
    .qa-roadmap-number{position:absolute;right:16px;top:10px;color:rgba(255,255,255,.07);font-size:72px;font-weight:950;line-height:1}
    .qa-roadmap-card small{position:relative;display:block;color:var(--cyan);font-size:9px;font-weight:950;letter-spacing:.13em}
    .qa-roadmap-card h4{position:relative;margin:10px 0 18px;font-size:20px;letter-spacing:-.035em}
    .qa-roadmap-card ul{position:relative;list-style:none;margin:0;padding:0}
    .qa-roadmap-card li{padding:9px 0;border-top:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.64);font-size:11px}
    .qa-roadmap-card li:before{content:"+";margin-right:7px;color:var(--cyan);font-weight:950}
    .qa-management-plan{display:grid;grid-template-columns:220px 1fr;gap:24px;margin-top:16px;padding:24px;border:1px solid rgba(255,255,255,.12);border-radius:23px;background:rgba(255,255,255,.055)}
    .qa-management-title h4{margin:7px 0 0;font-size:23px;line-height:1.25;letter-spacing:-.04em}
    .qa-management-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
    .qa-management-grid>div{padding:17px;border-radius:17px;background:rgba(0,0,0,.16)}
    .qa-management-grid strong{display:block;color:#fff;font-size:13px}
    .qa-management-grid p{margin:6px 0 0;color:rgba(255,255,255,.55);font-size:10px;line-height:1.65}
    .qa-demo-caution{display:flex;gap:16px;align-items:flex-start;margin-top:16px;padding:17px 19px;border-radius:17px;background:#fff5db;color:#5e4511}
    .qa-demo-caution strong{flex:0 0 auto;font-size:12px}
    .qa-demo-caution p{margin:0;font-size:11px}
    @media(max-width:1100px){.qa-roadmap-grid{grid-template-columns:repeat(2,1fr)}.qa-management-plan{grid-template-columns:1fr}.qa-management-title{display:flex;align-items:end;justify-content:space-between;gap:16px}}
    @media(max-width:760px){.qa-demo-plan{padding:22px 16px;border-radius:23px}.qa-demo-plan-head{grid-template-columns:1fr}.qa-roadmap-grid{grid-template-columns:1fr}.qa-roadmap-card{min-height:auto}.qa-management-grid{grid-template-columns:1fr}.qa-management-title{display:block}.qa-demo-caution{display:block}.qa-demo-caution strong{display:block;margin-bottom:6px}}
  `;
  document.head.append(style);
})();