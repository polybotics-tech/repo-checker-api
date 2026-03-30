import fs from "fs/promises";
import pLimit from "p-limit";
import {
  filterPackageSource,
  githubRepoAnalyzer,
  githubSummarizer,
  npmRegistryValidator,
  npmSummarizer,
} from "../services/analyzer.js";
import {
  rubyFilterPackageSource,
  rubyPackageSummarizer,
  rubyRegistryValidator,
  rubySummarizer,
} from "../../ruby-config/analyzer.js";
import { SuccessResponse } from "../utils/response.js";
import { fnTryCatch } from "../utils/trycatch.js";
import { BadRequestError } from "../middleware/error.js";

const repoLimiter = pLimit(3); // process up to 3 repos concurrently

const performAnalysis = async (url, listPackages) => {
  //--get (github) repo info and all manifest files
  const {
    platform,
    owner,
    repo: repoName,
    npmPackageList,
    rubyPackageList,
  } = await githubRepoAnalyzer(url);

  let npmSummary = null;
  let verifiedNpmPackages = null;
  let githubNpmSummary = null;

  if (npmPackageList && npmPackageList.length > 0) {
    //--draft quick overview of repo (NPM)
    githubNpmSummary = await githubSummarizer(npmPackageList);
    //--identify dependency sources and tag them
    const sourcedPackages = await filterPackageSource(npmPackageList);
    //--verify if "npm" tagged packages (and version) exist in registry
    verifiedNpmPackages = await npmRegistryValidator(sourcedPackages);
    //--generate NPM security feedback summary
    npmSummary = await npmSummarizer(verifiedNpmPackages);
  }

  let rubySummary = null;
  let verifiedRubyPackages = null;
  let githubRubySummary = null;

  if (rubyPackageList && rubyPackageList.length > 0) {
    //--draft quick overview of repo (Ruby)
    githubRubySummary = await rubyPackageSummarizer(rubyPackageList);
    //--identify dependency sources and tag them
    const sourcedRubyPackages = await rubyFilterPackageSource(rubyPackageList);
    //--verify if "rubygems" tagged packages (and version) exist in registry
    verifiedRubyPackages = await rubyRegistryValidator(sourcedRubyPackages);
    //--generate RubyGems security feedback summary
    rubySummary = await rubySummarizer(verifiedRubyPackages);
  }

  return {
    repository: {
      platform,
      owner,
      name: repoName,
      url,
    },
    summary: {
      github: {
        npm: githubNpmSummary,
        ruby: githubRubySummary,
      },
      npm: npmSummary,
      rubygems: rubySummary,
    },
    packages: listPackages
      ? {
          npm: verifiedNpmPackages,
          ruby: verifiedRubyPackages,
        }
      : null,
  };
};

export const analyzeRepository = fnTryCatch(
  async (req, res) => {
    const { url, listPackages, filePath } = req.body;
    
    const input = filePath || url;
    let urls = [];

    if (!input) {
      throw new BadRequestError("A repository URL or a filePath is required");
    }

    // Attempt to treat the input as a file first
    try {
      const content = await fs.readFile(input, "utf-8");
      console.log(`[action] Reading URLs from file: ${input}...`);
      urls = content.split(/\r?\n/).filter(line => line.trim() !== "");
    } catch (err) {
      // If it's not a file or can't be read, treat it as a single URL
      urls = [input];
    }

    if (urls.length === 0) {
      throw new BadRequestError("Input resulted in no valid URLs for analysis");
    }

    console.log(`[action] Beginning parallel analysis for ${urls.length} target(s)...`);

    const analysisPromises = urls.map(targetUrl => 
      repoLimiter(async () => {
        try {
          console.log(`[action] Analyzing ${targetUrl}...`);
          return await performAnalysis(targetUrl, listPackages);
        } catch (err) {
          console.error(`[error] Analysis failed for ${targetUrl}:`, err.message);
          return {
            repository: {
              url: targetUrl,
              error: err.message,
            }
          };
        }
      })
    );

    const results = await Promise.all(analysisPromises);

    SuccessResponse(res, {
      message: urls.length > 1 ? "Batch repository analysis complete" : "Repository analyzed successfully",
      data: urls.length === 1 ? results[0] : results,
    });
  },
  {
    logError: true,
  },
);
