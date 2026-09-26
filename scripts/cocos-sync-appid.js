// Cocos' default mini-game templates use sample AppIDs; keep build output tied to the live project config.
const fs = require('fs');
const path = require('path');

const platform = process.argv[2];
const sourceDir = { wechatgame: 'wechat', 'bytedance-mini-game': 'douyin' }[platform];
if (!sourceDir) throw new Error(`Unsupported Cocos mini-game platform: ${platform}`);
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, sourceDir, 'project.config.json');
const outputPath = path.join(root, 'build', platform, 'project.config.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
if (!source.appid) throw new Error(`Missing appid in ${sourcePath}`);
output.appid = source.appid;
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.log(`Cocos ${platform} AppID synced from ${sourceDir}/project.config.json`);
