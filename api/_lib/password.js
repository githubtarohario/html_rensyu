const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scryptAsync = promisify(crypto.scrypt);

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const FORMAT_PREFIX = "scrypt";

// 保存形式は "scrypt$<saltHex>$<hashHex>"。
// ソルトはハッシュごとに乱数で生成するため、同じパスワードでも毎回異なる文字列になる。
async function hashPassword(plain) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = await scryptAsync(plain, salt, KEY_BYTES);
  return `${FORMAT_PREFIX}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

// stored の形式が想定外の場合（null/undefined、区切りの数が違う、16進でない等）は
// 例外を投げずに false を返す。
async function verifyPassword(plain, stored) {
  try {
    if (typeof stored !== "string") return false;
    const parts = stored.split("$");
    if (parts.length !== 3 || parts[0] !== FORMAT_PREFIX) return false;

    const [, saltHex, hashHex] = parts;
    // Buffer.from は不正な16進文字を黙って読み飛ばすため、事前に形式を厳密に確認する
    if (!isHex(saltHex) || !isHex(hashHex)) return false;

    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    if (salt.length !== SALT_BYTES || expected.length !== KEY_BYTES) return false;

    const actual = await scryptAsync(plain, salt, KEY_BYTES);
    // timingSafeEqual は両辺の長さが一致している必要がある（上で KEY_BYTES を保証済み）
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function isHex(value) {
  return typeof value === "string" && /^[0-9a-f]+$/i.test(value) && value.length % 2 === 0;
}

module.exports = { hashPassword, verifyPassword };
