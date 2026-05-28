// Copies shared/src into functions/src/_shared/ so the Functions deploy is
// self-contained — Firebase only uploads the functions/ folder, so any
// workspace dependency outside it would not be resolvable at install time.
// The copied folder is gitignored. shared/ remains the source of truth.

const fs = require('fs');
const path = require('path');

const sharedSrc = path.resolve(__dirname, '..', '..', 'shared', 'src');
const dest = path.resolve(__dirname, '..', 'src', '_shared');

if (!fs.existsSync(sharedSrc)) {
  console.error(`copy-shared: source ${sharedSrc} does not exist`);
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(sharedSrc, dest, { recursive: true });

const rel = path.relative(process.cwd(), dest);
console.log(`copy-shared: copied shared/src -> ${rel}`);
