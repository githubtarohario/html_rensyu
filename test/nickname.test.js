const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeNickname } = require("../api/_lib/nickname");

test("前後の空白を除去する", () => {
  assert.equal(normalizeNickname("  Taro  "), "Taro");
});

test("空文字・空白のみはnullを返す", () => {
  assert.equal(normalizeNickname(""), null);
  assert.equal(normalizeNickname("   "), null);
});

test("20文字ちょうどはそのまま通す", () => {
  const name20 = "a".repeat(20);
  assert.equal(normalizeNickname(name20), name20);
});

test("21文字以上はnullを返す", () => {
  assert.equal(normalizeNickname("a".repeat(21)), null);
});
