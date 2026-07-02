/** Asset builder generator - writes all TypeScript files from base64 strings. */
const fs = require('fs');
fs.mkdirSync('src/assetBuilder', { recursive: true });
function wb(path, b64) {
  fs.writeFileSync(path, Buffer.from(b64, 'base64').toString('utf8'));
  console.log('Wrote:', path);
}
const files = require('./files.js');
for (const [key, b64] of Object.entries(r	te)) {
  wb(key, b64);
}
console.log('All files written');