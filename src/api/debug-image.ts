import 'dotenv/config';
import { login } from './client.js';
import { processarECoverImagem } from './imageUpload.js';

async function main() {
  const url =
    process.argv[2] ??
    'https://www.sympla.com.br/images/logos/sympla-color.svg';
  console.error(`→ login...`);
  await login();
  console.error(`  ✓`);
  console.error(`→ processando ${url}...`);
  const result = await processarECoverImagem(url);
  console.error(`\n===`);
  if (result) console.error(`✅ URL final: ${result}`);
  else console.error(`❌ falhou`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
