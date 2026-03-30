import axios from "axios";
import axiosRetry from "axios-retry";
import constants from "../constants.js";

export const instance = axios.create({
  timeout: 1000 * 10,
  headers: {
    "User-Agent": "repo-checker-api",
  },
});

instance.interceptors.request.use((config) => {
  const token = process.env.GITHUB_TOKEN;

  if (token && config.url.startsWith(constants.GITHUB_BASE_API_URL)) {
    config.headers.Authorization = `token ${token}`;
  }

  return config;
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
