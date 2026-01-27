/* eslint-disable no-useless-escape */

import fs from 'fs/promises';
import path from 'path';
import extract from 'extract-zip';
import { fetch } from '/shared/fetch';

// Function to parse GitHub URL for root or subfolder
function parseGitHubUrl(githubUrl: string) {
  const rootRegex = /https:\/\/github\.com\/([^\/]+)\/([^\/]+)$/;
  const subfolderRegex = /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/?(.*)/;
  let match = githubUrl.match(subfolderRegex);
  if (match) {
    return {
      owner: match[1],
      repo: match[2],
      branch: match[3],
      path: match[4],
    };
  } else {
    match = githubUrl.match(rootRegex);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        branch: 'main', // Default to main if no branch is specified
        path: '', // No specific path for root
      };
    }
  }
  throw new Error("URL doesn't match the expected GitHub format.");
}

export async function downloadGithubRepo(githubUrl: string, destination: string) {
  const { owner, repo, branch, path: subfolderPath } = parseGitHubUrl(githubUrl);
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/zipball//${branch}`;

  try {
    const ghResponse = await fetch(apiUrl);
    if (!ghResponse.ok) {
      throw new Error(`GitHub API request failed with status ${ghResponse.status}`);
    }

    // Download and extract the zip file
    const tempZipPath = path.join(destination, `${repo}.zip`);
    const zipContent = await ghResponse.arrayBuffer();
    await fs.writeFile(tempZipPath, new Uint8Array(zipContent));
    await extract(tempZipPath, { dir: destination });
    await fs.rm(tempZipPath);

    // Determine the extracted folder name.
    // GitHub zips contain a root folder with a name like owner-repo-commitHash
    const files = await fs.readdir(destination);
    const extractedFolderName = files.length === 1 ? files[0] : null;
    if (!extractedFolderName) {
      throw new Error('Unable to determine the extracted folder name.');
    }

    // If a subfolder path is specified, navigate into it
    const extractedFolderPath = path.join(destination, extractedFolderName);
    const targetFolderPath = subfolderPath
      ? path.join(extractedFolderPath, subfolderPath)
      : extractedFolderPath;

    // Copy contents of the extracted folder (or subfolder) to the destination directory
    const items = await fs.readdir(targetFolderPath);
    for (const item of items) {
      const srcPath = path.join(targetFolderPath, item);
      const destPath = path.join(destination, item);
      await fs.rename(srcPath, destPath);
    }

    // Cleanup the extracted folder root
    await fs.rm(extractedFolderPath, { recursive: true, force: true });
  } catch (error: any) {
    throw new Error(`Error downloading GitHub repository: ${apiUrl} \n ${error.message}`);
  }
}
