// scripts/bump-version.js
//
// Bumps the user-facing app version in version.json (the single source of
// truth - app.config.js reads it, and package.json is kept in sync here).
// EAS's autoIncrement only bumps the *build number*; this handles the
// version people actually see (e.g. 1.0.3).
//
// Usage (normally via the npm scripts, see package.json):
//   node scripts/bump-version.js patch   1.0.0 -> 1.0.1
//   node scripts/bump-version.js minor   1.0.4 -> 1.1.0
//   node scripts/bump-version.js major   1.4.2 -> 2.0.0
//   node scripts/bump-version.js 2.0.0   set an exact version
//   node scripts/bump-version.js         no argument = patch

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const versionPath = path.join(root, 'version.json');
const packagePath = path.join(root, 'package.json');

const arg = (process.argv[2] || 'patch').toLowerCase();
const current = JSON.parse(fs.readFileSync(versionPath, 'utf8')).version;

if (!/^\d+\.\d+\.\d+$/.test(current)) {
  console.error(`version.json has an invalid version: "${current}"`);
  process.exit(1);
}

const [major, minor, patch] = current.split('.').map(Number);
let next;
if (arg === 'patch') next = `${major}.${minor}.${patch + 1}`;
else if (arg === 'minor') next = `${major}.${minor + 1}.0`;
else if (arg === 'major') next = `${major + 1}.0.0`;
else if (/^\d+\.\d+\.\d+$/.test(arg)) next = arg;
else {
  console.error(`Unknown bump "${arg}" - use patch, minor, major, or an exact x.y.z`);
  process.exit(1);
}

fs.writeFileSync(versionPath, JSON.stringify({ version: next }, null, 2) + '\n');

// Keep package.json's version matching so nothing drifts.
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.version = next;
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`Version bumped: ${current} -> ${next}`);