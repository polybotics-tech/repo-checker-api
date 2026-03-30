import { BadRequestError, NotFoundError } from "../v1/middleware/error.js";
import {
  extractRepoInfoFromUrl,
  fetchRepoGitTree,
  fetchRepoInfo,
  isUrlAcceptable,
  fetchRubyGem,
  checkRubyVersionExists,
  promiseLimiter,
} from "../v1/utils/helper.js";
import {
  extractGemDependencies,
  extractGemfilePathsFromTree,
  readGemfile,
} from "./helper.js";
import constants from "../v1/constants.js";
import {
  deleteExpiredCache,
  readFromCache,
  saveToCache,
} from "../v1/lib/cache.js";

export async function rubyAnalyzer(url) {
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

  console.log("[action] extracting Gemfile paths...");
  const gemfilePaths = extractGemfilePathsFromTree(tree);
  console.log("[log] gemfile paths: ", gemfilePaths);
  if (!gemfilePaths.length) {
    throw new NotFoundError("No Gemfile found in this repository");
  }

  if (gemfilePaths.length > 5) {
    console.warn("[warning] extremely long git tree detected.");
    console.log("[action] trimming to only 5 Gemfile files...");

    gemfilePaths.splice(5, Number(gemfilePaths.length - 5));
  }

  console.log("[action] reading all Gemfile...");
  const packageList = await Promise.all(
    gemfilePaths.map(async (path) => {
      const gemfileContent = await readGemfile({ owner, repo, path });

      if (!gemfileContent) {
        console.warn(`[warning] failed to read Gemfile at path: ${path}`);
        return { path, dependencies: [], devDependencies: [] };
      }

      const { dependencies, devDependencies } =
        extractGemDependencies(gemfileContent);

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

export async function rubyPackageSummarizer(packageList = []) {
  const summary = {
    num_of_gemfiles: 0,
    gemfile_paths: [],
    num_of_dependencies: {},
    total_num_of_dependencies: 0,
  };

  if (typeof packageList != "object") return summary;

  summary.num_of_gemfiles = packageList.length;

  console.log("[action] summarizing gemfile info...");
  packageList.forEach((pkg) => {
    const path = pkg.path;
    const dependencies = pkg.dependencies;

    const numOfDeps = dependencies.length || 0;

    summary.gemfile_paths.push(path);

    summary.num_of_dependencies[path] = numOfDeps;

    summary.total_num_of_dependencies += numOfDeps;
  });

  console.log("[log] summary: ", JSON.stringify(summary), "\n. \n. \n. \n.");

  return summary;
}

export async function rubyFilterPackageSource(packageList = []) {
  const filteredPackageList = packageList.map((pkg) => {
    const { path, dependencies, devDependencies } = pkg;

    const filterDeps = (deps) => {
      return deps.map((dep) => {
        const { name, version } = dep;
        let source = "";

        if (constants.NON_RUBY_VERSION_REGEX.test(version)) {
          if (/^file:/.test(version) || /^path:/.test(version)) {
            source = "local";
          } else if (/^(git\+|github:)/.test(version)) {
            source = "git";
          } else if (/^https?:/.test(version)) {
            source = "url";
          } else {
            source = "unknown";
          }
        } else {
          if (!constants.RUBY_GEM_NAME_REGEX.test(name)) {
            source = "unknown";
          } else {
            source = "rubygems";
          }
        }

        return { name, version, source };
      });
    };

    return {
      path,
      dependencies: filterDeps(dependencies),
      devDependencies: filterDeps(devDependencies),
    };
  });

  return filteredPackageList;
}

export async function rubyRegistryValidator(packageList = []) {
  const CACHE_PATH = constants.CACHE_PATH_RUBY;
  const CACHE = await readFromCache(CACHE_PATH);

  const promiseResult = await Promise.all(
    packageList.map(async (pkg) => {
      const processDeps = async (deps = []) => {
        return Promise.all(
          deps.map((dep) =>
            promiseLimiter(async () => {
              if (dep.source !== "rubygems") {
                return { ...dep, versionExists: false };
              }

              const { name, version } = dep;
              const { exists, versions } = await fetchRubyGem(name, CACHE);

              const versionExists = exists
                ? checkRubyVersionExists(versions, version)
                : false;

              return { ...dep, versionExists };
            }),
          ),
        );
      };

      console.log("[action]: validating dependencies in rubygems registry...");
      const dependencies = await processDeps(pkg.dependencies);
      const devDependencies = await processDeps(pkg.devDependencies);

      return { ...pkg, dependencies, devDependencies };
    }),
  );

  deleteExpiredCache(CACHE);
  await saveToCache(CACHE_PATH, CACHE);

  return promiseResult;
}

export async function rubySummarizer(packageList = []) {
  let totalDependencies = 0;
  const sourceBreakdown = {
    rubygems: 0,
    local: 0,
    git: 0,
    url: 0,
    unknown: 0,
  };

  let validVersions = 0;
  let invalidVersions = 0;

  let usesLatestAsVersion = 0;
  let usesWildcardAsVersion = 0;
  let gitDependencies = 0;

  const highRiskDependencies = [];
  const possibleDependencyConfusion = [];

  const allDeps = packageList.flatMap((pkg) => [
    ...(pkg.dependencies || []),
    ...(pkg.devDependencies || []),
  ]);

  totalDependencies = allDeps.length;

  for (const dep of allDeps) {
    const { name, version, source, versionExists } = dep;

    if (sourceBreakdown[source] !== undefined) {
      sourceBreakdown[source]++;
    } else {
      sourceBreakdown.unknown++;
    }

    if (version === "latest") usesLatestAsVersion++;
    if (version === "*") usesWildcardAsVersion++;
    if (source === "git") gitDependencies++;

    switch (source) {
      case "rubygems":
        if (versionExists) {
          validVersions++;
        } else {
          invalidVersions++;
          possibleDependencyConfusion.push(name);
          highRiskDependencies.push({
            name,
            reason: "version_not_found_on_rubygems",
          });
        }
        break;
      case "local":
        highRiskDependencies.push({ name, reason: "local_dependency" });
        break;
      case "git":
        highRiskDependencies.push({ name, reason: "git_dependency" });
        break;
      case "url":
        highRiskDependencies.push({ name, reason: "url_dependency" });
        break;
      default:
        highRiskDependencies.push({ name, reason: "unknown_dependency" });
        break;
    }
  }

  const verifiedOnRubyGems = validVersions;
  const notFoundOnRubyGems = invalidVersions;

  const verificationRate =
    totalDependencies > 0
      ? Number(((verifiedOnRubyGems / totalDependencies) * 100).toFixed(3))
      : 0;

  let score = 100;
  score -= invalidVersions * 10;
  score -= sourceBreakdown.git * 15;
  score -= sourceBreakdown.local * 20;
  score -= sourceBreakdown.unknown * 25;

  score = Math.max(0, Math.min(100, score));

  let level = "low";
  if (score < 80) level = "medium";
  if (score < 50) level = "high";
  if (score < 20) level = "extreme";

  return {
    total_dependencies: totalDependencies,
    source_breakdown: sourceBreakdown,
    versions_overview: {
      valid_versions: validVersions,
      invalid_versions: invalidVersions,
    },
    registry_overview: {
      verified_on_rubygems: verifiedOnRubyGems,
      not_found_on_rubygems: notFoundOnRubyGems,
      verification_rate: verificationRate,
    },
    suspicious_patterns: {
      uses_latest_tag: usesLatestAsVersion,
      uses_wildcard: usesWildcardAsVersion,
      git_dependencies: gitDependencies,
    },
    high_risk_dependencies: highRiskDependencies,
    possible_dependency_confusions: possibleDependencyConfusion,
    risk_score: {
      score,
      level,
    },
  };
}
