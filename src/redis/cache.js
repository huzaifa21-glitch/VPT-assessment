const { redis } = require('./client');

// Small cache-aside helper reused wherever a route wants Redis caching
// instead of hand-rolling get/JSON.parse/set in each service.
const cache = {
  async get(key) {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  },

  async set(key, value, ttlSeconds) {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  },

  async del(key) {
    await redis.del(key);
  },
};

module.exports = { cache };
