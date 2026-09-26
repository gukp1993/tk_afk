// 小游戏项目静态检查：双平台入口、JSON 合法性、JS 语法、require 解析、场景注册、平台目录一致性
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) pass++;
  else { fail++; console.log('FAIL: ' + name); }
}

// 1. 双平台打包目录入口文件
const PLATFORMS = [
  { dir: 'wechat', name: '微信', appidOk: a => a === 'wx03eb4074ce45033b' },
  { dir: 'douyin', name: '抖音', appidOk: a => typeof a === 'string' && a.indexOf('tt') === 0 }
];
for (const p of PLATFORMS) {
  ok(fs.existsSync(path.join(ROOT, p.dir, 'game.json')), p.dir + '/game.json exists');
  ok(fs.existsSync(path.join(ROOT, p.dir, 'game.js')), p.dir + '/game.js exists');
  const gj = JSON.parse(fs.readFileSync(path.join(ROOT, p.dir, 'game.json'), 'utf8'));
  ok(gj.deviceOrientation === 'portrait', p.dir + ' portrait orientation');
  const pc = JSON.parse(fs.readFileSync(path.join(ROOT, p.dir, 'project.config.json'), 'utf8'));
  ok(pc.compileType === 'game', p.dir + ' compileType=game');
  ok(p.appidOk(pc.appid), p.dir + ' appid configured');
}

// 2. 共享源码所有 JS 语法可解析 + require 可解析
function walk(dir, out) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (['node_modules', 'preview', 'test', 'legacy-miniprogram', 'wechat', 'douyin', 'cocos-client', 'build', 'library', 'temp', 'local', 'settings', 'assets'].includes(f)) continue;
      walk(p, out);
    } else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}
const jsFiles = walk(ROOT, []);
jsFiles.forEach(p => {
  const code = fs.readFileSync(p, 'utf8');
  try { new vm.Script(code); ok(true, 'syntax ' + path.relative(ROOT, p)); }
  catch (e) { ok(false, 'syntax ' + path.relative(ROOT, p) + ': ' + e.message); }
  const re = /require\('([^']+)'\)/g;
  let m;
  while ((m = re.exec(code))) {
    const rp = m[1];
    if (rp[0] !== '.') continue; // Node 内置模块（fs/path 等）非项目文件
    const abs = path.resolve(path.dirname(p), rp) + '.js';
    ok(fs.existsSync(abs), 'require ' + rp + ' in ' + path.relative(ROOT, p));
  }
});

// 3. 场景注册完备（src/scenes.js 集中注册所有场景）
const scenesJs = fs.readFileSync(path.join(ROOT, 'src', 'scenes.js'), 'utf8');
['home', 'heroes', 'summon', 'bag', 'journey', 'heroDetail', 'formation', 'tower', 'arena', 'forge', 'shop', 'battle']
  .forEach(s => ok(new RegExp("register\\('" + s + "'").test(scenesJs), 'scene registered: ' + s));

// 4. 屏幕对象必需的方法
['home', 'heroes', 'summon', 'bag', 'journey', 'heroDetail', 'formation', 'tower', 'arena', 'forge', 'shop', 'battle'].forEach(s => {
  const p = path.join(ROOT, 'src', 'screens', s + '.js');
  if (!fs.existsSync(p)) return;
  const code = fs.readFileSync(p, 'utf8');
  ok(/draw\s*\(/.test(code) || /draw:/.test(code), 'screen ' + s + ' has draw');
  ok(/name:\s*'" + s + "'|name:\s*'" + s + "'/.test(code) || new RegExp("name:\\s*'" + s + "'").test(code), 'screen ' + s + ' named');
});

// 5. UI 框架方法被引用但不缺失（粗查 ui.xxx 常用方法存在）
const uiSrc = fs.readFileSync(path.join(ROOT, 'src', 'ui.js'), 'utf8');
['panel', 'text', 'btn', 'chipBtn', 'heroFace', 'stars', 'bar', 'beginScroll', 'endScroll', 'modal', 'toast', 'addFloat', 'drawFloaters', 'tag', 'onTouchStart', 'onTouchMove', 'onTouchEnd'].forEach(fn => {
  ok(new RegExp('\\b' + fn + '\\s*\\(').test(uiSrc), 'ui method ' + fn);
});

// 6. 平台打包目录与共享源码一致（不一致提示重跑 node build.js）
function listFiles(dir, baseDir, rels) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (f === '.DS_Store') continue;
    if (fs.statSync(p).isDirectory()) listFiles(p, baseDir, rels);
    else rels.push(path.relative(baseDir, p));
  }
  return rels;
}
for (const p of PLATFORMS) {
  for (const base of ['src', 'utils']) {
    const srcRoot = path.join(ROOT, base);
    const dstRoot = path.join(ROOT, p.dir, base);
    ok(fs.existsSync(dstRoot), p.dir + '/' + base + ' 已生成（跑 node build.js）');
    if (!fs.existsSync(dstRoot)) continue;
    const srcFiles = listFiles(srcRoot, srcRoot, []).sort();
    const dstFiles = listFiles(dstRoot, dstRoot, []).sort();
    ok(JSON.stringify(srcFiles) === JSON.stringify(dstFiles), p.dir + '/' + base + ' 文件清单一致');
    for (const rel of srcFiles) {
      if (dstFiles.indexOf(rel) < 0) continue;
      const a = fs.readFileSync(path.join(srcRoot, rel), 'utf8');
      const b = fs.readFileSync(path.join(dstRoot, rel), 'utf8');
      ok(a === b, p.dir + '/' + base + '/' + rel + ' 内容一致');
    }
  }
}
// 平台代码 API 只允许经 utils/platform.js 适配层：共享源码里不得直调 wx./tt.
const allSharedJs = [];
['src', 'utils'].forEach(base => {
  listFiles(path.join(ROOT, base), path.join(ROOT, base), []).filter(f => f.endsWith('.js'))
    .forEach(rel => allSharedJs.push({ base, rel }));
});
allSharedJs.forEach(({ base, rel }) => {
  if (base === 'utils' && rel === 'platform.js') return; // 适配层例外
  const code = fs.readFileSync(path.join(ROOT, base, rel), 'utf8');
  ok(!/\b(wx|tt)\s*\./.test(code), '无平台直调 ' + base + '/' + rel);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
