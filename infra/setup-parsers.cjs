const fs = require('fs');
const path = require('path');
const https = require('https');

const PARSERS_DIR = path.join(__dirname, 'parsers');

if (!fs.existsSync(PARSERS_DIR)) {
  fs.mkdirSync(PARSERS_DIR, { recursive: true });
}

const files = [
  {
    name: 'tree-sitter-rust.wasm',
    url: 'https://unpkg.com/tree-sitter-wasms@0.1.11/out/tree-sitter-rust.wasm'
  },
  {
    name: 'tree-sitter-typescript.wasm',
    url: 'https://unpkg.com/tree-sitter-wasms@0.1.11/out/tree-sitter-typescript.wasm'
  }
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return download(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
      }
      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function main() {
  console.log('[Setup] Downloading WASM parsers...');
  for (const { name, url } of files) {
    const dest = path.join(PARSERS_DIR, name);
    console.log(`[Setup] Fetching ${name}...`);
    await download(url, dest);
    console.log(`[Setup] Saved to ${dest}`);
  }
  console.log('[Setup] Done.');
}

main().catch(console.error);
