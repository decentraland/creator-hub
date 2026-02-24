import { resolve } from 'path';
import { createReadStream, readFileSync } from 'fs';
import dotenv from 'dotenv';
import mimeTypes from 'mime-types';
import type { S3ClientConfigType } from '@aws-sdk/client-s3';
import { HeadObjectCommand, S3 } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { version } from '../package.json';
import { LocalFileSystem } from './utils/local';

dotenv.config();
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const bucketName = process.env.S3_BUCKET_NAME;
const region = process.env.S3_REGION;
const concurrency = parseInt(process.env.S3_UPLOAD_CONCURRENCY || '');
const storageUrl = process.env.AWS_STORAGE_URL;

async function main() {
  // validate env vars
  if (!accessKeyId) {
    throw new Error('Missing AWS_ACCESS_KEY_ID env var');
  }
  if (!secretAccessKey) {
    throw new Error('Missing AWS_SECRET_ACCESS_KEY env var');
  }
  if (!bucketName) {
    throw new Error('Missing S3_BUCKET_NAME env var');
  }
  if (!region) {
    throw new Error('Missing S3_REGION env var');
  }
  if (isNaN(concurrency)) {
    throw new Error('Missing S3_UPLOAD_CONCURRENCY env var');
  }

  let config: S3ClientConfigType = {
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };

  console.log('Bucket Name:', bucketName);
  console.log('Region:', region);
  console.log('Concurrency:', concurrency);

  if (storageUrl) {
    config = {
      ...config,
      endpoint: storageUrl,
    };

    console.log('Storage URL:', storageUrl);
  }

  console.log('\n');

  // s3 auth client
  const client = new S3(config);

  // upload queue
  const { default: Queue } = await import('p-queue');
  const queue = new Queue({ concurrency: Math.max(concurrency, 1) });
  queue.on('error', error => {
    queue.pause();
    throw error;
  });

  const local = new LocalFileSystem('./packs');

  async function upload(key: string, pathToFile: string) {
    try {
      // if head object returns successfully, this file has already been uploaded, it can be skipped
      const head = new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      });
      await client.send(head);
    } catch (error) {
      // if head object does not exist, this file needs to be uploaded
      const mimeType = mimeTypes.lookup(pathToFile) || 'application/octet-stream';
      const uploadKey = local.isAdminToolkitAsset(pathToFile)
        ? pathToFile.replace(/^.*\/admin_toolkit\/assets\//, 'admin_toolkit/assets/')
        : key;
      const upload = new Upload({
        client,
        params: {
          Bucket: bucketName,
          Key: uploadKey,
          Body: createReadStream(pathToFile),
          ContentType: mimeType,
          CacheControl: 'max-age=31536000, immutable',
        },
      });
      await upload.done();
      console.log(`Uploaded "${pathToFile}" to "${uploadKey}"`);
    }
  }

  const catalog = await local.getCatalog();

  for (const assetPack of catalog.assetPacks) {
    console.log(`Starting upload of "${assetPack.name}"...`);
    // upload thumbnail
    const assetPackPath = local.getAssetPackPath(assetPack.name);
    queue.add(() =>
      upload(`contents/${assetPack.thumbnail}`, resolve(assetPackPath, 'thumbnail.png')),
    );

    // upload assets
    const assetsPath = local.getAssetsPath(assetPack.name);
    const assets = await local.getAssets(assetsPath);
    for (const asset of assets) {
      for (const path in asset.contents) {
        const hash = asset.contents[path];
        const key = `contents/${hash}`;
        queue.add(() => upload(key, resolve(asset.path, path)));
      }
    }

    // wait for upload queue to finish
    await queue.onIdle();
    console.log(`Upload of "${assetPack.name}" is complete ✅`);
  }

  // Upload catalog.json as both a versioned immutable copy and the mutable latest pointer.
  const catalogContent = readFileSync('./catalog.json');

  const versionedUpload = new Upload({
    client,
    params: {
      Bucket: bucketName,
      Key: `asset-packs/${version}/catalog.json`,
      Body: catalogContent,
      ContentType: 'application/json',
      CacheControl: 'max-age=31536000, immutable',
    },
  });
  await versionedUpload.done();
  console.log(`Uploaded catalog.json to asset-packs/${version}/catalog.json ✅`);

  const latestUpload = new Upload({
    client,
    params: {
      Bucket: bucketName,
      Key: 'asset-packs/latest/catalog.json',
      Body: catalogContent,
      ContentType: 'application/json',
      CacheControl: 'max-age=0, must-revalidate',
    },
  });
  await latestUpload.done();
  console.log('Uploaded catalog.json to asset-packs/latest/catalog.json ✅');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
