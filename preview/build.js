// 生成预览用 CSS：把项目 WXSS 里的 rpx 转为 px（1rpx = 0.5px @375px 宽）
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = __dirname;

function conv(css) {
  return css
    .replace(/(-?\d+(?:\.\d+)?)rpx/g, (_, n) => (parseFloat(n) * 0.5) + 'px')
    .replace(/env\(safe-area-inset-bottom\)/g, '0px')
    .replace(/env\(safe-area-inset-top\)/g, '0px');
}

const parts = [];
parts.push(fs.readFileSync(path.join(ROOT, 'app.wxss'), 'utf8'));
try { parts.push(fs.readFileSync(path.join(ROOT, 'custom-tab-bar/index.wxss'), 'utf8')); } catch (e) {}
try { parts.push(fs.readFileSync(path.join(ROOT, 'components/hero-card/index.wxss'), 'utf8')); } catch (e) {}
try { parts.push(fs.readFileSync(path.join(ROOT, 'components/battle-view/index.wxss'), 'utf8')); } catch (e) {}
const cssAll = conv(parts.join('\n\n'))
  .replace(/^page\s*\{/m, ':root, page {')  // 保留变量
  ;
fs.writeFileSync(path.join(OUT, 'assets.css'), cssAll);

// 页面级样式
const pageCss = ['index', 'heroes', 'hero-detail', 'formation', 'summon', 'journey', 'tower', 'arena', 'forge', 'shop', 'battle']
  .map(p => {
    const f = path.join(ROOT, 'pages', p, p + '.wxss');
    if (!fs.existsSync(f)) return '';
    return conv(fs.readFileSync(f, 'utf8'));
  }).join('\n\n');
fs.writeFileSync(path.join(OUT, 'pages.css'), pageCss);

// 打包 utils 为浏览器可运行 engine.js
const utilOrder = ['config', 'fmt', 'rng', 'heroes', 'stages', 'items', 'battle', 'store'];
const mods = utilOrder.map(name => {
  let code = fs.readFileSync(path.join(ROOT, 'utils', name + '.js'), 'utf8');
  code = code.replace(/require\((['"])([^'"]+)\1\)/g, (_, q, p) => "_req('" + p.replace(/^\.\/|\.\.\//g, '') + "')");
  return "_def('" + name + "', function(module, exports){\n" + code + "\n});";
});
const engine = [
  'window.__mods = {};',
  'function _def(name, fn){ const m = {exports:{}}; fn(m, m.exports); window.__mods[name] = m.exports; }',
  'function _req(name){ return window.__mods[name]; }',
  mods.join('\n\n')
].join('\n');
fs.writeFileSync(path.join(OUT, 'engine.js'), engine);
console.log('preview css + engine built');
