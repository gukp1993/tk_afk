// 程序化主城占位美术；后续可在相同绘制边界内替换正式资源。
// 只绘场景，不负责文字、按钮、命中或游戏状态。
const C = {
  grass: '#939e7c', grassLight: '#a3ad8b', grassDark: '#7e8c6c',
  road: '#cdbb91', roadEdge: '#b4aa85', stone: '#b9aa83',
  wall: '#d2c19b', side: '#a39777', roof: '#61716b', roofDark: '#475951',
  red: '#8c5c4c', timber: '#746851', dark: '#4c5041', gold: '#d9ba72'
};

function polygon(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}
function line(ctx, points, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width || 1;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.stroke();
}
function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function tree(ctx, x, y, scale) {
  polygon(ctx, [[x-12*scale,y+3*scale],[x,y-3*scale],[x+17*scale,y+3*scale],[x+2*scale,y+8*scale]], '#7d876a');
  rect(ctx, x-1.5*scale, y-13*scale, 3*scale, 16*scale, C.timber);
  polygon(ctx, [[x,y-35*scale],[x-13*scale,y-18*scale],[x-9*scale,y-9*scale],[x+7*scale,y-7*scale],[x+14*scale,y-18*scale]], '#657b60');
  polygon(ctx, [[x,y-35*scale],[x-13*scale,y-18*scale],[x-2*scale,y-16*scale],[x+6*scale,y-23*scale]], '#80906c');
}
function rock(ctx, x, y, scale) {
  polygon(ctx, [[x-8*scale,y],[x-5*scale,y-8*scale],[x+3*scale,y-11*scale],[x+9*scale,y-4*scale],[x+7*scale,y+2*scale]], '#a7aa92');
  polygon(ctx, [[x-8*scale,y],[x+1*scale,y-3*scale],[x+3*scale,y-11*scale],[x-5*scale,y-8*scale]], '#bac0a5');
}

function drawGround(ctx, x, y, w, h) {
  if (!(w > 0 && h > 0)) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 375, h / 500);
  rect(ctx, 0, 0, 375, 500, C.grass);
  // 棋格只用轻微色差，给入口和文字留出安静的背景。
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 0) rect(ctx, col * 48, row * 50, Math.min(48, 375-col*48), 50, '#97a280');
    }
  }
  polygon(ctx, [[0,0],[375,0],[375,28],[302,21],[238,32],[161,18],[79,31],[0,23]], '#7f8c72');
  polygon(ctx, [[0,500],[375,500],[375,471],[306,478],[231,467],[137,482],[53,468],[0,477]], '#8a9675');
  // 路径用平面多边形，保证微信、抖音和离屏预览一致。
  polygon(ctx, [[163,15],[196,15],[208,99],[180,176],[207,253],[186,338],[209,500],[169,500],[154,335],[174,253],[148,176],[175,96]], C.roadEdge);
  polygon(ctx, [[170,15],[190,15],[201,98],[173,176],[200,253],[179,338],[202,500],[176,500],[161,335],[181,253],[155,176],[182,96]], C.road);
  polygon(ctx, [[52,112],[189,145],[324,118],[331,135],[185,166],[49,130]], C.road);
  polygon(ctx, [[52,290],[188,257],[326,290],[323,311],[187,278],[56,310]], C.road);
  polygon(ctx, [[71,416],[170,371],[270,391],[307,422],[291,432],[262,411],[173,392],[79,434]], C.road);
  polygon(ctx, [[145,223],[190,211],[231,234],[227,278],[187,297],[143,275]], '#d3c39f');
  line(ctx, [[156,237],[189,226],[219,241]], '#bcae8c', 1);
  line(ctx, [[155,269],[188,281],[217,267]], '#bcae8c', 1);
  // 少量边缘植被，不占据建筑点击区域。
  tree(ctx, 23, 75, .85); tree(ctx, 348, 91, .9);
  tree(ctx, 19, 242, .75); tree(ctx, 354, 236, .7);
  tree(ctx, 28, 399, .75); tree(ctx, 342, 448, .9);
  rock(ctx, 39, 85, .7); rock(ctx, 336, 251, .8);
  rock(ctx, 26, 454, .9); rock(ctx, 321, 466, .55);
  for (const p of [[45,200],[327,200],[37,356],[331,358],[125,467]]) {
    line(ctx, [[p[0]-3,p[1]],[p[0]-5,p[1]-5]], C.grassDark, 1);
    line(ctx, [[p[0],p[1]],[p[0]+1,p[1]-7]], C.grassDark, 1);
    line(ctx, [[p[0]+3,p[1]],[p[0]+6,p[1]-4]], C.grassDark, 1);
  }
  ctx.restore();
}

function roof(ctx, x, y, w, h, color) {
  polygon(ctx, [[x,y+h*.8],[x+w*.15,y+h*.61],[x+w*.43,y],[x+w*.6,y],[x+w*.87,y+h*.61],[x+w,y+h*.8],[x+w*.92,y+h],[x+w*.08,y+h]], color);
  polygon(ctx, [[x,y+h*.8],[x+w*.08,y+h],[x+w*.92,y+h],[x+w,y+h*.8]], C.roofDark);
  line(ctx, [[x+w*.41,y+1],[x+w*.61,y+1]], '#d4c39d', 2);
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    line(ctx, [[x+w*(.44+.14*t),y+3],[x+w*(.14+.72*t),y+h*.78]], '#839087', .75);
  }
}
function body(ctx, x, y, w, h) {
  rect(ctx, x, y, w, h, C.wall);
  polygon(ctx, [[x+w,y],[x+w+7,y-5],[x+w+7,y+h-5],[x+w,y+h]], C.side);
  rect(ctx, x, y+h-4, w, 4, C.stone);
  rect(ctx, x+3, y, 3, h-4, C.timber);
  rect(ctx, x+w-6, y, 3, h-4, C.timber);
}
function door(ctx, x, y, w, h) {
  rect(ctx, x, y, w, h, C.timber);
  rect(ctx, x+2, y+2, w-4, h-2, C.dark);
  line(ctx, [[x+w/2,y+2],[x+w/2,y+h]], '#958264', 1);
  rect(ctx, x+w/2-2, y+h*.55, 1, 2, C.gold);
  rect(ctx, x+w/2+1, y+h*.55, 1, 2, C.gold);
}
function window(ctx, x, y) {
  rect(ctx, x, y, 9, 10, C.timber);
  rect(ctx, x+1, y+1, 7, 8, '#7b8070');
  line(ctx, [[x+4.5,y+1],[x+4.5,y+9]], '#c0b48f', 1);
  line(ctx, [[x+1,y+5],[x+8,y+5]], '#c0b48f', 1);
}

function drawBuilding(ctx, x, y, w, h, kind, opts) {
  if (!(w > 0 && h > 0)) return;
  opts = opts || {};
  const roofColor = opts.roof || (kind === 'summon' ? C.red : C.roof);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 100, h / 100);
  polygon(ctx, [[8,84],[74,75],[99,86],[85,95],[24,98],[1,90]], '#7b846c');
  polygon(ctx, [[7,79],[79,73],[94,83],[84,92],[17,93],[5,87]], opts.active ? '#d9c99a' : C.stone);
  polygon(ctx, [[5,87],[17,93],[84,92],[94,83],[94,88],[85,97],[17,98],[5,92]], '#978d70');
  if (kind === 'tower') {
    body(ctx, 31, 62, 35, 23); door(ctx, 42, 67, 14, 18);
    roof(ctx, 20, 43, 58, 22, roofColor);
    body(ctx, 36, 30, 26, 20); window(ctx, 45, 34);
    roof(ctx, 27, 13, 46, 20, roofColor);
    rect(ctx, 48, 4, 2, 11, C.timber);
    polygon(ctx, [[50,5],[66,8],[50,12]], C.red);
  } else if (kind === 'camp') {
    polygon(ctx, [[17,80],[42,38],[70,81]], '#d4c19a');
    polygon(ctx, [[42,38],[74,46],[87,80],[70,81]], '#a89b7e');
    polygon(ctx, [[34,81],[43,57],[54,81]], C.dark);
    line(ctx, [[14,84],[42,36],[73,84]], C.timber, 2);
    rect(ctx, 77, 25, 2, 53, C.timber);
    polygon(ctx, [[79,26],[96,30],[88,36],[79,36]], C.red);
    rect(ctx, 9, 64, 3, 21, C.timber); rect(ctx, 20, 69, 3, 18, C.timber);
    line(ctx, [[7,72],[24,77]], C.timber, 3);
  } else if (kind === 'market') {
    body(ctx, 18, 49, 61, 32);
    roof(ctx, 10, 22, 78, 29, roofColor);
    polygon(ctx, [[18,50],[78,50],[88,65],[11,65]], '#b58769');
    for (let i = 0; i < 4; i++) polygon(ctx, [[20+i*15,50],[27+i*15,50],[30+i*16,65],[21+i*16,65]], '#d8c391');
    rect(ctx, 14, 64, 3, 20, C.timber); rect(ctx, 83, 64, 3, 20, C.timber);
    rect(ctx, 25, 69, 46, 14, '#ab8e64');
    rect(ctx, 29, 65, 10, 7, '#c0ac76'); rect(ctx, 44, 65, 10, 7, '#85926e'); rect(ctx, 58, 65, 8, 7, '#b17a5c');
    line(ctx, [[25,75],[71,75]], '#ccba8e', 1);
  } else if (kind === 'forge') {
    body(ctx, 18, 49, 63, 35);
    rect(ctx, 69, 16, 10, 27, '#8b8774'); rect(ctx, 66, 15, 16, 5, C.stone);
    roof(ctx, 10, 24, 79, 28, roofColor);
    door(ctx, 28, 62, 19, 22); window(ctx, 61, 58);
    polygon(ctx, [[54,76],[80,76],[74,81],[62,81],[62,88],[54,88],[58,80]], '#515c55');
    rect(ctx, 51, 88, 28, 3, '#887b61');
  } else {
    body(ctx, 20, 47, 60, 37);
    door(ctx, 42, 61, 18, 23); window(ctx, 28, 59); window(ctx, 65, 59);
    roof(ctx, 7, 22, 85, 29, roofColor);
    if (kind === 'hall') {
      body(ctx, 36, 20, 29, 13);
      roof(ctx, 27, 7, 48, 18, roofColor);
    } else if (kind === 'summon') {
      rect(ctx, 11, 52, 2, 29, C.timber); rect(ctx, 88, 52, 2, 29, C.timber);
      rect(ctx, 7, 54, 10, 12, '#bb9361'); rect(ctx, 84, 54, 10, 12, '#bb9361');
      polygon(ctx, [[49,31],[54,37],[49,43],[44,37]], C.gold);
    }
  }
  rect(ctx, 36, 88, 31, 4, '#cfc09a');
  rect(ctx, 32, 92, 39, 3, '#b9aa83');
  ctx.restore();
}

module.exports = { drawGround, drawBuilding };
