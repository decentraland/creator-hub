/* eslint-disable no-useless-escape */

import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import log from 'electron-log/main';
import yauzl from 'yauzl';

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
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`;

  try {
    const ghResponse = await fetch(apiUrl);
    if (!ghResponse.ok) {
      throw new Error(`GitHub API request failed with status ${ghResponse.status}`);
    }

    const zipContent = Buffer.from(await ghResponse.arrayBuffer());

    await new Promise<void>((resolve, reject) => {
      yauzl.fromBuffer(zipContent, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) {
          reject(err || new Error('Failed to open zip file'));
          return;
        }

        let rootPrefix: string | null = null;

        /** Returns the folder prefix for a given file path inside the zip,
         * taking into account zip root folder and repo subfolder if specified
         */
        const getRootPrefix = (filePath: string) => {
          if (!rootPrefix) {
            // Detect root folder prefix if not set
            const parts = filePath.split('/');
            rootPrefix = parts.length > 1 ? parts[0] + '/' : '';
            if (subfolderPath) rootPrefix += subfolderPath + '/';
          }
          return rootPrefix;
        };

        zipfile.readEntry();
        zipfile.on('end', () => resolve());
        zipfile.on('error', reject);

        zipfile.on('entry', async (entry: yauzl.Entry) => {
          // Normalize the entry path (convert Windows backslashes)
          const filePath = entry.fileName.replace(/\\/g, '/');
          const rootPrefix = getRootPrefix(filePath);

          if (filePath.length <= rootPrefix.length || !filePath.startsWith(rootPrefix)) {
            // Skip this entry if it doesn't belong to the desired subfolder
            zipfile.readEntry();
            return;
          }

          // Strip root folder prefix
          const outputPath = path.join(destination, filePath.slice(rootPrefix.length));

          // Handle directories
          if (outputPath.endsWith('/')) {
            try {
              await fs.access(outputPath);
            } catch {
              await fs.mkdir(outputPath, { recursive: true });
            } finally {
              zipfile.readEntry();
            }
          } else {
            // Handle files
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err || !readStream) {
                reject(err || new Error('Failed to open read stream'));
                return;
              }

              const writeStream = createWriteStream(outputPath);
              readStream.pipe(writeStream);

              writeStream.on('finish', () => zipfile.readEntry());
              writeStream.on('error', reject);
              readStream.on('error', reject);
            });
          }
        });
      });
    });
  } catch (error: any) {
    log.error(`Error downloading GitHub repository: ${apiUrl} \n ${error.message}`);
  }
}
