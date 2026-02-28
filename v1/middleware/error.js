import { logbot } from "../../logger.js";
import { FailedResponse } from "../utils/response.js";

export function ErrorMiddleware(err, req, res, _) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  return FailedResponse(res, {
    statusCode,
    message,
  });
}

export function RouteErrorMiddleware(req, res, _) {
  return FailedResponse(res, {
    statusCode: 404,
    message: "Route not found",
    data: {
      method: req?.method,
      route: req?.originalUrl,
    },
  });
}

export class BadRequestError extends Error {
  statusCode = 400;

  constructor(message) {
    super(message || "Bad request");
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;

  constructor(message) {
    super(message || "Permission denied. Request forbidden");
  }
}

export class NotFoundError extends Error {
  statusCode = 404;

  constructor(message) {
    super(message || "Resource not found");
  }
}

export class ManyRequestsError extends Error {
  statusCode = 429;

  constructor() {
    super("Too many requests. Try again later");
  }
}

export class InternalServerError extends Error {
  statusCode = 500;

  constructor() {
    super("Internal server error");
  }
}
