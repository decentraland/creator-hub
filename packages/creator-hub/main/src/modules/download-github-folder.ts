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

        // Diagnostic counters
        let totalEntries = 0;
        let processedEntries = 0;
        let skippedEntries = 0;
        let extractedFiles = 0;
        let extractedDirs = 0;

        log.info('[downloadGithubRepo] Zip opened, starting to read entries');

        let rootPrefix: string | null = null;

        /** Returns the folder prefix for a given file path inside the zip,
         * taking into account zip root folder and repo subfolder if specified
         */
        const getRootPrefix = (zipEntryPath: string) => {
          if (!rootPrefix) {
            // Detect root folder prefix if not set using zip entry names
            const parts = zipEntryPath.split('/');
            rootPrefix = parts.length > 1 ? parts[0] + '/' : '';
            if (subfolderPath) rootPrefix += subfolderPath.replace(/^\/+|\/+$/g, '') + '/';
            log.info(`[downloadGithubRepo] Detected rootPrefix=${rootPrefix}`);
          }
          return rootPrefix;
        };

        zipfile.readEntry();
        zipfile.on('end', () => {
          log.info('[downloadGithubRepo] Zip processing ended', { totalEntries, processedEntries, skippedEntries, extractedFiles, extractedDirs });
          resolve();
        });
        zipfile.on('error', (e) => {
          log.error('[downloadGithubRepo] Zipfile error', e);
          reject(e);
        });

        zipfile.on('entry', async (entry: yauzl.Entry) => {
          totalEntries++;
          // Normalize the entry path (convert Windows backslashes)
          const zipEntryPath = entry.fileName.replace(/\\/g, '/');
          log.debug('[downloadGithubRepo] entry', { index: totalEntries, zipEntryPath, isDirectory: entry.fileName.endsWith('/') });

          const currentRootPrefix = getRootPrefix(zipEntryPath);

          if (zipEntryPath.length <= currentRootPrefix.length || !zipEntryPath.startsWith(currentRootPrefix)) {
            // Skip this entry if it doesn't belong to the desired subfolder
            skippedEntries++;
            log.silly('[downloadGithubRepo] skipping entry outside rootPrefix', { zipEntryPath, currentRootPrefix });
            zipfile.readEntry();
            return;
          }

          // Strip root folder prefix
          const relativePath = zipEntryPath.slice(currentRootPrefix.length);
          const outputPath = path.join(destination, relativePath);
          log.silly('[downloadGithubRepo] output path', { relativePath, outputPath });

          // Handle directories
          if (zipEntryPath.endsWith('/')) {
            extractedDirs++;
            try {
              await fs.access(outputPath);
              log.silly('[downloadGithubRepo] directory exists', { outputPath });
            } catch (e) {
              log.silly('[downloadGithubRepo] creating directory', { outputPath });
              await fs.mkdir(outputPath, { recursive: true });
            } finally {
              processedEntries++;
              log.silly('[downloadGithubRepo] directory processed', { outputPath });
              zipfile.readEntry();
            }
          } else {
            // Handle files
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err || !readStream) {
                log.error('[downloadGithubRepo] failed to open read stream for entry', { zipEntryPath, error: err });
                reject(err || new Error('Failed to open read stream'));
                return;
              }

              const writeStream = createWriteStream(outputPath);
              let wroteBytes = 0;

              readStream.on('data', (chunk) => {
                wroteBytes += chunk.length;
                // Log large entries progress occasionally
                if (wroteBytes % (1024 * 1024) === 0) {
                  log.debug('[downloadGithubRepo] writing file progress', { outputPath, wroteBytes });
                }
              });

              readStream.pipe(writeStream);

              writeStream.on('finish', () => {
                extractedFiles++;
                processedEntries++;
                log.silly('[downloadGithubRepo] file extracted', { outputPath, bytes: wroteBytes });
                zipfile.readEntry();
              });
              writeStream.on('error', (e) => {
                log.error('[downloadGithubRepo] writeStream error', { outputPath, error: e });
                reject(e);
              });
              readStream.on('error', (e) => {
                log.error('[downloadGithubRepo] readStream error', { zipEntryPath, error: e });
                reject(e);
              });
            });
          }
        });
      });
    });
  } catch (error: any) {
    log.error(`Error downloading GitHub repository: ${apiUrl} \n ${error?.message}`, { error });
    throw new Error(`Failed to download GitHub repository: ${error?.message}`);
  }
}
