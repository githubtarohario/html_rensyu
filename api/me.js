const { normalizeNickname } = require("./_lib/nickname");
const { createRedisClient } = require("./_lib/redis");
const { getUserInfo } = require("./_lib/store");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const nickname = normalizeNickname(req.query.nickname);

  if (nickname === null) {
    res.status(400).json({ error: "invalid nickname" });
    return;
  }

  const client = createRedisClient();
  const info = await getUserInfo(client, nickname);

  res.status(200).json(info);
};
