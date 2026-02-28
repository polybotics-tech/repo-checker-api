import {
  githubAnalyzer,
  githubPackageSummarizer,
} from "../services/analyzer.js";
import { SuccessResponse } from "../utils/response.js";
import { fnTryCatch } from "../utils/trycatch.js";

export const analyzeRepository = fnTryCatch(
  async (req, res) => {
    const { url, listPackages } = req.body;

    const {
      platform,
      owner,
      repo: repoName,
      packageList,
    } = await githubAnalyzer(url);

    const githubSummary = await githubPackageSummarizer(packageList);

    // TODO: verify is packages exist on NPM registry

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
        packages: listPackages ? packageList : null,
      },
    });
  },
  {
    logError: true,
  },
);
