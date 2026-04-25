// Injects ESM shims into the ncc-bundled dist/index.js so that bundled CJS
// dependencies relying on __dirname / __filename / require continue to work.
// ncc emits ESM when the source package has "type": "module", but several
// bundled deps (e.g. transitive form-data / undici code) reference these
// CommonJS globals. We define them on globalThis at the top of the bundle.
import { readFile, writeFile } from 'node:fs/promises';

const BUNDLE = new URL('../dist/index.js', import.meta.url);

const SHIM = `import{fileURLToPath as __gbFileURLToPath}from"node:url";import{dirname as __gbDirname}from"node:path";import{createRequire as __gbCreateRequire}from"node:module";globalThis.__filename??=__gbFileURLToPath(import.meta.url);globalThis.__dirname??=__gbDirname(globalThis.__filename);globalThis.require??=__gbCreateRequire(import.meta.url);
`;

const original = await readFile(BUNDLE, 'utf8');
if (original.startsWith(SHIM)) {
  console.log('Shim already present, skipping.');
  process.exit(0);
}
await writeFile(BUNDLE, SHIM + original, 'utf8');
console.log('Injected ESM shim into dist/index.js');
