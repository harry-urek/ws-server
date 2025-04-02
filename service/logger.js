const winston = require("winston");
const { createClient } = require("redis");
const config = require("../config");
const { format, transports } = winston;
const { combine, timestamp, printf, colorize, errors, json } = format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack }) => {
  const log = `${timestamp} [${level}]: ${stack || message}`;
  return level === "error" ? colorize().colorize(level, log) : log;
});

// Redis transport (for production)
const createRedisTransport = () => {
  const redisClient = createClient({ url: config.redisUrl });

  redisClient.on("error", (err) => {
    console.error("Redis Logger Error:", err); // Fallback to console
  });

  return new transports.Stream({
    stream: redisClient.connect().then(() => {
      return {
        write: (log) => {
          redisClient.publish("logs", log);
        },
      };
    }),
    format: json(),
  });
};

// Base transports
const baseTransports = [
  new transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      errors({ stack: true }),
      consoleFormat,
    ),
    level: config.env === "development" ? "debug" : "info",
  }),
  new transports.File({
    filename: "logs/combined.log",
    level: "info",
    format: combine(timestamp(), errors({ stack: true }), json()),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  new transports.File({
    filename: "logs/errors.log",
    level: "error",
    format: combine(timestamp(), errors({ stack: true }), json()),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Production-specific transports
const productionTransports = [...baseTransports, createRedisTransport()];

// Create logger instance
const logger = winston.createLogger({
  level: config.env === "development" ? "debug" : "info",
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports:
    config.env === "production" ? productionTransports : baseTransports,
  exitOnError: false,
});

// Add exception handling
process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled Rejection: ${reason.stack || reason}`);
});

process.on("uncaughtException", (error) => {
  logger.error(`Uncaught Exception: ${error.stack || error}`);
  process.exit(1);
});

// Custom stream for morgan (HTTP logging)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

// Request logging middleware
logger.logRequest = (req, res, next) => {
  const { method, originalUrl, ip, body } = req;

  logger.http(`Request: ${method} ${originalUrl}`, {
    ip,
    body: method !== "GET" ? body : undefined,
    user: req.user?.id || "anonymous",
  });

  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.http(`Response: ${method} ${originalUrl} ${res.statusCode}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      user: req.user?.id || "anonymous",
    });
  });

  next();
};

// gRPC logging interceptor
logger.grpcLogger = (call, callback, next) => {
  const start = Date.now();
  const { method } = call;

  logger.debug(`gRPC call started: ${method}`, {
    metadata: call.metadata.getMap(),
    peer: call.getPeer(),
  });

  next(call, callback, (err, response) => {
    const duration = Date.now() - start;
    if (err) {
      logger.error(`gRPC call failed: ${method}`, {
        error: err.message,
        duration: `${duration}ms`,
        stack: err.stack,
      });
    } else {
      logger.debug(`gRPC call completed: ${method}`, {
        duration: `${duration}ms`,
        response: JSON.stringify(response),
      });
    }
  });
};

module.exports = logger;
