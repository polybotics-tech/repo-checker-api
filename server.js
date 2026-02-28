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

const canCluster = os.cpus().length > 1 && typeof cluster.fork === "function";

if (canCluster) {
  const numCPUs = os.cpus().length;

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  // running without clusterings
  server.listen(PORT, () => {
    console.log(
      `Server running on port ${PORT} ${
        cluster.isWorker ? `- Worker ${process.pid}` : ""
      }`,
    );
  });
}

export default server;
