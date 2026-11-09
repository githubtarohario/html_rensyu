const { normalizeNickname } = require("./_lib/nickname");
const { createRedisClient } = require("./_lib/redis");
const { getPasswordHash, setPasswordHashIfAbsent } = require("./_lib/store");
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
    // SET NXで原子的に登録する。同じIDへの新規登録が同時に来ても、
    // 先に書き込めた1件だけが成功し、もう一方はfalseを受け取る。
    const didRegister = await setPasswordHashIfAbsent(client, id, await hashPassword(password));
    if (didRegister) {
      res.status(200).json({ id });
      return;
    }

    // 競合に負けた（直前に別のリクエストが登録を完了させた）場合は、
    // 登録成功を名乗らず、通常のログインチェックにフォールバックする。
    const raceHash = await getPasswordHash(client, id);
    if (raceHash !== null && (await verifyPassword(password, raceHash))) {
      res.status(200).json({ id });
      return;
    }

    res.status(401).json({ error: "IDまたはパスワードが違います" });
    return;
  }

  if (await verifyPassword(password, existingHash)) {
    res.status(200).json({ id });
    return;
  }

  res.status(401).json({ error: "IDまたはパスワードが違います" });
};
