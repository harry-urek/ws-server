const http = require("http");
const app = require("./app");
const logger = require("./service/logger");
const config = require("./config");

const server = http.createServer(app);
// Initialize services

// Start the server

server.listen(config.port, () => {
  logger.info(`Server running on port http://localhost:${config.port}`);

  // Graceful shutdown
  process.on("SIGTERM", () => {
    logger.info("SIGTERM received. Shutting down gracefully...");
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });
});
