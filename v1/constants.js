export default {
  RATE_LIMIT_WINDOW_MS: 1000 * 60,
  RATE_LIMIT_MAX_REQUESTS: 60,

  CACHE_TTL: 1000 * 60 * 60,
  CACHE_PATH_NPM: "./cache/npm-cache.json",

  GITHUB_URL_REGEX: /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)(\/)?$/,
  GITHUB_BASE_API_URL: "https://api.github.com",

  NPM_PACKAGE_NAME_REGEX:
    /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/,
  NON_NPM_VERSION_REGEX: /^(file:|git\+|github:|https?:\/\/|workspace:)/,
  NPM_REGISTRY_URL: "https://registry.npmjs.org",
};
