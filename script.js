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
  const passwordInput = document.getElementById("password-input");
  const loginError = document.getElementById("login-error");
  const currentUser = document.getElementById("current-user");
  const currentUserName = document.getElementById("current-user-name");
  const currentScore = document.getElementById("current-score");
  const logoutBtn = document.getElementById("logout-btn");
  const leaderboardList = document.getElementById("leaderboard-list");

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

  // --- サーバー連携（fetchラッパー） ---
  // いずれも通信エラー時はnullを返す。UIはnullの場合そのまま何もしない
  // （オフライン時でも練習自体は続けられるようにする）。

  async function postScore(nickname, problemId) {
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname, problemId: problemId }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function fetchMe(nickname) {
    try {
      const res = await fetch("/api/me?nickname=" + encodeURIComponent(nickname));
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function fetchLeaderboard() {
    try {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  // --- 正解マーカー（サイドバー） ---

  function findSidebarItem(problemId) {
    // problemIdはサーバー（/api/me）から返る値であり、既知のID一覧と照合されていない
    // （api/score.jsは任意の文字列を受け入れる設計）。セレクタ文字列として組み立てると
    // "などを含む値でSyntaxErrorになるため、dataset比較で探す。
    return Array.prototype.find.call(sidebar.querySelectorAll(".problem-item"), function (el) {
      return el.dataset.problemId === problemId;
    });
  }

  function markSolved(problemId) {
    const el = findSidebarItem(problemId);
    if (el) el.classList.add("solved");
  }

  function markSolvedList(problemIds) {
    if (!Array.isArray(problemIds)) return;
    problemIds.forEach(markSolved);
  }

  function clearAllSolved() {
    sidebar.querySelectorAll(".problem-item.solved").forEach((el) => {
      el.classList.remove("solved");
    });
  }

  // --- ランキング表示 ---

  function renderLeaderboard(entries) {
    leaderboardList.innerHTML = "";
    entries.forEach((entry) => {
      const li = document.createElement("li");
      li.className = "leaderboard-item";

      const nameEl = document.createElement("span");
      nameEl.className = "leaderboard-name";
      nameEl.appendChild(document.createTextNode(entry.nickname));

      const scoreEl = document.createElement("span");
      scoreEl.className = "leaderboard-score";
      scoreEl.appendChild(document.createTextNode(String(entry.score)));

      li.appendChild(nameEl);
      li.appendChild(scoreEl);
      leaderboardList.appendChild(li);
    });
  }

  async function refreshLeaderboard() {
    const board = await fetchLeaderboard();
    if (!board) return;
    renderLeaderboard(board);
  }

  // ログイン中のニックネームの得点・正解済み問題をサーバーから復元する
  async function syncUserState(nickname) {
    const info = await fetchMe(nickname);
    if (!info) return;
    currentScore.textContent = String(info.score);
    clearAllSolved();
    markSolvedList(info.solvedProblems);
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
    currentScore.textContent = "0";
    syncUserState(nickname);
  }

  function showLoggedOutView() {
    currentUser.classList.add("hidden");
    loginForm.classList.remove("hidden");
    currentUserName.textContent = "";
    currentScore.textContent = "0";
    nicknameInput.value = "";
    passwordInput.value = "";
    hideLoginError();
    clearAllSolved();
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

  async function runPreview() {
    preview.srcdoc = codeInput.value;
    if (!currentProblem) return;

    saveCode(currentProblem, codeInput.value);

    const nickname = getSavedNickname();
    if (
      nickname &&
      typeof checkAnswer === "function" &&
      checkAnswer(currentProblem.id, codeInput.value) === true
    ) {
      const result = await postScore(nickname, currentProblem.id);
      if (result) {
        currentScore.textContent = String(result.score);
        markSolved(currentProblem.id);
        refreshLeaderboard();
      }
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
      itemEl.dataset.problemId = problem.id;
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

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const normalized = normalizeNickname(nicknameInput.value);
    if (normalized === null) {
      showLoginError("IDは1〜20文字で入力してください。");
      return;
    }
    if (passwordInput.value === "") {
      showLoginError("パスワードを入力してください。");
      return;
    }

    let res;
    try {
      res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: normalized, password: passwordInput.value }),
      });
    } catch (err) {
      showLoginError("通信エラーが発生しました");
      return;
    }

    if (!res.ok) {
      let message = "ログインに失敗しました";
      try {
        const data = await res.json();
        if (data && data.error) message = data.error;
      } catch (err) {
        // レスポンスがJSONでない場合はデフォルトのメッセージを使う
      }
      showLoginError(message);
      return;
    }

    hideLoginError();
    saveNickname(normalized);
    showLoggedInView(normalized);
    passwordInput.value = "";
  });

  logoutBtn.addEventListener("click", () => {
    clearNickname();
    showLoggedOutView();
  });

  buildSidebar();

  const savedNickname = getSavedNickname();
  if (savedNickname) {
    showLoggedInView(savedNickname);
  } else {
    showLoggedOutView();
  }

  if (PROBLEMS.length > 0) {
    const firstItem = sidebar.querySelector(".problem-item");
    selectProblem(PROBLEMS[0], firstItem);
  }

  refreshLeaderboard();
})();
