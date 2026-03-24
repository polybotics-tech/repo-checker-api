import pLimit from "p-limit";
import semver from "semver";
import constants from "../constants.js";
import { instance } from "../lib/axios.js";
import { urlGenerator } from "./generator.js";
import { ForbiddenError } from "../middleware/error.js";
import { isCacheValid } from "../lib/cache.js";

export const promiseLimiter = pLimit(10);

export function isUrlAcceptable(url) {
  const match = url.match(constants.GITHUB_URL_REGEX);
  if (!match) return false;

  return true;
}

export function extractRepoInfoFromUrl(url) {
  const match = url.match(constants.GITHUB_URL_REGEX);

  return {
    owner: match[1],
    repo: match[2].replace(/.git$/, ""),
  };
}

export async function fetchRepoInfo(options = { owner, repo }) {
  const { owner, repo } = options;

  if (!owner || !repo) return null;

  try {
    const res = await instance.get(urlGenerator.githubRepo(owner, repo));

    if (res.status !== 200) {
      return null;
    }

    return res.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    } else if (error.response?.status === 403) {
      throw new ForbiddenError(
        "GitHub daily limit exceeded or access forbidden",
      );
    } else {
      throw error;
    }
  }
}

export async function fetchRepoGitTree(options = { owner, repo, branch }) {
  const { owner, repo, branch } = options;

  try {
    const res = await instance.get(
      urlGenerator.githubRepoTrees(owner, repo, branch),
    );

    return res.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    } else {
      throw error;
    }
  }
}

export function extractPackageJsonPathsFromTree(tree) {
  const paths = tree
    .filter((file) => file.path.endsWith("package.json"))
    .map((file) => file.path);

  return paths;
}

export async function readPackageJson(options = { owner, repo, path }) {
  const { owner, repo, path } = options;

  try {
    const res = await instance.get(
      urlGenerator.githubRepoContents(owner, repo, path),
    );

    // found out github returns file content as base64 encoded, so we need to decode it
    const base64 = res.data.content;
    const decoded = Buffer.from(base64, "base64").toString("utf-8");

    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}

const depObjToArr = (depObj) => {
  return Object.entries(depObj).map(([name, version]) => ({
    name,
    version,
  }));
};

export function extractDependencies(packageJson) {
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};

  return {
    dependencies: depObjToArr(dependencies),
    devDependencies: depObjToArr(devDependencies),
  };
}

export function checkVersionExists(versions = [], versionRange) {
  if (!versions) return false;

  //--exact version
  if (versions.includes(versionRange)) return true;

  //--version range (^1.0.0, ~1.2.0, etc.)
  const matched = semver.maxSatisfying(versions, versionRange);

  return !!matched;
}

export async function fetchNpmPackage(name, CACHE) {
  try {
    const cachedPackage = CACHE[name];

    //--use cache if valid
    if (cachedPackage && isCacheValid(cachedPackage)) {
      return cachedPackage;
    } else {
      //--otherwise fetch from npm registry
      const res = await instance.get(urlGenerator.npmPackageRegistry(name));

      const newEntry = {
        exists: true,
        versions: Object.keys(res.data.versions) || [],
        cachedAt: Date.now(),
      };

      CACHE[name] = newEntry;

      return newEntry;
    }
  } catch (err) {
    //--timeout / other error
    return { exists: false, versions: [] };
  }
}
