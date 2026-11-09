// 管理画面用の簡易パスワード一致チェック。
// ADMIN_PASSWORD未設定（空・undefined）の場合は、設定ミスとして常に不一致とする。
function isCorrectPassword(provided, expected) {
  if (typeof expected !== "string" || expected.length === 0) {
    return false;
  }
  return typeof provided === "string" && provided === expected;
}

module.exports = { isCorrectPassword };
