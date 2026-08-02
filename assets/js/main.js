(() => {
  const style = document.createElement('style');
  style.id = 'internal-use-notice-style';
  style.textContent = `
    .internal-use-notice{display:flex;align-items:flex-start;gap:12px;max-width:760px;margin:24px 0 4px;padding:14px 16px;border:1px solid rgba(255,199,82,.38);border-radius:15px;background:linear-gradient(135deg,rgba(255,181,57,.16),rgba(255,255,255,.055));color:#fff;box-shadow:0 12px 32px rgba(0,0,0,.16);backdrop-filter:blur(12px)}
    .internal-use-notice__mark{display:grid;place-items:center;flex:0 0 34px;width:34px;height:34px;border-radius:11px;background:#ffb63e;color:#101725;font-size:16px;font-weight:950;box-shadow:0 8px 22px rgba(255,182,62,.28)}
    .internal-use-notice__copy{min-width:0}
    .internal-use-notice__copy strong{display:block;margin-bottom:3px;color:#ffd991;font-size:12px;font-weight:950;letter-spacing:.08em}
    .internal-use-notice__copy p{margin:0;color:rgba(255,255,255,.78);font-size:13px;line-height:1.65}
    @media(max-width:560px){.internal-use-notice{margin-top:20px;padding:13px 14px}.internal-use-notice__copy p{font-size:12px}.internal-use-notice__mark{width:31px;height:31px;flex-basis:31px}}
    @media print{.internal-use-notice{display:none!important}}
  `;
  document.head.append(style);

  const installNotice = () => {
    const heroContent = document.querySelector('.hero .hero-content');
    if (!heroContent || heroContent.querySelector('.internal-use-notice')) return;
    const notice = document.createElement('div');
    notice.className = 'internal-use-notice';
    notice.setAttribute('role', 'note');
    notice.innerHTML = `
      <span class="internal-use-notice__mark" aria-hidden="true">i</span>
      <div class="internal-use-notice__copy">
        <strong>학원 내부 운영 전용</strong>
        <p>본 페이지는 외부 홍보·공개용이 아니라, 이투스247학원 내부 관리와 테스트 운영을 위해 사용하는 전용 화면입니다.</p>
      </div>
    `;
    const buttons = heroContent.querySelector('.hero-buttons');
    if (buttons) heroContent.insertBefore(notice, buttons);
    else heroContent.append(notice);
  };

  const loadEffects = () => {
    if (document.querySelector('script[data-entry-effects]')) return;
    const script = document.createElement('script');
    script.src = './assets/js/entry-effects.js';
    script.async = false;
    script.dataset.entryEffects = 'true';
    document.head.append(script);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installNotice, { once: true });
  } else {
    installNotice();
  }
  loadEffects();
})();
