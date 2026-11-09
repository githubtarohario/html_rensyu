const { normalizeNickname } = require("./_lib/nickname");
const { createRedisClient } = require("./_lib/redis");
const { getPasswordHash, setPasswordHash } = require("./_lib/store");
const { hashPassword, verifyPassword } = require("./_lib/password");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const body = req.body ?? {};
  const id = normalizeNickname(body.id);
  const password = body.password;

  if (id === null) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  if (typeof password !== "string" || password.length === 0 || password.length > 100) {
    res.status(400).json({ error: "invalid password" });
    return;
  }

  const client = createRedisClient();
  const existingHash = await getPasswordHash(client, id);

  if (existingHash === null) {
    await setPasswordHash(client, id, await hashPassword(password));
    res.status(200).json({ id });
    return;
  }

  if (await verifyPassword(password, existingHash)) {
    res.status(200).json({ id });
    return;
  }

  res.status(401).json({ error: "IDまたはパスワードが違います" });
};
