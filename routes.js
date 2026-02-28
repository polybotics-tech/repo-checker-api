import express from "express";
import { SuccessResponse } from "./v1/utils/response.js";
import routerV1 from "./v1/router.js";

const router = express.Router();

// Initialize primary router
router.get("/", (_, res) => {
  SuccessResponse(res, {
    message: "Welcome to the Repo Checker API Server",
  });
});

// Version 1 routes
router.use("/v1", routerV1);

export default router;
