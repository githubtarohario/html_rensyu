(function () {
  const sidebar = document.getElementById("sidebar");
  const problemTitle = document.getElementById("problem-title");
  const problemDescription = document.getElementById("problem-description");
  const codeInput = document.getElementById("code-input");
  const codeHighlight = document.getElementById("code-highlight");
  const codeHighlightCode = document.getElementById("code-highlight-code");
  const preview = document.getElementById("preview");
  const runBtn = document.getElementById("run-btn");
  const saveBtn = document.getElementById("save-btn");
  const resetBtn = document.getElementById("reset-btn");
  const answerToggleBtn = document.getElementById("answer-toggle-btn");
  const answerCode = document.getElementById("answer-code");
  const answerCodeContent = document.getElementById("answer-code-content");

  const loginForm = document.getElementById("login-form");
  const nicknameInput = document.getElementById("nickname-input");
  const loginError = document.getElementById("login-error");
  const currentUser = document.getElementById("current-user");
  const currentUserName = document.getElementById("current-user-name");
  const logoutBtn = document.getElementById("logout-btn");

  let currentProblem = null;

  const NICKNAME_STORAGE_KEY = "html-rensyu:nickname";
  const NICKNAME_MAX_LENGTH = 20;

  function storageKey(problem) {
    return "html-rensyu:" + problem.id;
  }

  // サーバー側（api/_lib/nickname.js）のnormalizeNicknameと同じルール。
  // 前後の空白を除去し、空または20文字を超える場合はnullを返す。
  function normalizeNickname(raw) {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    if ([...trimmed].length > NICKNAME_MAX_LENGTH) return null;
    return trimmed;
  }

  function getSavedNickname() {
    try {
      return localStorage.getItem(NICKNAME_STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function saveNickname(name) {
    try {
      localStorage.setItem(NICKNAME_STORAGE_KEY, name);
    } catch (e) {
      // 保存できない環境（プライベートモード等）では無視する
    }
  }

  function clearNickname() {
    try {
      localStorage.removeItem(NICKNAME_STORAGE_KEY);
    } catch (e) {
      // 削除できない環境（プライベートモード等）では無視する
    }
  }

  function showLoginError(message) {
    loginError.textContent = message;
    loginError.classList.remove("hidden");
  }

  function hideLoginError() {
    loginError.textContent = "";
    loginError.classList.add("hidden");
  }

  function showLoggedInView(nickname) {
    loginForm.classList.add("hidden");
    currentUser.classList.remove("hidden");
    currentUserName.textContent = nickname;
  }

  function showLoggedOutView() {
    currentUser.classList.add("hidden");
    loginForm.classList.remove("hidden");
    currentUserName.textContent = "";
    nicknameInput.value = "";
    hideLoginError();
  }

  function loadSavedCode(problem) {
    try {
      const saved = localStorage.getItem(storageKey(problem));
      return saved === null ? problem.starter : saved;
    } catch (e) {
      return problem.starter;
    }
  }

  function saveCode(problem, code) {
    try {
      localStorage.setItem(storageKey(problem), code);
    } catch (e) {
      // 保存できない環境（プライベートモード等）では無視する
    }
  }

  function updateHighlight() {
    // 末尾に改行を1つ足しておくと、最後の空行でも高さがずれない
    codeHighlightCode.innerHTML = highlightHtml(codeInput.value) + "\n";
  }

  function runPreview() {
    preview.srcdoc = codeInput.value;
    if (currentProblem) {
      saveCode(currentProblem, codeInput.value);
    }
  }

  function hideAnswer() {
    answerCode.classList.add("hidden");
    answerToggleBtn.textContent = "💡 解答を見る";
  }

  function saveFile() {
    const filename = (currentProblem ? currentProblem.id : "practice") + ".html";
    const blob = new Blob([codeInput.value], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function selectProblem(problem, itemEl) {
    currentProblem = problem;

    document.querySelectorAll(".problem-item").forEach((el) => {
      el.classList.remove("active");
    });
    if (itemEl) itemEl.classList.add("active");

    problemTitle.textContent = problem.title;
    problemDescription.innerHTML = problem.description;
    codeInput.value = loadSavedCode(problem);
    updateHighlight();

    answerCodeContent.innerHTML = highlightHtml(problem.answer || "");
    hideAnswer();

    runPreview();
  }

  function buildSidebar() {
    let lastCategory = null;

    PROBLEMS.forEach((problem) => {
      if (problem.category !== lastCategory) {
        const categoryEl = document.createElement("div");
        categoryEl.className = "sidebar-category";
        categoryEl.textContent = problem.category;
        sidebar.appendChild(categoryEl);
        lastCategory = problem.category;
      }

      const itemEl = document.createElement("button");
      itemEl.type = "button";
      itemEl.className = "problem-item";
      itemEl.textContent = problem.title;
      itemEl.addEventListener("click", () => selectProblem(problem, itemEl));
      sidebar.appendChild(itemEl);
    });
  }

  runBtn.addEventListener("click", runPreview);

  resetBtn.addEventListener("click", () => {
    if (!currentProblem) return;
    codeInput.value = currentProblem.starter;
    updateHighlight();
    runPreview();
  });

  // 入力中はリアルタイムで色分けを更新する
  codeInput.addEventListener("input", updateHighlight);

  // 色分け表示とスクロール位置を同期する
  codeInput.addEventListener("scroll", () => {
    codeHighlight.scrollTop = codeInput.scrollTop;
    codeHighlight.scrollLeft = codeInput.scrollLeft;
  });

  // Ctrl+Enter / Cmd+Enter でも実行できるようにする
  codeInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runPreview();
    }
  });

  saveBtn.addEventListener("click", saveFile);

  answerToggleBtn.addEventListener("click", () => {
    const isHidden = answerCode.classList.contains("hidden");
    if (isHidden) {
      answerCode.classList.remove("hidden");
      answerToggleBtn.textContent = "🙈 解答を隠す";
    } else {
      hideAnswer();
    }
  });

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const normalized = normalizeNickname(nicknameInput.value);
    if (normalized === null) {
      showLoginError("ニックネームは1〜20文字で入力してください。");
      return;
    }
    saveNickname(normalized);
    showLoggedInView(normalized);
  });

  logoutBtn.addEventListener("click", () => {
    clearNickname();
    showLoggedOutView();
  });

  const savedNickname = getSavedNickname();
  if (savedNickname) {
    showLoggedInView(savedNickname);
  } else {
    showLoggedOutView();
  }

  buildSidebar();

  if (PROBLEMS.length > 0) {
    const firstItem = sidebar.querySelector(".problem-item");
    selectProblem(PROBLEMS[0], firstItem);
  }
})();
