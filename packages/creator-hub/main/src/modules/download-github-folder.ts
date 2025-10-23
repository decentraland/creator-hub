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

async function createFolderIfNotExists(folderPath: string) {
  try {
    await fs.access(folderPath);
    log.silly('[downloadGithubRepo] directory exists', { folderPath });
  } catch (e) {
    log.silly('[downloadGithubRepo] creating directory', { folderPath });
    await fs.mkdir(folderPath, { recursive: true });
  }
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
        const getRootPrefix = (zipEntryPath: string) => {
          if (!rootPrefix) {
            // Detect root folder prefix if not set
            const parts = zipEntryPath.split('/');
            rootPrefix = parts.length > 1 ? parts[0] + '/' : '';
            if (subfolderPath) rootPrefix += subfolderPath + '/';
          }
          return rootPrefix;
        };

        zipfile.readEntry();
        zipfile.on('end', () => resolve());
        zipfile.on('error', reject);

        zipfile.on('entry', async (entry: yauzl.Entry) => {
          try {
            // Normalize the entry path (convert Windows backslashes)
            const zipEntryPath = entry.fileName.replace(/\\/g, '/');
            const rootFolderPrefix = getRootPrefix(zipEntryPath);

            if (
              zipEntryPath.length <= rootFolderPrefix.length ||
              !zipEntryPath.startsWith(rootFolderPrefix)
            ) {
              // Skip this entry if it doesn't belong to the desired subfolder
              zipfile.readEntry();
              return;
            }

            // Strip root folder prefix
            const outputPath = path
              .join(destination, zipEntryPath.slice(rootFolderPrefix.length))
              .replace(/\\/g, '/');

            // Handle directories
            if (outputPath.endsWith('/')) {
              log.silly('[downloadGithubRepo] it is a folder', {
                outputPath,
              });
              await createFolderIfNotExists(outputPath);
              log.silly('[downloadGithubRepo] directory processed', {
                outputPath,
              });
              zipfile.readEntry();
            } else {
              log.silly('[downloadGithubRepo] it is a file', { outputPath });
              // Handle files
              await createFolderIfNotExists(path.dirname(outputPath));
              zipfile.openReadStream(entry, (err, readStream) => {
                if (err || !readStream) {
                  reject(err || new Error('Failed to open read stream'));
                  return;
                }

                const writeStream = createWriteStream(outputPath);
                readStream.pipe(writeStream);

                let wroteBytes = 0;

                readStream.on('data', chunk => {
                  wroteBytes += chunk.length;
                  // Log large entries progress occasionally
                  if (wroteBytes % (1024 * 1024) === 0) {
                    log.debug('[downloadGithubRepo] writing file progress', {
                      outputPath,
                      wroteBytes,
                    });
                  }
                });

                writeStream.on('finish', () => zipfile.readEntry());
                writeStream.on('error', reject);
                readStream.on('error', reject);
              });
            }
          } catch (error) {
            reject(error);
          }
        });
      });
    });
  } catch (error: any) {
    throw new Error(`Failed to download GitHub repository: ${apiUrl} \n ${error.message}`);
  }
}
