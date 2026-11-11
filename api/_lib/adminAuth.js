// 管理画面用の固定ID・パスワード認証。
const ADMIN_ID = "1111";
const ADMIN_PASSWORD = "2222";

function isCorrectAdminCredentials(id, password) {
  return id === ADMIN_ID && password === ADMIN_PASSWORD;
}

module.exports = { isCorrectAdminCredentials };
