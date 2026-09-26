// 小游戏项目静态检查：game 入口、JSON 合法性、JS 语法、require 解析、场景注册
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) pass++;
  else { fail++; console.log('FAIL: ' + name); }
}

// 1. 小游戏入口文件
ok(fs.existsSync(path.join(ROOT, 'game.json')), 'game.json exists');
ok(fs.existsSync(path.join(ROOT, 'game.js')), 'game.js exists');
const gj = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.json'), 'utf8'));
ok(gj.deviceOrientation === 'portrait', 'portrait orientation');
const pc = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.config.json'), 'utf8'));
ok(pc.compileType === 'game', 'compileType=game');
ok(pc.appid === 'wx03eb4074ce45033b', 'appid configured');

// 2. 所有 JS 语法可解析 + require 可解析
function walk(dir, out) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (['node_modules', 'preview', 'test', 'legacy-miniprogram'].includes(f)) continue;
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
    const abs = path.resolve(path.dirname(p), rp) + '.js';
    ok(fs.existsSync(abs), 'require ' + rp + ' in ' + path.relative(ROOT, p));
  }
});

// 3. 场景注册完备（game.js 中 11 个场景 + app 中 TABS 四个）
const gameJs = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
['home', 'heroes', 'summon', 'journey', 'heroDetail', 'formation', 'tower', 'arena', 'forge', 'shop', 'battle']
  .forEach(s => ok(new RegExp("register\\('" + s + "'").test(gameJs), 'scene registered: ' + s));

// 4. 屏幕对象必需的方法
['home', 'heroes', 'summon', 'journey', 'heroDetail', 'formation', 'tower', 'arena', 'forge', 'shop', 'battle'].forEach(s => {
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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
