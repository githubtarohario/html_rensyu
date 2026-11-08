const test = require("node:test");
const assert = require("node:assert/strict");
const { recordCorrectAnswer, userSolvedKey } = require("../api/_lib/store");

function createFakeClient() {
  const sets = new Map();
  const sorted = new Map();
  return {
    async sadd(key, member) {
      const s = sets.get(key) ?? new Set();
      const added = s.has(member) ? 0 : 1;
      s.add(member);
      sets.set(key, s);
      return added;
    },
    async scard(key) {
      return (sets.get(key) ?? new Set()).size;
    },
    async smembers(key) {
      return [...(sets.get(key) ?? new Set())];
    },
    async zaddScore(key, score, member) {
      const m = sorted.get(key) ?? new Map();
      m.set(member, score);
      sorted.set(key, m);
    },
    async zrangeDesc(key) {
      const m = sorted.get(key) ?? new Map();
      return [...m.entries()]
        .map(([member, score]) => ({ member, score }))
        .sort((a, b) => b.score - a.score);
    },
    async hsetUpdatedAt() {},
    _sets: sets,
  };
}

test("初めて正解した問題は加点され newlyCorrect: true を返す", async () => {
  const client = createFakeClient();
  const result = await recordCorrectAnswer(client, "Taro", "h1-basic");
  assert.deepEqual(result, { score: 1, newlyCorrect: true });
});

test("同じ問題に2回正解しても得点は増えない（冪等性）", async () => {
  const client = createFakeClient();
  await recordCorrectAnswer(client, "Taro", "h1-basic");
  const second = await recordCorrectAnswer(client, "Taro", "h1-basic");
  assert.deepEqual(second, { score: 1, newlyCorrect: false });
});

test("異なる問題に正解すると得点が積み上がる", async () => {
  const client = createFakeClient();
  await recordCorrectAnswer(client, "Taro", "h1-basic");
  const result = await recordCorrectAnswer(client, "Taro", "p-basic");
  assert.deepEqual(result, { score: 2, newlyCorrect: true });
});

test("同じニックネームへの別問題の正解が互いの記録を消さない", async () => {
  const client = createFakeClient();
  await recordCorrectAnswer(client, "Taro", "h1-basic");
  await recordCorrectAnswer(client, "Taro", "p-basic");
  const solved = client._sets.get(userSolvedKey("Taro"));
  assert.deepEqual([...solved].sort(), ["h1-basic", "p-basic"]);
});
