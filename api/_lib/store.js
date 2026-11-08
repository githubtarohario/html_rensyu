const LEADERBOARD_KEY = "leaderboard";

function userSolvedKey(nickname) {
  return `user:${nickname}:solved`;
}

function userMetaKey(nickname) {
  return `user:${nickname}:meta`;
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

module.exports = {
  LEADERBOARD_KEY,
  userSolvedKey,
  userMetaKey,
  recordCorrectAnswer,
};
