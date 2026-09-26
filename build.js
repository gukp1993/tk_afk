// 双平台打包同步脚本：把共享源码（src/ utils/）复制进各平台打包目录
// 发布流程：先跑本脚本，再用对应开发者工具打开打包目录
//   微信：微信开发者工具 → 导入 wechat/
//   抖音：抖音开发者工具 → 导入 douyin/
// 用法：node build.js          同步一次
//       node build.js --watch  监听共享源码变化持续同步（开发时开着）
// 注意：wechat|douyin 下的 src/ utils/ 是生成物（已 gitignore），手改会被覆盖；改代码一律改根目录共享源码
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SHARED_DIRS = ['src', 'utils'];
const PLATFORMS = [
  { dir: 'wechat', name: '微信小游戏' },
  { dir: 'douyin', name: '抖音小游戏' }
];
const DOUYIN_APPID_PLACEHOLDER = 'tt0000000000000000';

function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const s = path.join(srcDir, entry.name);
    const d = path.join(destDir, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function countFiles(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += countFiles(path.join(dir, entry.name));
    else n += 1;
  }
  return n;
}

function build() {
  for (const p of PLATFORMS) {
    let n = 0;
    for (const dir of SHARED_DIRS) {
      const dest = path.join(ROOT, p.dir, dir);
      fs.rmSync(dest, { recursive: true, force: true }); // 整目录重建，避免残留已删除文件
      copyDir(path.join(ROOT, dir), dest);
      n += countFiles(dest);
    }
    console.log('✔ ' + p.name + ' ' + p.dir + '/ 已同步（' + n + ' 个文件）');
  }
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'douyin', 'project.config.json'), 'utf8'));
  if (cfg.appid === DOUYIN_APPID_PLACEHOLDER) {
    console.log('⚠ douyin/project.config.json 的 appid 还是占位符，发布抖音前请替换为你的抖音小游戏 AppID');
  }
}

if (process.argv.includes('--watch')) {
  build();
  let timer = null;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(build, 200); };
  SHARED_DIRS.forEach(d => fs.watch(path.join(ROOT, d), { recursive: true }, schedule));
  console.log('👀 监听 ' + SHARED_DIRS.join(' ') + ' 变化中，Ctrl+C 退出');
} else {
  build();
}
