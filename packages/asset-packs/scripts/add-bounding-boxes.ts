import * as path from 'path';
import * as fs from 'fs';
import { getSubfolders, readJson, writeFile, getFiles } from './utils/fs';

interface BoundingBox {
  x: number;
  y: number;
  z: number;
}

interface DataJson {
  id: string;
  name: string;
  category: string;
  tags?: string[];
  description?: string;
  author?: string;
  boundingBox?: BoundingBox;
}

/**
 * Calculate bounding box from a glTF document
 */
async function calculateBoundingBox(glbPath: string): Promise<BoundingBox | null> {
  try {
    // Dynamic import for ES module
    const { NodeIO } = await import('@gltf-transform/core');
    const io = new NodeIO();
    const document = await io.read(glbPath);

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    // Iterate through all scenes
    const scenes = document.getRoot().listScenes();
    for (const scene of scenes) {
      // Iterate through all nodes in the scene
      for (const node of scene.listChildren()) {
        processNode(node);
      }
    }

    function processNode(node: any) {
      const mesh = node.getMesh();

      if (mesh) {
        // Get the node's world transform
        const translation = node.getTranslation();
        const scale = node.getScale();

        // Process each primitive in the mesh
        for (const primitive of mesh.listPrimitives()) {
          const position = primitive.getAttribute('POSITION');

          if (position) {
            const array = position.getArray();
            if (array) {
              // Iterate through vertices (array contains [x, y, z, x, y, z, ...])
              for (let i = 0; i < array.length; i += 3) {
                // Apply node transformation
                const x = array[i] * scale[0] + translation[0];
                const y = array[i + 1] * scale[1] + translation[1];
                const z = array[i + 2] * scale[2] + translation[2];

                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                minZ = Math.min(minZ, z);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
                maxZ = Math.max(maxZ, z);
              }
            }
          }
        }
      }

      // Recursively process children
      for (const child of node.listChildren()) {
        processNode(child);
      }
    }

    // If we found any vertices, calculate the bounding box dimensions
    if (minX !== Infinity && maxX !== -Infinity) {
      return {
        x: Math.abs(maxX - minX),
        y: Math.abs(maxY - minY),
        z: Math.abs(maxZ - minZ),
      };
    }

    return null;
  } catch (error) {
    console.error(`Error processing ${glbPath}:`, error);
    return null;
  }
}

/**
 * Find the .glb file in an asset directory
 */
async function findGlbFile(assetPath: string): Promise<string | null> {
  try {
    const files = await getFiles(assetPath);

    // Look for .glb file directly in the asset directory
    const glbFile = files.find(f => f.endsWith('.glb'));
    if (glbFile) {
      return glbFile;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Process a single asset directory
 */
async function processAsset(assetPath: string): Promise<void> {
  const dataJsonPath = path.join(assetPath, 'data.json');

  // Check if data.json exists
  if (!fs.existsSync(dataJsonPath)) {
    return;
  }

  try {
    // Read the current data.json
    const dataJson: DataJson = await readJson(dataJsonPath);

    // Skip if boundingBox already exists
    if (dataJson.boundingBox) {
      console.log(`⏭️  Skipping ${dataJson.name} - bounding box already exists`);
      return;
    }

    // Find the .glb file
    const glbPath = await findGlbFile(assetPath);

    if (!glbPath) {
      console.log(`⚠️  No .glb file found for ${dataJson.name}`);
      return;
    }

    console.log(`📦 Processing ${dataJson.name}...`);

    // Calculate bounding box
    const boundingBox = await calculateBoundingBox(glbPath);

    if (boundingBox) {
      // Round to 3 decimal places for cleaner JSON
      dataJson.boundingBox = {
        x: Math.round(boundingBox.x * 1000) / 1000,
        y: Math.round(boundingBox.y * 1000) / 1000,
        z: Math.round(boundingBox.z * 1000) / 1000,
      };

      // Write updated data.json
      await writeFile(dataJsonPath, JSON.stringify(dataJson, null, 2));

      console.log(
        `✅ Updated ${dataJson.name} with bounding box: ${JSON.stringify(dataJson.boundingBox)}`,
      );
    } else {
      console.log(`❌ Failed to calculate bounding box for ${dataJson.name}`);
    }
  } catch (error) {
    console.error(`Error processing ${assetPath}:`, error);
  }
}

/**
 * Process a single asset pack
 */
async function processAssetPack(packPath: string): Promise<void> {
  const assetsPath = path.join(packPath, 'assets');

  if (!fs.existsSync(assetsPath)) {
    return;
  }

  const assetDirs = await getSubfolders(assetsPath);

  for (const assetDir of assetDirs) {
    await processAsset(assetDir);
  }
}

/**
 * Main function
 */
async function main() {
  const packsPath = './packs';

  // Get command line arguments
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Process specific pack(s)
    for (const packName of args) {
      const packPath = path.join(packsPath, packName);
      if (fs.existsSync(packPath)) {
        console.log(`\n🎨 Processing pack: ${packName}\n`);
        await processAssetPack(packPath);
      } else {
        console.log(`❌ Pack not found: ${packName}`);
      }
    }
  } else {
    // Process all packs
    const packs = await getSubfolders(packsPath);

    for (const packPath of packs) {
      const packName = path.basename(packPath);
      console.log(`\n🎨 Processing pack: ${packName}\n`);
      await processAssetPack(packPath);
    }
  }

  console.log('\n✨ Done!');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
