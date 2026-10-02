// 独立无头浏览器、合成存档；阻塞分包后进入详情，放行后验证无需导航即换装。
const {chromium}=require('/Users/gukepeng/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs=require('fs'),path=require('path');
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});
 try {
 const p=await b.newPage({viewport:{width:720,height:1280}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8139/');
 await p.waitForFunction(()=>typeof __tkNav==='function');
 const s=await p.evaluate(()=>JSON.parse(localStorage.getItem('sanguo_afk_save_v1')));
 s.roster.huangyueying={id:'huangyueying',star:1,cards:0,lockedCards:false};
 const root=path.resolve(__dirname,'../../../..');
 s.tutorial={seen:Object.fromEntries(Object.keys(require(path.join(root,'utils/config')).TUTORIALS).map(k=>[k,1]))};
 await p.addInitScript(s=>localStorage.setItem('sanguo_afk_save_v1',JSON.stringify(s)),s);
 let release;const gate=new Promise(r=>release=r);let blocked=0;
 await p.route('**/assets/art-heroes/**',async route=>{blocked++;await gate;await route.continue();});
 await p.reload();await p.waitForFunction(()=>typeof __tkNav==='function');
 await p.evaluate(async()=>{
  const cc=await System.import('cc');
  const find=n=>n.getComponent('CocosBootstrap')||n.children.map(find).find(Boolean);
  const c=find(cc.director.getScene());globalThis.__delayCtl=c;
  c.selectedHeroId='huangyueying';c.heroDetailOrigin='heroes';c.show('heroDetail');
 });
 const state=()=>p.evaluate(async()=>{
  const cc=await System.import('cc'),names=[];const walk=n=>{names.push(n.name);n.children.forEach(walk);};walk(cc.director.getScene());
  return {page:__tkDiag().page,pic:names.includes('DetailPortraitPic'),placeholder:names.includes('DetailPortraitGlyph')};
 });
 await p.waitForTimeout(400);const before=await state();
 if(!blocked||before.page!=='heroDetail'||before.pic||!before.placeholder)throw Error('延迟前置条件失败 '+JSON.stringify({blocked,before}));
 release();
 let after, stable=0;
 const deadline=Date.now()+30000;
 while(Date.now()<deadline){
  await p.waitForTimeout(200);after=await state();
  stable=after.pic&&!after.placeholder?stable+1:0;
  if(stable>=3)break;
 }
 if(after.page!=='heroDetail'||!after.pic||after.placeholder||errors.length)throw Error('放行后换装失败 '+JSON.stringify({after,errors}));
 fs.writeFileSync(path.join(__dirname,'延迟加载.json'),JSON.stringify({passed:true,blockedRequests:blocked,before,after,errors},null,2));
 console.log(JSON.stringify({passed:true,blocked,before,after}));
 } finally {await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
