const Redis = require('ioredis');
const { env } = require('../config/env');

const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null, // required by BullMQ workers sharing this connection pattern
});

redis.on('error', (err) => {
  console.error('[redis] connection error', err.message);
});

module.exports = { redis };
