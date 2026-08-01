(() => {
  const header = document.getElementById("siteHeader");
  const progress = document.getElementById("scrollProgress");

  const updateScroll = () => {
    const y = window.scrollY;
    header?.classList.toggle("scrolled", y > 24);
    const max = document.documentElement.scrollHeight - innerHeight;
    if (progress) progress.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;
  };
  addEventListener("scroll", updateScroll, { passive: true });
  updateScroll();

  const clock = document.getElementById("liveClock");
  const dayMessage = document.getElementById("dayMessage");
  const updateClock = () => {
    const now = new Date();
    if (clock) clock.textContent = new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    }).format(now);
    const hour = now.getHours();
    const message = hour < 8 ? "하루를 준비하는 시간"
      : hour < 12 ? "집중력이 올라오는 오전"
      : hour < 14 ? "호흡을 고르는 시간"
      : hour < 18 ? "실행을 이어가는 오후"
      : hour < 22 ? "오늘을 완성하는 저녁"
      : "회복과 정리의 시간";
    if (dayMessage) dayMessage.textContent = message;
  };
  updateClock();
  setInterval(updateClock, 1000);

  const words = ["성장하는 하루", "집중하는 습관", "끝까지 가는 힘", "나만의 학습 흐름"];
  const wordElement = document.getElementById("rotatingWord");
  let wordIndex = 0;
  setInterval(() => {
    if (!wordElement) return;
    wordElement.animate(
      [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-12px)" }],
      { duration: 280, fill: "forwards" }
    ).onfinish = () => {
      wordIndex = (wordIndex + 1) % words.length;
      wordElement.textContent = words[wordIndex];
      wordElement.animate(
        [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 380, fill: "forwards" }
      );
    };
  }, 3300);

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: .12 });
  document.querySelectorAll(".reveal").forEach(element => revealObserver.observe(element));

  const routineMeter = document.getElementById("routineMeter");
  const routinePercent = document.getElementById("routinePercent");
  setTimeout(() => {
    if (routineMeter) routineMeter.style.width = "82%";
    let value = 0;
    const timer = setInterval(() => {
      value += 2;
      if (routinePercent) routinePercent.textContent = `${Math.min(value, 82)}%`;
      if (value >= 82) clearInterval(timer);
    }, 22);
  }, 700);

  document.querySelectorAll("[data-tilt]").forEach(card => {
    card.addEventListener("pointermove", event => {
      if (matchMedia("(max-width: 760px)").matches) return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      card.style.transform = `perspective(800px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-4px)`;
    });
    card.addEventListener("pointerleave", () => card.style.transform = "");
  });

  const spaces = {
    solitary: {
      initial: "S", english: "SOLITARY ROOM",
      title: "개인 성향에 맞춘 몰입 학습 공간",
      description: "시선 분산을 줄이고 자기 학습 흐름에 집중할 수 있도록 구성된 개인 학습 공간입니다."
    },
    refresh: {
      initial: "R", english: "REFRESH ROOM",
      title: "학습 리듬을 회복하는 휴식 공간",
      description: "집중을 오래 유지하기 위해 필요한 짧은 회복과 컨디션 조절을 돕는 공간입니다."
    },
    standing: {
      initial: "S", english: "STANDING ZONE",
      title: "졸음을 깨우고 집중을 전환하는 공간",
      description: "앉은 자세에서 흐트러진 집중을 전환하고 새로운 학습 리듬을 만들 수 있습니다."
    },
    lecture: {
      initial: "L", english: "LECTURE ROOM",
      title: "필요한 수업을 선택해 듣는 공간",
      description: "자기주도 학습을 중심에 두면서 과목별로 필요한 강의와 설명을 선택적으로 활용합니다."
    },
    coaching: {
      initial: "C", english: "COACHING ROOM",
      title: "계획과 결과를 함께 점검하는 상담 공간",
      description: "담임·학습관리 전문가와 현재 실행을 검토하고 다음 계획을 구체화하는 1:1 공간입니다."
    }
  };

  const visual = document.getElementById("spaceVisual");
  const initial = document.getElementById("spaceInitial");
  const english = document.getElementById("spaceEnglish");
  const title = document.getElementById("spaceTitle");
  const description = document.getElementById("spaceDescription");

  document.querySelectorAll(".tab-button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      const data = spaces[button.dataset.tab];
      if (!data) return;
      visual?.animate([{ opacity: .35 }, { opacity: 1 }], { duration: 400 });
      if (initial) initial.textContent = data.initial;
      if (english) english.textContent = data.english;
      if (title) title.textContent = data.title;
      if (description) description.textContent = data.description;
    });
  });
})();

(() => {
  const form = document.getElementById("qaForm");
  if (!form) return;

  const input = document.getElementById("qaImage");
  const dropzone = document.getElementById("qaDropzone");
  const empty = document.getElementById("qaUploadEmpty");
  const preview = document.getElementById("qaPreview");
  const previewImage = document.getElementById("qaPreviewImage");
  const fileName = document.getElementById("qaFileName");
  const fileSize = document.getElementById("qaFileSize");
  const removeButton = document.getElementById("qaRemoveFile");
  const text = document.getElementById("qaText");
  const charCount = document.getElementById("qaCharCount");
  const myQuestions = document.getElementById("qaMyQuestionsBtn");
  let objectUrl = "";

  const showQaToast = (message, type = "") => {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`.trim();
    clearTimeout(showQaToast.timer);
    showQaToast.timer = setTimeout(() => { toast.className = "toast"; }, 4200);
  };

  const clearFile = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = "";
    if (input) input.value = "";
    if (previewImage) previewImage.removeAttribute("src");
    empty?.classList.remove("hidden");
    preview?.classList.add("hidden");
    removeButton?.classList.add("hidden");
  };

  const applyFile = file => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      clearFile();
      showQaToast("JPG, PNG, WEBP 사진만 첨부할 수 있습니다.", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      clearFile();
      showQaToast("사진은 5MB 이하로 첨부해 주세요.", "error");
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    if (previewImage) previewImage.src = objectUrl;
    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)}MB`;
    empty?.classList.add("hidden");
    preview?.classList.remove("hidden");
    removeButton?.classList.remove("hidden");
  };

  input?.addEventListener("change", () => applyFile(input.files?.[0]));
  removeButton?.addEventListener("click", clearFile);

  ["dragenter", "dragover"].forEach(type => dropzone?.addEventListener(type, event => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach(type => dropzone?.addEventListener(type, event => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
  }));
  dropzone?.addEventListener("drop", event => {
    const file = event.dataTransfer?.files?.[0];
    if (file) applyFile(file);
  });

  text?.addEventListener("input", () => {
    if (charCount) charCount.textContent = String(text.value.length);
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const question = text?.value.trim() || "";
    if (!question) {
      text?.focus();
      showQaToast("질문 내용을 입력해 주세요.", "error");
      return;
    }
    const currentUser = window.etoosAuth?.auth?.currentUser;
    if (!currentUser) {
      showQaToast("질문 등록은 승인된 Google 계정 로그인 후 사용할 수 있습니다.");
      document.getElementById("qaLoginBtn")?.click();
      return;
    }
    showQaToast("질의응답 화면 구성이 완료되었습니다. Firebase Storage 연결 후 실제 등록이 활성화됩니다.", "success");
  });

  myQuestions?.addEventListener("click", () => {
    if (!window.etoosAuth?.auth?.currentUser) {
      showQaToast("로그인 후 내 질문함을 확인할 수 있습니다.");
      document.getElementById("qaLoginBtn")?.click();
      return;
    }
    showQaToast("내 질문함은 다음 단계에서 Firestore와 연결됩니다.");
  });

  addEventListener("beforeunload", () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
})();
