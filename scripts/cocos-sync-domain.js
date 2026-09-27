// Keep the Cocos domain layer in step with the tested V1 rules while views move to Cocos nodes.
// The generated TS modules are build inputs, not a second hand-edited ruleset.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'utils');
const outputDir = path.join(root, 'assets', 'scripts', 'domain');
fs.mkdirSync(outputDir, { recursive: true });
const checkOnly = process.argv.includes('--check');
function sync(output, next) {
  if (fs.existsSync(output) && fs.readFileSync(output, 'utf8') === next) return;
  if (checkOnly) throw new Error(`Cocos generated module is stale: ${path.relative(root, output)}`);
  fs.writeFileSync(output, next);
}

for (const filename of fs.readdirSync(sourceDir).filter(f => f.endsWith('.js') && f !== 'platform.js')) {
  const source = fs.readFileSync(path.join(sourceDir, filename), 'utf8');
  const imports = new Map();
  const body = source.replace(/require\(['"]\.\/([\w-]+)['"]\)/g, (_, moduleName) => {
    if (!imports.has(moduleName)) imports.set(moduleName, `__domain_${moduleName.replace(/-/g, '_')}`);
    return imports.get(moduleName);
  }).replace(/module\.exports\s*=\s*\{([\s\S]*?)\};\s*$/, 'export {$1};\n');
  if (body.includes('module.exports') || body.includes('require(')) throw new Error(`Unsupported module syntax: ${filename}`);
  const prefix = '// @ts-nocheck\n// Generated from utils/' + filename + ' by scripts/cocos-sync-domain.js. Do not edit here.\n'
    + [...imports].map(([name, alias]) => `import * as ${alias} from './${name}';`).join('\n') + '\n';
  const output = path.join(outputDir, filename.replace(/\.js$/, '.ts'));
  const next = prefix + body;
  sync(output, next);
}

// Keep the platform video-ad contract identical to the V1 bridge (including its old-SDK fallback).
const serviceDir = path.join(root, 'assets', 'scripts', 'services');
fs.mkdirSync(serviceDir, { recursive: true });
const bridgeSource = fs.readFileSync(path.join(root, 'scripts', 'rewarded-bridge.js'), 'utf8');
const bridgeBody = bridgeSource
  .replace(/require\(['"]\.\.\/\.\.\/utils\/platform['"]\)/, '__platform')
  .replace(/module\.exports\s*=\s*\{([\s\S]*?)\};\s*$/, 'export {$1};\n');
if (bridgeBody.includes('module.exports') || bridgeBody.includes('require(')) throw new Error('Unsupported ad bridge syntax');
const bridgeOutput = path.join(serviceDir, 'RewardedBridge.ts');
const bridgeNext = '// @ts-nocheck\n// Generated from scripts/rewarded-bridge.js. Do not edit here.\nimport * as __platform from \'../domain/platform\';\n' + bridgeBody;
sync(bridgeOutput, bridgeNext);
