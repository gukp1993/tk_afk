// 将共享 CommonJS 源码嵌入本地交互预览；所有存档仅在本页内存中。
// node preview/mini/play.js → out/play.html，无第三方依赖。
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const modules = [];
function collect(dir) {
  for (const name of fs.readdirSync(path.join(root, dir))) {
    const rel = dir + '/' + name;
    if (fs.statSync(path.join(root, rel)).isDirectory()) collect(rel);
    else if (name.endsWith('.js')) modules.push(JSON.stringify(rel) + ':function(require,module,exports){\n' + fs.readFileSync(path.join(root, rel), 'utf8') + '\n}');
  }
}
collect('src'); collect('utils');
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>挂机定三国 · 可交互预览</title>
<style>*{box-sizing:border-box}body{margin:0;background:#100c08;display:flex;justify-content:center}canvas{display:block;width:375px;max-width:100vw;touch-action:none}</style>
<canvas id="game" aria-label="挂机定三国游戏预览"></canvas><script>
const factories={${modules.join(',\n')}};
const cache={};
function load(id){ if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;factories[id](p=>{const a=id.split('/');a.pop();p.split('/').forEach(s=>{if(s==='..')a.pop();else if(s!=='.')a.push(s)});return load(a.join('/')+'.js')},m,m.exports);return m.exports;}
const query=new URLSearchParams(location.search), H=Number(query.get('height'))||812;
if(query.has('capture'))document.body.style.justifyContent='flex-start';
const canvas=document.getElementById('game'), callbacks={}, memory={};
canvas.style.height='auto';canvas.style.aspectRatio='375 / '+H;
window.wx={createCanvas:()=>canvas,getWindowInfo:()=>({screenWidth:375,screenHeight:H,pixelRatio:2}),
onTouchStart:f=>callbacks.start=f,onTouchMove:f=>callbacks.move=f,onTouchEnd:f=>callbacks.end=f,onTouchCancel:f=>callbacks.cancel=f,onHide:()=>{},
getStorageSync:k=>memory[k],setStorageSync:(k,v)=>memory[k]=JSON.parse(JSON.stringify(v)),removeStorageSync:k=>delete memory[k]};
function event(e){const r=canvas.getBoundingClientRect(),p={clientX:(e.clientX-r.left)*375/r.width,clientY:(e.clientY-r.top)*H/r.height};return {touches:[p],changedTouches:[p]};}
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);callbacks.start(event(e));});
canvas.addEventListener('pointermove',e=>{if(e.buttons)callbacks.move(event(e));});
canvas.addEventListener('pointerup',e=>callbacks.end(event(e)));
canvas.addEventListener('pointercancel',()=>callbacks.cancel&&callbacks.cancel());
const {app,ui}=load('src/scenes.js'),store=load('utils/store.js');app.init();
// 演示数据仅在显式 demo 参数下使用，不接触设备存档。
if(query.has('demo')){const s=store.getState();s.res.gold=500000;s.res.exp=500000;s.res.scroll=88;s.res.gem=18888;s.campaign.cleared=19;['zhaoyun','zhugeliang','zhouyu','lvbu','huatuo','guojia','huangzhong','sunshangxiang','daqiao','zhangjiao','zhenji','taishici'].forEach(id=>store.addHeroCard(id));for(let i=0;i<16;i++)store.addEquip(i%4+1,['weapon','armor','helm','boots'][i%4]);}
const page=query.get('page')||'home';app.switchTab(app.TABS.some(t=>t.key===page)?page:'home');
if(page==='bag'&&query.has('equips'))app.scenes.bag.section='equips';
if(page==='quests')app.scenes.home.showQuests=true;
if(page==='idle')app.scenes.home.showIdle=true;
if(page==='result'){app.switchTab('summon');app.scenes.summon.pull('scroll10');app.scenes.summon.revealCount=10;app.scenes.summon.busy=false;}
if(['forge','formation','tower','arena','shop'].includes(page))app.push(page);
if(page==='detail')app.push('heroDetail',{id:'guanyu'});
if(['story','battle','victory'].includes(page)){app.push('battle',{mode:'campaign'});if(page!=='story'){while(app.top().storyOpen)app.top().advanceStory();if(page==='victory')for(let i=0;i<1500;i++)app.top().update(0.1);}}
if(page==='formation-picker'){app.push('formation');app.top().pickSlot=0;}
if(page==='forge-enhance'){app.push('forge');const id=store.equipInventory()[0].id;app.top().openFodder(id);}
if(page==='ad-mock'||page==='ad-mock-done'){const ads=load('src/ads.js');ads.showRewarded('idle2x',()=>{});if(page==='ad-mock-done')ads.state.mock.t=ads.state.mock.dur;}
// 暴露只用于本地检查；不会进入平台打包目录。
window.preview={app,ui,store};
</script></html>`;
const out = path.join(__dirname, 'out/play.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html.replace(/<\/script(?=\s|>)/gi, '<\\/script').replace('<\\/script></html>', '</script></html>'));
console.log(out);
