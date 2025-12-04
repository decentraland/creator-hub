import { LocalFileSystem } from './utils/local';
import { writeFile } from './utils/fs';

async function main() {
  const local = new LocalFileSystem('./packs');
  const catalog = await local.getCatalog();
  await writeFile('catalog.json', JSON.stringify(catalog, null, 2));
  console.log('> catalog.json saved ✅');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
