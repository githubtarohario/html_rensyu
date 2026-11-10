(function () {
  const form = document.getElementById("admin-login-form");
  const passwordInput = document.getElementById("admin-password-input");
  const errorEl = document.getElementById("admin-error");
  const panel = document.getElementById("admin-leaderboard-panel");
  const list = document.getElementById("admin-leaderboard-list");

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }

  function hideError() {
    errorEl.classList.add("hidden");
  }

  function renderLeaderboard(board) {
    list.innerHTML = "";
    board.forEach((entry) => {
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
      list.appendChild(li);
    });
    panel.classList.remove("hidden");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError();

    const password = passwordInput.value;

    let res;
    try {
      res = await fetch("/api/admin-leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
    } catch (err) {
      showError("通信エラーが発生しました");
      return;
    }

    if (res.status === 401) {
      showError("パスワードが違います");
      panel.classList.add("hidden");
      return;
    }

    if (!res.ok) {
      showError("エラーが発生しました");
      panel.classList.add("hidden");
      return;
    }

    const board = await res.json();
    renderLeaderboard(board);
  });
})();
