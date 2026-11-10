const test = require("node:test");
const assert = require("node:assert/strict");
const { hashPassword, verifyPassword } = require("../api/_lib/password");

test("正しいパスワードで検証が成功する", async () => {
  const hash = await hashPassword("abc123");
  assert.equal(await verifyPassword("abc123", hash), true);
});

test("間違ったパスワードで検証が失敗する", async () => {
  const hash = await hashPassword("abc123");
  assert.equal(await verifyPassword("xyz999", hash), false);
});

test("同じパスワードでも毎回異なるハッシュになる（ソルトが異なる）", async () => {
  const hash1 = await hashPassword("abc123");
  const hash2 = await hashPassword("abc123");
  assert.notEqual(hash1, hash2);
});

test("stored が null/undefined/不正な形式なら例外を投げずfalseを返す", async () => {
  assert.equal(await verifyPassword("abc123", null), false);
  assert.equal(await verifyPassword("abc123", undefined), false);
  assert.equal(await verifyPassword("abc123", "not-a-valid-format"), false);
  assert.equal(await verifyPassword("abc123", "scrypt$onlyonepart"), false);
});
