const test = require("node:test");
const assert = require("node:assert/strict");
const {
  recordCorrectAnswer,
  userSolvedKey,
  getUserInfo,
  getLeaderboard,
  getPasswordHash,
  setPasswordHash,
} = require("../api/_lib/store");

function createFakeClient() {
  const sets = new Map();
  const sorted = new Map();
  const strings = new Map();
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
    async get(key) {
      return strings.get(key) ?? null;
    },
    async set(key, value) {
      strings.set(key, value);
    },
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

test("得点のないユーザーは score:0, solvedProblems:[] を返す", async () => {
  const client = createFakeClient();
  const info = await getUserInfo(client, "Hanako");
  assert.deepEqual(info, { nickname: "Hanako", score: 0, solvedProblems: [] });
});

test("正解済みの問題がsolvedProblemsに含まれる", async () => {
  const client = createFakeClient();
  await recordCorrectAnswer(client, "Hanako", "h1-basic");
  await recordCorrectAnswer(client, "Hanako", "p-basic");
  const info = await getUserInfo(client, "Hanako");
  assert.equal(info.score, 2);
  assert.deepEqual([...info.solvedProblems].sort(), ["h1-basic", "p-basic"]);
});

test("誰も得点を持たない場合、ランキングは空配列", async () => {
  const client = createFakeClient();
  assert.deepEqual(await getLeaderboard(client), []);
});

test("スコア降順、同点はニックネーム昇順で並ぶ", async () => {
  const client = createFakeClient();
  await recordCorrectAnswer(client, "Bob", "h1-basic");
  await recordCorrectAnswer(client, "Alice", "h1-basic");
  await recordCorrectAnswer(client, "Alice", "p-basic");
  const board = await getLeaderboard(client);
  assert.deepEqual(board, [
    { nickname: "Alice", score: 2 },
    { nickname: "Bob", score: 1 },
  ]);
});

test("同点はニックネームのアルファベット順でタイブレークする", async () => {
  const client = createFakeClient();
  await recordCorrectAnswer(client, "Bob", "h1-basic");
  await recordCorrectAnswer(client, "Alice", "h1-basic");
  const board = await getLeaderboard(client);
  assert.deepEqual(board, [
    { nickname: "Alice", score: 1 },
    { nickname: "Bob", score: 1 },
  ]);
});

test("パスワードハッシュが未設定のユーザーはnullを返す", async () => {
  const client = createFakeClient();
  assert.equal(await getPasswordHash(client, "Taro"), null);
});

test("setPasswordHashで保存した値がgetPasswordHashで取得できる", async () => {
  const client = createFakeClient();
  await setPasswordHash(client, "Taro", "scrypt$abcd$1234");
  assert.equal(await getPasswordHash(client, "Taro"), "scrypt$abcd$1234");
});
