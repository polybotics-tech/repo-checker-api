import axios from "axios";
import axiosRetry from "axios-retry";

export const instance = axios.create({
  timeout: 1000 * 10,
  headers: {
    "User-Agent": "repo-checker-api",
  },
});

axiosRetry(instance, {
  retries: 3,
  retryDelay: (retryCount) => {
    return retryCount * 1000;
  },
  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.response?.status >= 500
    );
  },
});
