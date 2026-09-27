// Cocos' default mini-game templates use sample AppIDs; keep generated packages tied to this project config.
const fs = require('fs');
const path = require('path');

const platform = process.argv[2];
const supported = ['wechatgame', 'bytedance-mini-game'];
if (!supported.includes(platform)) throw new Error(`Unsupported Cocos mini-game platform: ${platform}`);
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'scripts', 'cocos-appids.json');
const outputPath = path.join(root, 'build', platform, 'project.config.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
if (!source[platform]) throw new Error(`Missing ${platform} AppID in ${sourcePath}`);
output.appid = source[platform];
// Cocos 已按 debug 开关自行控制压缩；开发者工具上传时的二次压缩/增强编译会把代码重打包成
// 巨型单行，vConsole 堆栈只剩 game.js:行:列 无法定位，因此上传一律保持原样。
output.setting = output.setting || {};
output.setting.minified = false;
output.setting.enhance = false;
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.log(`Cocos ${platform} AppID synced from scripts/cocos-appids.json`);
