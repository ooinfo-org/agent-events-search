import { extractOgImageUrl } from './extractOgImage.js';

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('uso: npm run debug:og "<pageUrl>"');
    process.exit(1);
  }
  console.error(`→ fetching ${url}...`);
  const img = await extractOgImageUrl(url);
  console.error('===');
  if (img) console.error(`✅ og:image = ${img}`);
  else console.error('❌ não achou og:image');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
