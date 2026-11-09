const LEADERBOARD_KEY = "leaderboard";

function userSolvedKey(nickname) {
  return `user:${nickname}:solved`;
}

function userMetaKey(nickname) {
  return `user:${nickname}:meta`;
}

function userPasswordKey(id) {
  return `user:${id}:passwordHash`;
}

// 問題に正解したことを記録する。同じ問題への再正解は得点を増やさない（冪等）。
async function recordCorrectAnswer(client, nickname, problemId) {
  const added = await client.sadd(userSolvedKey(nickname), problemId);
  const newlyCorrect = added === 1;
  const score = await client.scard(userSolvedKey(nickname));
  await client.zaddScore(LEADERBOARD_KEY, score, nickname);
  await client.hsetUpdatedAt(userMetaKey(nickname), Date.now());
  return { score, newlyCorrect };
}

// 指定ニックネームの得点と正解済み問題一覧を取得する。
async function getUserInfo(client, nickname) {
  const solvedProblems = await client.smembers(userSolvedKey(nickname));
  return { nickname, score: solvedProblems.length, solvedProblems };
}

// ランキングをスコア降順、同点はニックネーム昇順（アルファベット順）で返す。
// Redis側の順序に依存せず、JS側で明示的にソートする。
async function getLeaderboard(client) {
  const entries = await client.zrangeDesc(LEADERBOARD_KEY);
  return entries
    .map(({ member, score }) => ({ nickname: member, score }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.nickname < b.nickname ? -1 : a.nickname > b.nickname ? 1 : 0;
    });
}

// 指定IDに保存されているパスワードハッシュを取得する。未登録なら null を返す。
async function getPasswordHash(client, id) {
  return client.get(userPasswordKey(id));
}

// 指定IDのパスワードハッシュを保存する。
async function setPasswordHash(client, id, hash) {
  await client.set(userPasswordKey(id), hash);
}

module.exports = {
  LEADERBOARD_KEY,
  userSolvedKey,
  userMetaKey,
  userPasswordKey,
  recordCorrectAnswer,
  getUserInfo,
  getLeaderboard,
  getPasswordHash,
  setPasswordHash,
};
