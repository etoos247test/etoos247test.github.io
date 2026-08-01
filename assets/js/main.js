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

  const MAX_BYTES = 1024 * 1024;
  const TARGET_BYTES = 920 * 1024;
  const MAX_LONG_SIDE = 2200;
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
  let preparedFile = null;
  let processing = false;

  const showQaToast = (message, type = "") => {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`.trim();
    clearTimeout(showQaToast.timer);
    showQaToast.timer = setTimeout(() => { toast.className = "toast"; }, 4200);
  };

  const installUploadControls = () => {
    if (!input || !empty || !dropzone) return {};

    input.removeAttribute("capture");
    input.setAttribute("accept", "image/*");

    const limitNote = input.closest(".qa-field")?.querySelector(".qa-label-row > span");
    if (limitNote) limitNote.textContent = "사진첩·카메라 / 자동 변환 후 최대 1MB";

    const oldTrigger = empty.querySelector(".qa-select-button");
    if (oldTrigger) oldTrigger.remove();

    const guide = empty.querySelector("small");
    if (guide) guide.textContent = "선택한 사진은 WebP로 자동 최적화한 뒤 1MB 이하로 준비합니다.";

    const actions = document.createElement("div");
    actions.className = "qa-upload-actions";
    actions.innerHTML = `
      <button class="qa-upload-choice primary" id="qaGalleryBtn" type="button">사진첩에서 선택</button>
      <button class="qa-upload-choice secondary" id="qaCameraBtn" type="button">카메라 촬영</button>
    `;
    empty.append(actions);

    const status = document.createElement("small");
    status.id = "qaUploadStatus";
    status.className = "qa-upload-status";
    status.textContent = "원본이 커도 자동으로 줄여서 첨부합니다.";
    empty.append(status);

    const cameraInput = document.createElement("input");
    cameraInput.id = "qaCamera";
    cameraInput.type = "file";
    cameraInput.accept = "image/*";
    cameraInput.setAttribute("capture", "environment");
    cameraInput.setAttribute("aria-hidden", "true");
    dropzone.append(cameraInput);

    const style = document.createElement("style");
    style.textContent = `
      .qa-upload-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:18px}
      .qa-upload-choice{min-height:42px;padding:0 17px;border-radius:12px;font-size:12px;font-weight:900;cursor:pointer}
      .qa-upload-choice.primary{border:0;background:var(--navy);color:#fff}
      .qa-upload-choice.secondary{border:1px solid #b9c7dc;background:#fff;color:var(--navy)}
      .qa-upload-choice:disabled{opacity:.55;cursor:wait}
      .qa-upload-status{display:block!important;margin-top:10px!important;color:#718096!important}
      .qa-dropzone.processing{border-color:var(--blue);background:#edf4ff}
      @media(max-width:520px){.qa-upload-actions{width:100%}.qa-upload-choice{flex:1 1 140px}}
    `;
    document.head.append(style);

    const galleryButton = actions.querySelector("#qaGalleryBtn");
    const cameraButton = actions.querySelector("#qaCameraBtn");

    galleryButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if (!processing) input.click();
    });
    cameraButton?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if (!processing) cameraInput.click();
    });

    return { cameraInput, galleryButton, cameraButton, status };
  };

  const controls = installUploadControls();

  const setProcessing = (active, message = "") => {
    processing = active;
    dropzone?.classList.toggle("processing", active);
    if (controls.galleryButton) controls.galleryButton.disabled = active;
    if (controls.cameraButton) controls.cameraButton.disabled = active;
    if (controls.status && message) controls.status.textContent = message;
  };

  const clearFile = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = "";
    preparedFile = null;
    if (input) input.value = "";
    if (controls.cameraInput) controls.cameraInput.value = "";
    if (previewImage) previewImage.removeAttribute("src");
    empty?.classList.remove("hidden");
    preview?.classList.add("hidden");
    removeButton?.classList.add("hidden");
    if (controls.status) controls.status.textContent = "원본이 커도 자동으로 줄여서 첨부합니다.";
  };

  const loadImage = file => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이 사진 형식은 브라우저에서 변환할 수 없습니다."));
    };
    image.src = url;
  });

  const canvasToBlob = (canvas, type, quality) => new Promise(resolve => {
    canvas.toBlob(resolve, type, quality);
  });

  const makeOutputFile = (blob, originalName, extension, mimeType) => {
    const baseName = originalName.replace(/\.[^.]+$/, "") || "question-photo";
    return new File([blob], `${baseName}.${extension}`, {
      type: mimeType,
      lastModified: Date.now()
    });
  };

  const compressImage = async file => {
    if (!file.type.startsWith("image/")) {
      throw new Error("사진 파일만 첨부할 수 있습니다.");
    }

    const image = await loadImage(file);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) throw new Error("사진 크기를 확인할 수 없습니다.");

    let scale = Math.min(1, MAX_LONG_SIDE / Math.max(sourceWidth, sourceHeight));
    let quality = .9;

    for (let attempt = 0; attempt < 18; attempt += 1) {
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("이 기기에서는 사진을 변환할 수 없습니다.");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);

      let blob = await canvasToBlob(canvas, "image/webp", quality);
      let extension = "webp";
      let mimeType = "image/webp";

      if (!blob) {
        blob = await canvasToBlob(canvas, "image/jpeg", quality);
        extension = "jpg";
        mimeType = "image/jpeg";
      }
      if (!blob) throw new Error("사진 자동 변환에 실패했습니다.");

      if (blob.size <= TARGET_BYTES) {
        return makeOutputFile(blob, file.name, extension, mimeType);
      }

      if (quality > .62) {
        quality -= .07;
      } else {
        scale *= .84;
        quality = .84;
      }
    }

    throw new Error("사진을 1MB 이하로 줄일 수 없습니다. 다른 사진을 선택해 주세요.");
  };

  const syncPreparedFileToInput = file => {
    if (!input || typeof DataTransfer === "undefined") return;
    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
    } catch {
      // 일부 모바일 브라우저는 FileList 교체를 막는다. preparedFile은 별도로 유지한다.
    }
  };

  const applyFile = async file => {
    if (!file || processing) return;
    setProcessing(true, "사진을 1MB 이하로 자동 변환하는 중입니다…");

    try {
      const converted = await compressImage(file);
      if (converted.size > MAX_BYTES) {
        throw new Error("변환된 사진이 1MB를 초과했습니다.");
      }

      preparedFile = converted;
      syncPreparedFileToInput(converted);

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(converted);
      if (previewImage) previewImage.src = objectUrl;
      if (fileName) fileName.textContent = converted.name;
      if (fileSize) fileSize.textContent = `${(converted.size / 1024).toFixed(0)}KB · 자동 변환 완료`;
      empty?.classList.add("hidden");
      preview?.classList.remove("hidden");
      removeButton?.classList.remove("hidden");
      showQaToast(`사진을 ${(converted.size / 1024).toFixed(0)}KB로 최적화했습니다.`, "success");
    } catch (error) {
      clearFile();
      showQaToast(error instanceof Error ? error.message : "사진 처리에 실패했습니다.", "error");
    } finally {
      setProcessing(false, "원본이 커도 자동으로 줄여서 첨부합니다.");
    }
  };

  input?.addEventListener("change", () => applyFile(input.files?.[0]));
  controls.cameraInput?.addEventListener("change", () => applyFile(controls.cameraInput.files?.[0]));
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
    if (processing) {
      showQaToast("사진 변환이 끝난 뒤 등록해 주세요.");
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

  window.etoosQaAttachment = {
    getFile: () => preparedFile,
    clear: clearFile,
    maxBytes: MAX_BYTES
  };

  addEventListener("beforeunload", () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
})();
