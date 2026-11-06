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

  let currentProblem = null;

  function storageKey(problem) {
    return "html-rensyu:" + problem.id;
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

  buildSidebar();

  if (PROBLEMS.length > 0) {
    const firstItem = sidebar.querySelector(".problem-item");
    selectProblem(PROBLEMS[0], firstItem);
  }
})();
