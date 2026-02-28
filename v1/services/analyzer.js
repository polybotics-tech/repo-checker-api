import { BadRequestError, NotFoundError } from "../middleware/error.js";
import {
  extractDependencies,
  extractPackageJsonPathsFromTree,
  extractRepoInfoFromUrl,
  fetchRepoGitTree,
  fetchRepoInfo,
  isUrlAcceptable,
  readPackageJson,
} from "../utils/helper.js";

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

export async function githubPackageSummarizer(packageList = []) {
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

  console.log("[log] summary: ", JSON.stringify(summary), "\n. \n. \n. \n.");

  return summary;
}
