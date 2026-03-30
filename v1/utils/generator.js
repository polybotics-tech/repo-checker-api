import constants from "../constants.js";

const githubRepo = (owner, name) =>
  `${constants.GITHUB_BASE_API_URL}/repos/${owner}/${name}`;

export const urlGenerator = {
  githubRepo,
  githubRepoTrees: (owner, name, branch) =>
    `${githubRepo(owner, name)}/git/trees/${branch}?recursive=1`,
  githubRepoContents: (owner, name, file) =>
    `${githubRepo(owner, name)}/contents/${file}`,
  githubOrgRepos: (org) => `${constants.GITHUB_BASE_API_URL}/orgs/${org}/repos`,
  npmPackageRegistry: (name) => `${constants.NPM_REGISTRY_URL}/${name}`,
  rubyGemRegistry: (name) => `${constants.RUBY_GEMS_REGISTRY_URL}/api/v1/versions/${name}.json`,
};
