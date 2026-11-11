const { createRedisClient } = require("./_lib/redis");
const { getLeaderboard } = require("./_lib/store");
const { isCorrectAdminCredentials } = require("./_lib/adminAuth");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const body = req.body ?? {};

  if (!isCorrectAdminCredentials(body.id, body.password)) {
    res.status(401).json({ error: "invalid credentials" });
    return;
  }

  const client = createRedisClient();
  const board = await getLeaderboard(client);

  res.status(200).json(board);
};
