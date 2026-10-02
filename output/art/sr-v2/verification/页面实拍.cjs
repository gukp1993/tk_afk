// 使用独立无头浏览器与合成存档，不读写用户设备存档。
const {chromium}=require('/Users/gukepeng/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs=require('fs'),path=require('path');
const out=__dirname, root=path.resolve(out,'../../../..');
const jobs=['ssr','sr'].flatMap(q=>JSON.parse(fs.readFileSync(path.join(root,'output/art',q+'-v2/生成任务.json'),'utf8')).jobs);
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});
 const p=await b.newPage({viewport:{width:720,height:1280}});
 const errors=[]; p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8139/'); await p.waitForFunction(()=>typeof globalThis.__tkNav==='function');
 await p.waitForTimeout(2000);
 const synthetic=await p.evaluate(({ids,keys})=>{
  const s=JSON.parse(localStorage.getItem('sanguo_afk_save_v1'));
  for(const id of ids)s.roster[id]={id,star:1,cards:0,lockedCards:false};
  s.formation=['caoren','machao','huangyueying','guojia','huatuo'];
  s.tutorial={seen:Object.fromEntries(keys.map(k=>[k,1]))};
  return s;
 },{ids:jobs.map(x=>x.id),keys:Object.keys(require(path.join(root,'utils/config')).TUTORIALS)});
 // reload触发旧页面EVENT_HIDE保存；在新文档初始化注入，避免被旧内存档覆盖。
 await p.addInitScript(s=>localStorage.setItem('sanguo_afk_save_v1',JSON.stringify(s)),synthetic);
 await p.reload(); await p.waitForFunction(()=>typeof globalThis.__tkNav==='function');
 await p.waitForTimeout(3000);
 const loaded=await p.evaluate(async ids=>{
  const cc=await System.import('cc');
  const find=n=>n.getComponent('CocosBootstrap')||n.children.map(find).find(Boolean);
  const ctl=find(cc.director.getScene()); globalThis.__portraitTestCtl=ctl;
  const frames=[]; cc.assetManager.assets.forEach(a=>{if(a instanceof cc.SpriteFrame&&ids.includes(a.name))frames.push(a.name);});
  return {loaded:[...new Set(frames)].sort(),controller:!!ctl};
 },jobs.map(x=>x.id));
 if(!loaded.controller||loaded.loaded.length!==40)throw Error('未完整载入40名武将：'+JSON.stringify(loaded));
 const checks=[];
 for(const page of ['heroes','formation','formationPick','shop','codex','summon']){
  await p.evaluate(page=>globalThis.__portraitTestCtl.show(page),page); await p.waitForTimeout(200);
  await p.screenshot({path:path.join(out,page+'.png')});
 }
 for(const id of ['guanyu','huangyueying','machao','huatuo']){
  await p.evaluate(id=>{const c=globalThis.__portraitTestCtl;c.selectedHeroId=id;c.heroDetailOrigin='heroes';c.show('heroDetail');},id);
  if(await p.evaluate(()=>globalThis.__tkDiag().page)!=='heroDetail')throw Error('详情未显示：'+id);
  await p.waitForTimeout(150);await p.screenshot({path:path.join(out,'detail-'+id+'.png')});
 }
 await p.evaluate(()=>{const c=globalThis.__portraitTestCtl;c.lastSummon=[{id:'guojia',isNew:true,starsGained:0},{id:'huanggai',isNew:true,starsGained:0}];c.show('summonResults');});
 await p.waitForTimeout(150);await p.screenshot({path:path.join(out,'summonResults.png')});
 const sizes=await p.evaluate(async()=>{
  const cc=await System.import('cc'),c=globalThis.__portraitTestCtl,result=[];
  const walk=n=>{if(n.name.endsWith('Pic')){const sp=n.getComponent(cc.Sprite),t=n.getComponent(cc.UITransform),s=sp.spriteFrame.getOriginalSize();result.push({node:n.name,w:t.width,h:t.height,ratio:t.width/t.height,original:[s.width,s.height]});}n.children.forEach(walk);};
  walk(cc.director.getScene());return result;
 });
 if(!sizes.length||sizes.some(x=>Math.abs(x.ratio-.75)>.01||x.w>250||x.h>350))throw Error('立绘尺寸失效：'+JSON.stringify(sizes));
 fs.writeFileSync(path.join(out,'页面核验.json'),JSON.stringify({loaded,errors,sizes},null,2));
 if(errors.length)throw Error(errors.join('\n'));
 console.log('40/40立绘已载入，详情/编队/商店/图鉴/召唤实拍完成，尺寸与pageerror检查通过');
 await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
