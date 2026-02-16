#!/usr/bin/env node
/**
 * Download @imgly/background-removal model resources to public/bg-removal-data/
 * so the app can work offline (no CDN download needed).
 *
 * Usage: node scripts/download-models.mjs [model]
 *   model: isnet_quint8 (default, 42MB), isnet_fp16 (84MB), isnet (168MB)
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';
const OUT_DIR = path.resolve(__dirname, '../public/bg-removal-data');
const MODEL = process.argv[2] || 'isnet_quint8';

function fetch(url) {
  return new Promise((resolve, reject) => {
    const doFetch = (u) => {
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doFetch(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    };
    doFetch(url);
  });
}

async function main() {
  console.log(`Downloading resources for model: ${MODEL}`);
  console.log(`Target: ${OUT_DIR}\n`);

  // 1. Fetch resources.json
  console.log('Fetching resources.json...');
  const resourcesJson = JSON.parse((await fetch(BASE_URL + 'resources.json')).toString());

  // Filter to only needed resources:
  //  - the selected model
  //  - onnxruntime-web WASM files
  const neededKeys = Object.keys(resourcesJson).filter((key) => {
    if (key === `/models/${MODEL}`) return true;
    if (key.startsWith('/onnxruntime-web/')) return true;
    return false;
  });

  console.log(`Resources needed: ${neededKeys.length}`);
  for (const k of neededKeys) {
    const r = resourcesJson[k];
    console.log(`  ${k}: ${(r.size / 1024 / 1024).toFixed(1)} MB (${r.chunks.length} chunks)`);
  }

  // 2. Create filtered resources.json (only what we need)
  const filteredResources = {};
  for (const k of neededKeys) {
    filteredResources[k] = resourcesJson[k];
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'resources.json'), JSON.stringify(filteredResources, null, 2));
  console.log('\nSaved resources.json');

  // 3. Download all chunks
  const allChunks = new Set();
  for (const k of neededKeys) {
    for (const chunk of resourcesJson[k].chunks) {
      allChunks.add(chunk.hash);
    }
  }
  console.log(`\nDownloading ${allChunks.size} chunks...`);

  let done = 0;
  for (const hash of allChunks) {
    const outPath = path.join(OUT_DIR, hash);
    if (fs.existsSync(outPath)) {
      done++;
      process.stdout.write(`\r  [${done}/${allChunks.size}] ${hash.slice(0, 12)}... (cached)`);
      continue;
    }

    const data = await fetch(BASE_URL + hash);
    fs.writeFileSync(outPath, data);
    done++;
    process.stdout.write(`\r  [${done}/${allChunks.size}] ${hash.slice(0, 12)}... (${(data.length / 1024 / 1024).toFixed(1)} MB)`);
  }

  console.log('\n\nDone! All resources downloaded.');

  // Show total size
  let totalSize = 0;
  const files = fs.readdirSync(OUT_DIR);
  for (const f of files) {
    totalSize += fs.statSync(path.join(OUT_DIR, f)).size;
  }
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
