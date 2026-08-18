import 'dotenv/config';
import { getSearchProvider } from './index.js';

// Uso: tsx src/search/debug-search.ts "query" [searxng|tavily|brave|duckduckgo]
const query = process.argv[2] ?? 'shows sertanejos Goiânia';
const providerName = process.argv[3]; // override env se passado

const provider = getSearchProvider(providerName);
console.log(`[search:${provider.name}] query: "${query}"\n`);

const results = await provider.search(query, 5);
console.log(`${results.length} resultado(s):\n`);
for (const r of results) {
  console.log(`  [${results.indexOf(r) + 1}] ${r.title}`);
  console.log(`      URL: ${r.url}`);
  console.log(`      Snippet: ${r.snippet.slice(0, 200)}`);
  if (r.content && r.content !== r.snippet) {
    console.log(`      Conteúdo: ${r.content.slice(0, 300)}...`);
  }
  console.log();
}

process.exit(0);
