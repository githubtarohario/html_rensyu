const { Redis } = require("@upstash/redis");

// RedisLike のメソッドを @upstash/redis の現行APIにマッピングする。
function createRedisClient() {
  const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  return {
    async sadd(key, member) {
      return redis.sadd(key, member);
    },
    async scard(key) {
      return redis.scard(key);
    },
    async smembers(key) {
      return redis.smembers(key);
    },
    async zaddScore(key, score, member) {
      await redis.zadd(key, { score, member });
    },
    async zrangeDesc(key) {
      // withScores: true は [member, score, member, score, ...] の
      // フラット配列を返すので {member, score} のペアに整形する。
      const flat = await redis.zrange(key, 0, -1, { withScores: true, rev: true });
      const result = [];
      for (let i = 0; i < flat.length; i += 2) {
        result.push({ member: flat[i], score: flat[i + 1] });
      }
      return result;
    },
    async hsetUpdatedAt(key, timestampMs) {
      await redis.hset(key, { updatedAt: timestampMs });
    },
    async get(key) {
      return redis.get(key);
    },
    async set(key, value) {
      await redis.set(key, value);
    },
  };
}

module.exports = { createRedisClient };
