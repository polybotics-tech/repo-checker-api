import "dotenv/config";
import express from "express";
import cors from "cors";
import os from "os";
import cluster from "cluster";
import {
  ErrorMiddleware as ErrorMiddlewareV1,
  RouteErrorMiddleware as RouteErrorMiddlewareV1,
} from "./v1/middleware/error.js";
import { LimiterMiddleware as LimiterMiddlewareV1 } from "./v1/middleware/limiter.js";
import router from "./routes.js";

const server = express();

server.use(
  cors({
    origin: "*",
    allowedHeaders: ["Content-Type"],
    methods: ["GET", "POST", "OPTIONS"],
  }),
);

server.use(
  express.json({
    type: "application/json",
    limit: 10 * 1024 * 1024,
    strict: true, // only accept arrays and objects
  }),
);

// rate limiting middleware
server.use(LimiterMiddlewareV1);

server.use("/", router);

// route not found middleware
server.use(RouteErrorMiddlewareV1);

// general error handling middlewares
server.use(ErrorMiddlewareV1);
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV === "development" || process.env.NODEMON === "true";

// Use isPrimary (Node 16+) or isMaster (older versions)
const isPrimary = cluster.isPrimary || cluster.isMaster;

if (!isDev && isPrimary && os.cpus().length > 1) {
  const numCPUs = os.cpus().length;
  console.log(`Primary ${process.pid} is running. Forking ${numCPUs} workers...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  // Running as a worker or in dev mode (no clustering)
  const runningServer = server.listen(PORT, () => {
    console.log(
      `Server running on port ${PORT} ${
        cluster.isWorker ? `- Worker ${process.pid}` : ""
      }`,
    );
  });

  // Set timeout to 0 (no timeout) for long-running batch requests
  runningServer.timeout = 0;
  runningServer.keepAliveTimeout = 0;
}

export default server;
