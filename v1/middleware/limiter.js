import rateLimit from "express-rate-limit";
import constants from "../constants.js";
import { ManyRequestsError } from "./error.js";

const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } = constants;
export const LimiterMiddleware = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: () => {
    throw new ManyRequestsError();
  },
});
