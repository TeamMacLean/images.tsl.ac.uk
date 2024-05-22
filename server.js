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

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`Received request: ${req.method} ${req.url}`);
  next();
});
