const { normalizeNickname } = require("./_lib/nickname");
const { createRedisClient } = require("./_lib/redis");
const { recordCorrectAnswer } = require("./_lib/store");

const PROBLEM_ID_MAX_LENGTH = 100;

// problemId は既知のID一覧と照合せず、空文字でなく100文字以内の文字列であることだけ確認する。
function isValidProblemId(problemId) {
  return (
    typeof problemId === "string" &&
    problemId.length > 0 &&
    problemId.length <= PROBLEM_ID_MAX_LENGTH
  );
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const body = req.body ?? {};
  const nickname = normalizeNickname(body.nickname);
  const problemId = body.problemId;

  if (nickname === null) {
    res.status(400).json({ error: "invalid nickname" });
    return;
  }

  if (!isValidProblemId(problemId)) {
    res.status(400).json({ error: "invalid problemId" });
    return;
  }

  const client = createRedisClient();
  const result = await recordCorrectAnswer(client, nickname, problemId);

  res.status(200).json(result);
};
