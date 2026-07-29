const app = require("./app");
const debug = require("debug")("imagehog:server");
const http = require("http");
const config = require("./config");

let port = normalizePort(config.port);
console.log(`Normalized port: ${port}`);
app.set("port", port);

const server = http.createServer(app);
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
server.on("error", onError);
server.on("listening", onListening);

function normalizePort(val) {
  const port = parseInt(val, 10);
  console.log(`Normalizing port: ${val}`);

  if (isNaN(port)) {
    console.log(`Port is not a number: ${val}`);
    return val;
  }

  if (port >= 0) {
    console.log(`Port is valid: ${port}`);
    return port;
  }

  console.log(`Port is invalid: ${val}`);
  return false;
}

function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  const addr = server.address();
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  console.log("Listening on " + bind);
  debug("Listening on " + bind);
}

// A rejection that nothing handles terminates the process by default, so a
// single bad request could take the whole site down. Log it and keep serving:
// one broken request must not become an outage.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

// An uncaught exception leaves the process in an undefined state, so this only
// buys time to finish in-flight requests before exiting for the supervisor to
// restart us.
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  shutdown("uncaughtException", 1);
});

let shuttingDown = false;

function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down`);

  const timer = setTimeout(() => {
    console.error("Shutdown timed out, forcing exit");
    process.exit(exitCode || 1);
  }, 10000);
  // Don't let the timer itself hold the event loop open.
  timer.unref();

  server.close((err) => {
    if (err) {
      console.error("Error while closing server:", err);
      process.exit(1);
    }
    console.log("Closed out remaining connections");
    process.exit(exitCode);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
