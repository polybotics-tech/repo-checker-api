import { logbot } from "../../logger.js";
import { InternalServerError } from "../middleware/error.js";

export function fnTryCatch(
  fn,
  options = {
    fallback: undefined,
    logError: false,
    onError: null,
    throwError: true,
  },
) {
  const {
    onError = null,
    throwError = true,
    logError = false,
    fallback = undefined,
  } = options;

  return async function (...args) {
    try {
      return await fn(...args);
    } catch (error) {
      let message = error?.message;
      let statusCode = error?.statusCode;

      let meta = {
        message,
        statusCode,
        errType: error?.code,
        stack: error?.stack,
      };

      if (logError) {
        console.log(`[fnTryCatch Err]: ${message}`);
      }

      logbot.Error(`[fnTryCatch Err]: ${JSON.stringify(meta)}`);

      if (onError) {
        await onError(error, ...args);
      }

      if (throwError) {
        const defaultErrCodes = [400, 403, 404, 429];

        if (defaultErrCodes.includes(statusCode)) {
          throw error;
        } else {
          throw new InternalServerError();
        }
      }

      return fallback;
    }
  };
}
