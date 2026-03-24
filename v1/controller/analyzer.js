import {
  filterPackageSource,
  githubAnalyzer,
  githubSummarizer,
  npmRegistryValidator,
} from "../services/analyzer.js";
import { SuccessResponse } from "../utils/response.js";
import { fnTryCatch } from "../utils/trycatch.js";

export const analyzeJsRepository = fnTryCatch(
  async (req, res) => {
    const { url, listPackages } = req.body;

    //--get (github) repo info and package.json contents
    const {
      platform,
      owner,
      repo: repoName,
      packageList,
    } = await githubAnalyzer(url);

    //--draft quick overview of repo
    const githubSummary = await githubSummarizer(packageList);

    //--identify dependency sources and tag them
    const sourcedPackages = await filterPackageSource(packageList);

    //--verify if "npm" tagged packages (and version) exist in registry
    const verifiedPackages = await npmRegistryValidator(sourcedPackages);

    // TODO: generate NPM feedback summary

    SuccessResponse(res, {
      message: "Repository analyzed successfully",
      data: {
        repository: {
          platform,
          owner,
          name: repoName,
          url,
        },
        summary: {
          github: githubSummary,
        },
        packages: listPackages ? verifiedPackages : null,
      },
    });
  },
  {
    logError: true,
  },
);
