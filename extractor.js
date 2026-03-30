import "dotenv/config";
import axios from "axios";
import fs from "fs";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node extractor.js <org_name_or_url>");
  process.exit(1);
}

// Extract org name if URL is provided
let org = input;
if (input.includes("github.com/")) {
    const match = input.match(/github\.com\/(?:orgs\/)?([^\/]+)/);
    if (match) org = match[1];
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const headers = {
  "User-Agent": "repo-checker-extractor",
};
if (GITHUB_TOKEN) {
  headers["Authorization"] = `token ${GITHUB_TOKEN}`;
}

async function extract() {
  let allRepos = [];
  let page = 1;
  let hasMore = true;

  console.log(`[action] Extracting repositories for organization: ${org}...`);

  while (hasMore) {
    try {
      const res = await axios.get(`https://api.github.com/orgs/${org}/repos`, {
        headers,
        params: {
          type: "public",
          per_page: 100,
          page: page,
        },
      });

      const repos = res.data;
      if (!repos || repos.length === 0) {
        hasMore = false;
      } else {
        const urls = repos.map(r => r.html_url);
        allRepos = allRepos.concat(urls);
        console.log(`[log] Page ${page}: Found ${repos.length} repos.`);
        
        if (repos.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      }
    } catch (error) {
      console.error("[error] Failed to fetch repositories:", error.response?.data?.message || error.message);
      hasMore = false;
    }
    
    if (page > 20) break; // Safety limit
  }

  if (allRepos.length > 0) {
    const fileName = "repos.txt";
    fs.writeFileSync(fileName, allRepos.join("\n"), "utf-8");
    console.log(`[success] Extracted ${allRepos.length} repositories to ${fileName}`);
  } else {
    console.log("[info] No repositories found.");
  }
}

extract();
