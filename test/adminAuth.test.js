const test = require("node:test");
const assert = require("node:assert/strict");
const { isCorrectPassword } = require("../api/_lib/adminAuth");

test("一致していればtrue", () => {
  assert.equal(isCorrectPassword("1111", "1111"), true);
});

test("不一致ならfalse", () => {
  assert.equal(isCorrectPassword("2222", "1111"), false);
});

test("ADMIN_PASSWORDが未設定（undefined）なら常にfalse", () => {
  assert.equal(isCorrectPassword("1111", undefined), false);
});

test("ADMIN_PASSWORDが空文字なら常にfalse（空文字どうしの一致を許さない）", () => {
  assert.equal(isCorrectPassword("", ""), false);
});

test("providedが文字列以外ならfalse", () => {
  assert.equal(isCorrectPassword(undefined, "1111"), false);
  assert.equal(isCorrectPassword(1111, "1111"), false);
});
