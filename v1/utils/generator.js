import constants from "../constants.js";

const githubRepo = (owner, name) =>
  `${constants.GITHUB_BASE_API_URL}/repos/${owner}/${name}`;

export const urlGenerator = {
  githubRepo,
  githubRepoTrees: (owner, name, branch) =>
    `${githubRepo(owner, name)}/git/trees/${branch}?recursive=1`,
  githubRepoContents: (owner, name, file) =>
    `${githubRepo(owner, name)}/contents/${file}`,
};
