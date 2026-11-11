const test = require("node:test");
const assert = require("node:assert/strict");
const { isCorrectAdminCredentials } = require("../api/_lib/adminAuth");

test("ID・パスワードが両方一致すればtrue", () => {
  assert.equal(isCorrectAdminCredentials("1111", "2222"), true);
});

test("IDが違えばfalse", () => {
  assert.equal(isCorrectAdminCredentials("9999", "2222"), false);
});

test("パスワードが違えばfalse", () => {
  assert.equal(isCorrectAdminCredentials("1111", "9999"), false);
});

test("ID・パスワードどちらも違えばfalse", () => {
  assert.equal(isCorrectAdminCredentials("9999", "9999"), false);
});

test("未入力（undefined）ならfalse", () => {
  assert.equal(isCorrectAdminCredentials(undefined, undefined), false);
});
