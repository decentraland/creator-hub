import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import type {
  AssetData,
  LegacyAssetData,
  Component,
  AssetDataWithoutComposite,
} from '../src/types';
import {
  isAssetData,
  isAssetPackData,
  isLegacyAssetData,
  isAssetDataWithoutComposite,
} from '../src/types';

/**
 * Creates a component object with the specified name and data.
 * @param componentName - The name of the component
 * @param componentData - The data for the component
 * @returns A Component object with data
 */
function createComponent(componentName: string, componentData: any): Component {
  return {
    name: componentName,
    data: {
      '0': {
        json: componentData,
      },
    },
  };
}

/**
 * Converts data from the old format to the new format.
 * Creates components for each entry in the old data's components.
 * @param oldData - The data in the old format
 * @returns The data converted to the new format
 */
function convertToNewFormat(oldData: LegacyAssetData): AssetData {
  const newData: AssetData = {
    id: oldData.id,
    name: oldData.name,
    category: oldData.category,
    tags: oldData.tags,
    composite: {
      version: 1,
      components: [],
    },
  };

  // Convert each component
  for (const [componentName, componentData] of Object.entries(oldData.components)) {
    const component = createComponent(componentName, componentData);
    newData.composite.components.push(component);
  }

  return newData;
}

/**
 * Migrates a single file from the old format to the new format.
 * Handles file reading, format conversion, and file writing.
 * Skips already migrated files and handles errors gracefully.
 * @param filePath - The path to the file to migrate
 */
function migrateFile(filePath: string) {
  console.log(`Processing ${filePath}...`);

  try {
    // Read and parse the file
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Check if already migrated
    if (isAssetDataWithoutComposite(data)) {
      console.log(`Skipping ${filePath} - already migrated`);
      return;
    }

    if (isAssetData(data)) {
      console.log(
        'This file has the composite data inside, it needs to be moved into a separate file.',
      );
      const { composite, ...rest } = data;
      // new data should be oldData without composite
      const newData = rest as AssetDataWithoutComposite;
      writeFileSync(filePath, JSON.stringify(newData, null, 2));
      const compositePath = `${filePath.replace('data.json', 'composite.json')}`;
      writeFileSync(compositePath, JSON.stringify(composite, null, 2));
      console.log(`Successfully migrated ${filePath}`);
      return;
    }

    if (!isLegacyAssetData(data)) {
      throw new Error(`Error processing ${filePath} - not a legacy asset data`);
    }

    console.log(`Migrating ${filePath}...`);
    const oldData = data as LegacyAssetData;
    const newData = convertToNewFormat(oldData);

    // Write the new file
    writeFileSync(filePath, JSON.stringify(newData, null, 2));
    console.log(`Successfully migrated ${filePath}`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    console.log('Continuing with next file...');
  }
}

async function migrate() {
  // Find all data.json files in packs directory
  const files = await glob('packs/**/data.json');

  console.log(`Found ${files.length} files to process`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  // Migrate each file
  for (const [index, file] of files.entries()) {
    console.log(`\nProcessing file ${index + 1} of ${files.length}`);
    try {
      const content = readFileSync(file, 'utf-8');
      const data = JSON.parse(content);
      if (isAssetPackData(data) && !isAssetData(data) && !isAssetDataWithoutComposite(data)) {
        // skip asset pack data
        console.log(`Skipping ${file} - asset pack data`);
        continue;
      }

      if (isAssetDataWithoutComposite(data)) {
        skipped++;
      } else {
        migrateFile(file);
        migrated++;
      }
    } catch (error) {
      console.error(`Error with file ${file}:`, error);
      failed++;
    }
  }

  return {
    files: files.length,
    migrated,
    skipped,
    failed,
  };
}

migrate()
  .then(data => {
    console.log('\nMigration complete!');
    console.log(`Total files processed: ${data.files}`);
    console.log(`- Successfully migrated: ${data.migrated}`);
    console.log(`- Already migrated (skipped): ${data.skipped}`);
    console.log(`- Failed: ${data.failed}`);
  })
  .catch(error => {
    console.error('Error during migration:', error);
  });
