// Works around a packaging bug in @unicitylabs/nostr-js-sdk (as of v0.6.0):
// its package.json declares "type": "module" but "main" points at
// dist/cjs/index.js, which is actually CommonJS code. Node treats every .js
// file under a "type": "module" package as ESM unless a closer package.json
// overrides it - dist/cjs/ is missing that override, so requiring the
// package throws "ReferenceError: exports is not defined in ES module scope".
//
// This script writes the missing override file after every `npm install`.
// If a future SDK release fixes this upstream, this becomes a harmless no-op.
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  '@unicitylabs',
  'nostr-js-sdk',
  'dist',
  'cjs',
  'package.json'
);

try {
  if (fs.existsSync(path.dirname(target))) {
    fs.writeFileSync(target, JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
    console.log('[postinstall] Patched nostr-js-sdk CJS module type override.');
  }
} catch (err) {
  console.warn('[postinstall] Could not patch nostr-js-sdk (non-fatal):', err.message);
}
