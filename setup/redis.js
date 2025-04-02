const redis = require("redis");
const config = require("../setup/config");
const logger = require("../service/logger");

const { createClient } = redis;

const sessionClient = createClient({ url: config.redis.url });
const pubClient = createClient({ url: config.redis.url });
const subClient = createClient({ url: config.redis.url });

//ERROR HANDLING
const handleError = (err) => {
  logger.error(`Redis Error:  ${err.message}`);
  console.error(`Redis Error:  ${err.message}`);
};

// Initialize Redis clients

const initRedisClients = async () => {
  try {
    await sessionClient.connect();
    await pubClient.connect();
    await subClient.connect();
    logger.info("Redis clients connected successfully");
  } catch (error) {
    handleError(error);
    process.exit(1); // Exit the process if Redis connection fails
  }
};

// Event listeners for Redis clients
sessionClient.on("error", handleError);

pubClient.on("error", handleError);
subClient.on("error", handleError);

const redisService = {
  async set(key, value, options = {}) {
    try {
      const { expire } = options;
      await sessionClient.set(key, value);
      if (expire) {
        await sessionClient.expire(key, expire);
      }
    } catch (error) {
      handleError(error);
    }
  },
  async get(key) {
    try {
      const value = await sessionClient.get(key);
      return value;
    } catch (error) {
      handleError(error);
    }
  },
  async del(key) {
    try {
      await sessionClient.del(key);
    } catch (error) {
      handleError(error);
    }
  },
  async publish(channel, message) {
    try {
      return await pubClient.publish(channel, message);
    } catch (error) {
      handleError(error);
    }
  },
  async subscribe(channel, callback) {
    try {
      await subClient.subscribe(channel, (message) => {
        callback(message);
      });
    } catch (error) {
      handleError(error);
    }
  },
  async unsubscribe(channel) {
    try {
      return await subClient.unsubscribe(channel);
    } catch (error) {
      handleError(error);
    }
  },
  async quit() {
    await sessionClient.quit();
    await pubClient.quit();
    await subClient.quit();
  },
};

module.exports = {
  initRedisClients,
  redisService,
  pubClient,
  sessionClient,
  subClient,
};
