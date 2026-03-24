import { BadRequestError, NotFoundError } from "../middleware/error.js";
import {
  checkVersionExists,
  extractDependencies,
  extractPackageJsonPathsFromTree,
  extractRepoInfoFromUrl,
  fetchNpmPackage,
  fetchRepoGitTree,
  fetchRepoInfo,
  isUrlAcceptable,
  promiseLimiter,
  readPackageJson,
} from "../utils/helper.js";
import constants from "../constants.js";
import {
  deleteExpiredCache,
  readFromCache,
  saveToCache,
} from "../lib/cache.js";

export async function githubAnalyzer(url) {
  if (!url || typeof url !== "string") {
    throw new BadRequestError("GitHub repository URL is required");
  }

  if (!isUrlAcceptable(url)) {
    throw new BadRequestError("Invalid GitHub repository URL");
  }

  const { owner, repo } = extractRepoInfoFromUrl(url);

  console.log("[action] fetching repo info...");
  const repoInfo = await fetchRepoInfo({ owner, repo });
  if (!repoInfo) {
    throw new NotFoundError("Repository not found");
  }

  const { default_branch } = repoInfo;
  let isTruncated = false;

  console.log("[action] fetching repo git tree...");
  const gitTree = await fetchRepoGitTree({
    owner,
    repo,
    branch: default_branch,
  });
  if (!gitTree) {
    throw new NotFoundError(
      `Unable to fetch git tree for branch: ${default_branch}`,
    );
  }

  const { truncated, tree } = gitTree;
  if (truncated) isTruncated = true;

  console.log("[action] extracting package.json file paths...");
  const packageJsonPaths = extractPackageJsonPathsFromTree(tree);
  console.log("[log] package paths: ", packageJsonPaths);
  if (!packageJsonPaths.length) {
    throw new NotFoundError("No package.json found in this repository");
  }

  if (packageJsonPaths.length > 5) {
    console.warn("[warning] extremely long git tree detected.");
    console.log("[action] trimming to only 5 package.json files...");

    packageJsonPaths.splice(5, Number(packageJsonPaths.length - 5));
  }

  console.log("[action] reading all package.json...");
  const packageList = await Promise.all(
    packageJsonPaths.map(async (path) => {
      let packageJson = await readPackageJson({ owner, repo, path });

      if (!packageJson) {
        console.warn(`[warning] failed to read package.json at path: ${path}`);
        return { path, dependencies: [], devDependencies: [] };
      }

      let { dependencies, devDependencies } = extractDependencies(packageJson);

      return { path, dependencies, devDependencies };
    }),
  );

  console.log("[log] finished extracting dependencies \n. \n. \n. \n.");

  return {
    platform: "GitHub",
    owner,
    repo,
    packageList,
  };
}

export async function githubSummarizer(packageList = []) {
  let summary = {
    num_of_package_json: 0,
    package_json_paths: [],
    num_of_dependencies: {},
    num_of_dev_dependencies: {},
    total_num_of_dependencies: 0,
    total_num_of_dev_dependencies: 0,
  };

  if (typeof packageList != "object") return summary;

  summary.num_of_package_json = packageList.length;

  console.log("[action] summarizing package info...");
  packageList.forEach((pkg) => {
    let path = pkg.path;
    let dependencies = pkg.dependencies;
    let devDependencies = pkg.devDependencies;

    let numOfDeps = dependencies.length || 0;
    let numOfDevDeps = devDependencies.length || 0;

    summary.package_json_paths.push(path);

    summary.num_of_dependencies[path] = numOfDeps;
    summary.num_of_dev_dependencies[path] = numOfDevDeps;

    summary.total_num_of_dependencies += numOfDeps;
    summary.total_num_of_dev_dependencies += numOfDevDeps;
  });

  console.log("[log] done summarizing... ", "\n. \n. \n. \n.");

  return summary;
}

export async function filterPackageSource(packageList = []) {
  const filteredPackageList = packageList.map((pkg) => {
    const { path, dependencies, devDependencies } = pkg;

    console.log("[action] filtering dependencies source...");
    //--
    const newDependencies = dependencies.map((dep) => {
      const { name, version } = dep;

      let source = "";

      if (constants.NON_NPM_VERSION_REGEX.test(version)) {
        //-- package version does not resemble npm format

        if (/^file:/.test(version)) {
          source = "local";
        } else if (/^(git\+|github:)/.test(version)) {
          source = "git";
        } else if (/^https?:/.test(version)) {
          source = "url";
        } else if (/^workspace:/.test(version)) {
          source = "workspace";
        } else {
          source = "unknown";
        }
      } else {
        //--looks like npm package version. check package name type

        if (!constants.NPM_PACKAGE_NAME_REGEX.test(name)) {
          source = "unknown";
        } else {
          source = "npm";
        }
      }

      return { name, version, source };
    });

    console.log("[action] filtering dev dependencies source...");
    //--
    const newDevDependencies = devDependencies.map((dep) => {
      const { name, version } = dep;

      let source = "";

      if (constants.NON_NPM_VERSION_REGEX.test(version)) {
        //-- package version does not resemble npm format

        if (/^file:/.test(version)) {
          source = "local";
        } else if (/^(git\+|github:)/.test(version)) {
          source = "git";
        } else if (/^https?:/.test(version)) {
          source = "url";
        } else if (/^workspace:/.test(version)) {
          source = "workspace";
        } else {
          source = "unknown";
        }
      } else {
        //--looks like npm package version. check package name type

        if (!constants.NPM_PACKAGE_NAME_REGEX.test(name)) {
          source = "unknown";
        } else {
          source = "npm";
        }
      }

      return { name, version, source };
    });

    return {
      path,
      dependencies: newDependencies,
      devDependencies: newDevDependencies,
    };
  });

  return filteredPackageList;
}

export async function npmRegistryValidator(packageList = []) {
  const CACHE_PATH = constants.CACHE_PATH_NPM;

  const CACHE = await readFromCache(CACHE_PATH);

  const promiseResult = await Promise.all(
    packageList.map(async (pkg) => {
      //--process each concurrently dependencies
      const processDeps = async (deps = []) => {
        return Promise.all(
          deps.map((dep) =>
            promiseLimiter(async () => {
              if (dep.source !== "npm") {
                return { ...dep, versionExists: false };
              }

              const { name, version } = dep;

              const { exists, versions } = await fetchNpmPackage(name, CACHE);

              const versionExists = exists
                ? checkVersionExists(versions, version)
                : false;

              return {
                ...dep,
                versionExists,
              };
            }),
          ),
        );
      };

      console.log("[action]: validating dependecies in npm registry...");
      const dependencies = await processDeps(pkg.dependencies);
      const devDependencies = await processDeps(pkg.devDependencies);

      console.log("[action] done validating packages", "\n.\n.\n.");

      return {
        ...pkg,
        dependencies,
        devDependencies,
      };
    }),
  );

  await deleteExpiredCache(CACHE_PATH);
  await saveToCache(CACHE_PATH, CACHE);

  return promiseResult;
}
