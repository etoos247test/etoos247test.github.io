// 사용자 화면에는 저장·서버 구조 같은 내부 기술용어를 표시하지 않습니다.
(() => {
  const replacements = [
    [/Firebase 로그인 토큰으로 Cloudflare 권한을 확인하는 중입니다\./g, "로그인 정보와 이용 권한을 확인하고 있습니다."],
    [/학생 가입 요청이 D1에 저장됐으며 승인 대기 중입니다\./g, "학생 가입 요청이 접수되어 승인 대기 중입니다."],
    [/질문이 D1에 등록되고 사진은 비공개 R2에 저장됐습니다\./g, "질문을 등록했습니다. 첨부 사진도 함께 안전하게 저장됩니다."],
    [/비공개 R2 사진을 불러오는 중입니다\./g, "첨부 사진을 불러오는 중입니다."],
    [/Firebase 로그인/g, "로그인"],
    [/Cloudflare/g, ""],
    [/\bD1\b/g, ""],
    [/\bR2\b/g, ""],
    [/UID\s+[^·\n]+\s*·?\s*/g, ""],
    [/권한 master/g, "권한 관리자"],
    [/권한 teacher/g, "권한 교사"],
    [/권한 student/g, "권한 학생"],
    [/마스터 권한 확인 완료/g, "관리자 권한 확인 완료"],
    [/교사·마스터/g, "교사·관리자"],
    [/마스터/g, "관리자"],
    [/내부 학생번호/g, "학생번호"]
  ];

  function cleanText(text) {
    let value = text;
    for (const [pattern, replacement] of replacements) value = value.replace(pattern, replacement);
    return value.replace(/\s{2,}/g, " ").replace(/\s+·\s*$/g, "").trim();
  }

  function cleanElement(element) {
    if (!element) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (!node.nodeValue || !node.nodeValue.trim()) return;
      const cleaned = cleanText(node.nodeValue);
      if (cleaned !== node.nodeValue.trim()) node.nodeValue = cleaned;
    });
  }

  const targets = [document.getElementById("status"), document.getElementById("accountMeta")].filter(Boolean);
  targets.forEach(cleanElement);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") cleanElement(mutation.target.parentElement);
      else mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) cleanElement(node);
        else if (node.nodeType === Node.TEXT_NODE && node.parentElement) cleanElement(node.parentElement);
      });
    }
  });

  targets.forEach((target) => observer.observe(target, { childList:true, subtree:true, characterData:true }));
})();
