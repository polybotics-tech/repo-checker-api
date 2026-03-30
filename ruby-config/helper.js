import { instance } from "../v1/lib/axios.js";
import { urlGenerator } from "../v1/utils/generator.js";

export function extractGemfilePathsFromTree(tree) {
  const gemfilePaths = tree
    .filter((file) => file.path.endsWith("Gemfile"))
    .map((file) => file.path);

  return gemfilePaths;
}

export async function readGemfile(options = { owner, repo, path }) {
  const { owner, repo, path } = options;

  try {
    const res = await instance.get(
      urlGenerator.githubRepoContents(owner, repo, path),
    );

    const base64 = res.data.content;
    const decoded = Buffer.from(base64, "base64").toString("utf-8");

    return decoded;
  } catch (error) {
    return null;
  }
}

export function extractGemDependencies(gemfileContent) {
  const gemRegex = /gem\s+['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])?/g;
  const dependencies = [];
  let match;
  while ((match = gemRegex.exec(gemfileContent)) !== null) {
    dependencies.push({
      name: match[1],
      version: match[2] || "latest",
    });
  }

  return { dependencies, devDependencies: [] };
}
