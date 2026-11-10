const { createRedisClient } = require("./_lib/redis");
const { getLeaderboard } = require("./_lib/store");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const client = createRedisClient();
  const board = await getLeaderboard(client);

  res.status(200).json(board);
};
