// 战役首页的原创三国占位美术。仅绘制场景，命中、进度与奖励由 screen 管理。
const ROUTE = [[.40, .90], [.22, .72], [.58, .54], [.36, .34], [.65, .14]];

function poly(c, points, color) {
  c.fillStyle = color; c.beginPath(); c.moveTo(...points[0]);
  points.slice(1).forEach(p => c.lineTo(...p)); c.closePath(); c.fill();
}
function stroke(c, points, color, width) {
  c.strokeStyle = color; c.lineWidth = width;
  c.beginPath(); c.moveTo(...points[0]); points.slice(1).forEach(p => c.lineTo(...p)); c.stroke();
}
function circle(c, x, y, r, color) {
  c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
function oval(c, x, y, rx, ry, color) {
  const points = [];
  for (let i = 0; i < 28; i++) {
    const a = Math.PI * 2 * i / 28;
    points.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]);
  }
  poly(c, points, color);
}
// Catmull-Rom 插值落成 lineTo，兼容小游戏 Canvas 与离屏 SVG 记录器。
function curve(points) {
  const result = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i];
    const p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let j = 0; j < 18; j++) {
      const t = j / 18, t2 = t * t, t3 = t2 * t;
      result.push([0, 1].map(k => .5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t
        + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
        + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  result.push(points[points.length - 1]); return result;
}
function pine(c, x, y, s, light) {
  oval(c, x + 3 * s, y + 2 * s, 12 * s, 4 * s, '#78907b');
  stroke(c, [[x, y], [x, y - 22 * s]], '#536c5f', 2 * s);
  poly(c, [[x, y-40*s], [x-12*s, y-19*s], [x-6*s,y-20*s], [x-16*s,y-8*s], [x+14*s,y-8*s], [x+6*s,y-22*s], [x+11*s,y-19*s]], light ? '#668e79' : '#456f62');
  stroke(c, [[x, y-33*s], [x-3*s,y-13*s]], '#86a18a', s);
}
function mountain(c, x, y, w, h, light) {
  poly(c, [[x-w*.55,y],[x-w*.40,y-h*.27],[x-w*.21,y-h*.37],[x-w*.12,y-h*.71], [x+w*.07,y-h], [x+w*.22,y-h*.78],[x+w*.35,y-h*.30],[x+w*.53,y]], light ? '#9aac92' : '#64897b');
  poly(c, [[x-w*.55,y],[x-w*.40,y-h*.27],[x-w*.21,y-h*.37],[x-w*.12,y-h*.71],[x+w*.07,y-h],[x-w*.02,y-h*.44],[x+w*.14,y-h*.11]], light ? '#bcc3a2' : '#84a28a');
  stroke(c, [[x+w*.06,y-h*.82],[x+w*.01,y-h*.46],[x+w*.10,y-h*.33]], light ? '#8fa286' : '#4e776b', 1);
}
function roof(c, x, y, w, h, red) {
  poly(c, [[x-w*.55,y+h*.25],[x-w*.36,y+h*.38],[x-w*.15,y-h*.5],[x+w*.18,y-h*.5],[x+w*.4,y+h*.38],[x+w*.55,y+h*.25],[x+w*.47,y+h*.62],[x-w*.48,y+h*.62]], red ? '#905d48' : '#47675e');
  stroke(c, [[x-w*.55,y+h*.25],[x-w*.48,y+h*.62],[x+w*.47,y+h*.62],[x+w*.55,y+h*.25]], '#d5c295', 1.3);
  for (let i = -2; i <= 2; i++) stroke(c, [[x+i*w*.06,y-h*.35],[x+i*w*.15,y+h*.45]], red ? '#ad8060' : '#719180', .7);
}
function village(c, x, y, s) {
  c.save(); c.translate(x,y); c.scale(s,s);
  oval(c, 0, 8, 30, 9, '#8d987a');
  c.fillStyle='#c3b78e';c.fillRect(-20,-5,26,20);c.fillStyle='#827359';c.fillRect(-10,2,7,13);
  roof(c,-7,-9,35,17,false);
  c.fillStyle='#d7c8a0';c.fillRect(6,-1,19,19);c.fillStyle='#92775a';c.fillRect(12,5,6,13);
  roof(c,16,-4,27,14,true);c.restore();
}
function fortress(c, x, y, s) {
  c.save();c.translate(x,y);c.scale(s,s);
  oval(c,0,28,65,14,'#87947b');
  poly(c,[[-55,7],[43,-4],[62,8],[49,31],[-50,39]],'#b4a880');
  poly(c,[[-50,16],[46,6],[46,28],[-50,38]],'#c5b78d');
  poly(c,[[46,6],[61,9],[50,31],[46,28]],'#8b9478');
  for(let i=0;i<8;i++){c.fillStyle='#cfc198';c.fillRect(-50+i*12,9-i*1.4,7,10);}
  c.fillStyle='#d3c199';c.fillRect(-19,-11,38,39);
  poly(c,[[-9,28],[-9,9],[-5,3],[5,3],[9,9],[9,28]],'#455b4d');
  stroke(c,[[-7,27],[-7,10],[-3,6],[3,6],[7,10],[7,27]],'#988360',1);
  c.fillStyle='#ae8562';c.fillRect(-16,-22,32,15);
  roof(c,0,-23,59,21,false);
  c.fillStyle='#c6b387';c.fillRect(-10,-37,20,12);
  roof(c,0,-41,38,14,false);
  stroke(c,[[0,-47],[0,-64]],'#6d7158',1.5);
  poly(c,[[1,-63],[23,-59],[16,-54],[1,-55]],'#955847');
  for(const side of [-1,1]){
    c.fillStyle='#b7aa84';c.fillRect(side*36-10,-6,20,21);
    roof(c,side*36,-10,29,15,false);
  }
  c.restore();
}

function drawMap(c, x, y, w, h) {
  if (!(w>0 && h>0)) return;
  c.save();c.translate(x,y);c.scale(w/375,h/440);
  const ground=c.createLinearGradient(0,0,0,440);
  ground.addColorStop(0,'#c2c4a1');ground.addColorStop(.55,'#adb794');ground.addColorStop(1,'#8eaa8c');
  c.fillStyle=ground;c.fillRect(0,0,375,440);
  // 山水不是背景贴图：所有轮廓和细节均为原创几何占位。
  poly(c,[[0,105],[62,87],[111,117],[160,94],[211,115],[271,82],[375,98],[375,0],[0,0]],'#b3bea0');
  mountain(c,30,113,117,134,true);mountain(c,105,54,107,104,true);
  mountain(c,318,119,130,140,true);mountain(c,373,204,117,159,false);
  poly(c,[[0,224],[54,202],[88,212],[76,251],[13,272],[0,306]],'#bac19d');
  poly(c,[[138,280],[186,251],[237,267],[279,302],[255,330],[191,323],[150,305]],'#c2bf91');
  poly(c,[[0,375],[79,351],[128,373],[133,440],[0,440]],'#a8b58e');
  const river=curve([[-24,125],[51,143],[94,186],[163,199],[274,257],[320,315],[284,375],[333,459]]);
  stroke(c,river,'#91a687',36);stroke(c,river,'#d0c89f',31);
  stroke(c,river,'#68998b',26);stroke(c,river,'#83ada0',19);
  stroke(c,curve([[0,127],[48,144],[90,185],[161,201],[237,234]]),'#b0c9ad',2);
  stroke(c,curve([[304,301],[306,334],[282,372],[299,416]]),'#b0c9ad',1.5);
  // 河上的石桥。
  poly(c,[[152,192],[161,186],[183,204],[175,211]],'#7d8e74');
  poly(c,[[151,187],[160,181],[184,201],[175,207]],'#c9c39c');
  stroke(c,[[151,184],[176,205]],'#e0d3a9',2);stroke(c,[[160,179],[185,200]],'#e0d3a9',2);
  const road=curve(ROUTE.map(p=>[p[0]*375,p[1]*440]));
  stroke(c,road,'#9b9d76',20);stroke(c,road,'#d6c994',15);stroke(c,road,'#e4d5a5',8);
  // 稀疏的路沿石让平面地图具有比例，不遮挡旗标。
  for(let i=5;i<road.length-4;i+=11){const p=road[i];oval(c,p[0]+11,p[1]+2,2.5,1.4,'#8f9b7a');}
  village(c,47,251,.88);village(c,280,169,.7);village(c,235,358,.82);
  fortress(c,227,45,.84);
  mountain(c,-4,406,79,117,false);mountain(c,355,444,80,122,false);
  [[18,169,.7],[40,174,.9],[11,201,.8],[269,119,.72],[291,129,.68],[265,323,.6],[285,330,.8],[334,220,.9],[350,241,.75],[47,403,.85],[73,423,.6],[208,433,.5]].forEach((p,i)=>pine(c,...p,i%2===0));
  // 田垄、石块与低矮草色，保持右侧快捷按钮背后安静。
  for(let i=0;i<4;i++)stroke(c,[[14+i*5,285],[48+i*5,274]],'#9caa84',1.3);
  for(const [a,b]of [[67,108],[190,115],[21,347],[242,307],[192,370],[283,211]]){
    poly(c,[[a-5,b],[a-3,b-5],[a+3,b-6],[a+6,b-1],[a+3,b+2]],'#a4ad8c');
    stroke(c,[[a-3,b-5],[a,b-2],[a+6,b-1]],'#c3c6a5',1);
  }
  c.restore();
}

function drawBanner(c, x, y, opts) {
  opts=opts||{};const state=opts.state||'locked';
  const active=state==='current', passed=state==='cleared';
  c.save();
  oval(c,x,y+2,active?21:16,active?8:5,active?'#e8d190':'#8e9b7b');
  if(active){oval(c,x,y+1,16,5,'#b7a873');oval(c,x,y+1,11,3,'#f2dda3');}
  stroke(c,[[x,y],[x,y-38]],passed?'#65745e':'#685f48',2);
  circle(c,x,y-39,2,'#deca94');
  poly(c,[[x+1,y-37],[x+28,y-33],[x+22,y-24],[x+26,y-17],[x+1,y-20]],active?'#a3533c':passed?'#507d6a':'#89967d');
  stroke(c,[[x+2,y-36],[x+26,y-33],[x+21,y-24],[x+24,y-18]],active?'#e5bb72':passed?'#a9ba92':'#b9bea0',1);
  c.fillStyle=active?'#fff0bf':'#e5e5c5';c.font='bold 11px sans-serif';c.textAlign='center';c.textBaseline='middle';
  c.fillText(passed?'✓':String(opts.label||''),x+12,y-27);
  if(active){poly(c,[[x-7,y-47],[x+1,y-42],[x+9,y-47],[x+1,y-44]],'#f7df98');}
  c.restore();
}

function drawCamp(c, x, y, w, h, heroes) {
  if(!(w>0&&h>0))return;
  heroes=(heroes||[]).filter(Boolean).slice(0,5);
  c.save();
  const ground=c.createLinearGradient(x,y,x,y+h);
  ground.addColorStop(0,'#8fa68c');ground.addColorStop(.40,'#758d74');ground.addColorStop(1,'#495e4f');
  c.fillStyle=ground;c.fillRect(x,y,w,h);
  poly(c,[[x,y+h*.55],[x+w*.3,y+h*.35],[x+w*.7,y+h*.45],[x+w,y+h*.2],[x+w,y+h],[x,y+h]],'#768769');
  stroke(c,[[x,y+h*.7],[x+w*.5,y+h*.67],[x+w,y+h*.58]],'#a5a587',2);
  // 右侧留给可领取的挂机宝箱，队伍绘制与编队命中区域保持一致。
  const troopW=Math.min(w,260), count=Math.max(heroes.length,1), spacing=Math.min(49,troopW/(count+.5));
  const first=x+(troopW-spacing*(count-1))/2, foot=y+h*.70;
  const scale=Math.min(1,h/88), colors=['#567d69','#947458','#7e5345','#667a89','#9b8052'];
  heroes.forEach((hero,i)=>{
    const px=first+i*spacing;
    c.save();c.translate(px,foot);c.scale(scale,scale);
    oval(c,0,3,15,4,'#53694f');
    // 甲衣、披风、冠盔的轮廓占位，为后续武将立绘留出相同绘制范围。
    poly(c,[[-7,-32],[-14,-7],[-9,-2],[2,-5],[11,-1],[10,-28]],colors[i%colors.length]);
    stroke(c,[[-4,-8],[-5,1],[0,2]],'#343f36',4);
    stroke(c,[[4,-8],[6,0],[11,1]],'#343f36',4);
    poly(c,[[-7,-28],[6,-28],[9,-10],[-8,-10]],'#b1a178');
    stroke(c,[[-7,-19],[7,-19]],'#665e48',2);
    stroke(c,[[-5,-23],[5,-23]],'#d1bd8e',1);
    circle(c,0,-36,6,'#c8b18a');
    poly(c,[[-7,-36],[-6,-43],[0,-46],[6,-43],[7,-36],[1,-39]],'#48584e');
    stroke(c,[[1,-45],[4,-50],[10,-49]],'#ad6850',2);
    stroke(c,[[11,-8],[14,-46]],'#d3c297',1.6);
    poly(c,[[14,-48],[12,-41],[16,-43]],'#e3dec2');
    stroke(c,[[5,-26],[11,-23],[13,-29]],'#b29f76',4);
    c.restore();
    c.fillStyle='#eee2be';c.font='10px sans-serif';c.textAlign='center';c.textBaseline='middle';
    c.fillText(hero.name||'武将',px,y+h-9);
  });
  c.restore();
}

function drawChest(c,x,y,size,opts){
  if(!(size>0))return;
  opts=opts||{};c.save();c.translate(x,y);c.scale(size/64,size/64);
  if(opts.ready){
    const glow=c.createRadialGradient(32,30,3,32,30,32);
    glow.addColorStop(0,'rgba(246,211,113,.5)');glow.addColorStop(1,'rgba(246,211,113,0)');
    c.fillStyle=glow;c.fillRect(0,0,64,64);
  }
  oval(c,33,53,28,7,'#52654d');
  poly(c,[[9,28],[45,25],[56,32],[54,50],[16,55],[9,48]],'#805b36');
  poly(c,[[9,28],[45,25],[45,48],[16,52]],'#a78044');
  poly(c,[[45,25],[56,32],[54,50],[45,48]],'#6b5034');
  poly(c,[[9,28],[12,15],[39,12],[49,18],[56,32],[45,29]],'#c7a45b');
  poly(c,[[12,15],[39,12],[45,19],[13,23]],'#d9bd75');
  stroke(c,[[10,29],[45,30],[55,34]],'#ead08a',3);
  stroke(c,[[17,16],[18,50]],'#ead08a',3);stroke(c,[[38,14],[41,49]],'#dfbf72',3);
  c.fillStyle='#5c5740';c.fillRect(28,30,9,11);c.fillStyle='#edcf81';c.fillRect(30,31,6,7);
  circle(c,33,34,1.2,'#65533b');
  if(opts.ready){
    poly(c,[[53,2],[55,8],[61,10],[55,12],[53,18],[51,12],[45,10],[51,8]],'#f3daa0');
    poly(c,[[8,5],[9,8],[12,9],[9,10],[8,13],[7,10],[4,9],[7,8]],'#f3daa0');
  }
  c.restore();
}

module.exports={drawMap,drawBanner,drawCamp,drawChest,ROUTE};
