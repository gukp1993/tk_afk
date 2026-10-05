import { Graphics, UITransform, UIOpacity, tween, view } from 'cc';
import { CocosUi, hexColor as color } from './CocosUi';
import { ArtService } from '../services/ArtService';

type Point = [number, number];

/** The old WeChat scene art expressed in its 375px coordinate grid, drawn by native Cocos Graphics. */
class Paint {
  constructor(private g: Graphics, private top: number, private height: number, private sourceHeight: number) {}
  x(n: number) { return n * 720 / 375 - 360; }
  y(n: number) { return this.top - n * this.height / this.sourceHeight; }
  private map(points: Point[]) { return points.map(([x, y]) => [this.x(x), this.y(y)] as Point); }
  poly(points: Point[], hex: string) {
    const p = this.map(points);
    this.g.fillColor = color(hex);
    this.g.moveTo(p[0][0], p[0][1]);
    p.slice(1).forEach(v => this.g.lineTo(v[0], v[1]));
    this.g.close(); this.g.fill();
  }
  line(points: Point[], hex: string, width = 1) {
    const p = this.map(points);
    this.g.strokeColor = color(hex);
    this.g.lineWidth = width * (720 / 375 + this.height / this.sourceHeight) / 2;
    this.g.moveTo(p[0][0], p[0][1]);
    p.slice(1).forEach(v => this.g.lineTo(v[0], v[1]));
    this.g.stroke();
  }
  box(x: number, y: number, w: number, h: number, hex: string) {
    this.g.fillColor = color(hex);
    this.g.rect(this.x(x), this.y(y + h), w * 720 / 375, h * this.height / this.sourceHeight);
    this.g.fill();
  }
  oval(x: number, y: number, rx: number, ry: number, hex: string) {
    const p: Point[] = [];
    for (let i = 0; i < 20; i++) { const a = Math.PI * 2 * i / 20; p.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]); }
    this.poly(p, hex);
  }
}

function curve(points: Point[]): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let j = 0; j < 12; j++) {
      const t = j / 12, t2 = t * t, t3 = t2 * t;
      result.push([0, 1].map(k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * t +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)) as Point);
    }
  }
  result.push(points[points.length - 1]); return result;
}
function mountain(p: Paint, x: number, y: number, w: number, h: number, light: boolean) {
  p.poly([[x-w*.55,y],[x-w*.4,y-h*.27],[x-w*.21,y-h*.37],[x-w*.12,y-h*.71],[x+w*.07,y-h],[x+w*.22,y-h*.78],[x+w*.35,y-h*.3],[x+w*.53,y]], light?'#9aac92':'#64897b');
  p.poly([[x-w*.55,y],[x-w*.4,y-h*.27],[x-w*.21,y-h*.37],[x-w*.12,y-h*.71],[x+w*.07,y-h],[x-w*.02,y-h*.44],[x+w*.14,y-h*.11]], light?'#bcc3a2':'#84a28a');
}
function pine(p: Paint, x: number, y: number, s: number) {
  p.oval(x+3*s,y+2*s,12*s,4*s,'#78907b');
  p.line([[x,y],[x,y-22*s]],'#536c5f',2*s);
  p.poly([[x,y-40*s],[x-12*s,y-19*s],[x-6*s,y-20*s],[x-16*s,y-8*s],[x+14*s,y-8*s],[x+6*s,y-22*s],[x+11*s,y-19*s]],'#456f62');
}
function roof(p: Paint, x: number, y: number, w: number, h: number, red = false) {
  p.poly([[x-w*.55,y+h*.25],[x-w*.36,y+h*.38],[x-w*.15,y-h*.5],[x+w*.18,y-h*.5],[x+w*.4,y+h*.38],[x+w*.55,y+h*.25],[x+w*.47,y+h*.62],[x-w*.48,y+h*.62]], red?'#905d48':'#47675e');
  p.line([[x-w*.55,y+h*.25],[x-w*.48,y+h*.62],[x+w*.47,y+h*.62],[x+w*.55,y+h*.25]],'#d5c295',1.2);
}
function village(p: Paint, x: number, y: number, s: number) {
  p.oval(x,y+9*s,31*s,9*s,'#8d987a');
  p.box(x-20*s,y-5*s,26*s,20*s,'#c3b78e'); p.box(x-10*s,y+2*s,7*s,13*s,'#827359');
  roof(p,x-7*s,y-9*s,35*s,17*s);
  p.box(x+6*s,y-s,19*s,19*s,'#d7c8a0'); roof(p,x+16*s,y-4*s,27*s,14*s,true);
}
function fortress(p: Paint, x: number, y: number, s: number) {
  p.oval(x,y+28*s,66*s,14*s,'#87947b');
  p.poly([[x-55*s,y+7*s],[x+43*s,y-4*s],[x+62*s,y+8*s],[x+49*s,y+31*s],[x-50*s,y+39*s]],'#b4a880');
  p.poly([[x-50*s,y+16*s],[x+46*s,y+6*s],[x+46*s,y+28*s],[x-50*s,y+38*s]],'#c5b78d');
  for(let i=0;i<8;i++)p.box(x+(-50+i*12)*s,y+(9-i*1.4)*s,7*s,10*s,'#cfc198');
  p.box(x-19*s,y-11*s,38*s,39*s,'#d3c199');
  p.poly([[x-9*s,y+28*s],[x-9*s,y+9*s],[x-5*s,y+3*s],[x+5*s,y+3*s],[x+9*s,y+9*s],[x+9*s,y+28*s]],'#455b4d');
  roof(p,x,y-23*s,59*s,21*s); p.box(x-10*s,y-37*s,20*s,12*s,'#c6b387'); roof(p,x,y-41*s,38*s,14*s);
  for(const side of [-1,1]){p.box(x+(side*36-10)*s,y-6*s,20*s,21*s,'#b7aa84');roof(p,x+side*36*s,y-10*s,29*s,15*s);}
}

export const CAMPAIGN_ROUTE: Point[] = [[.40,.90],[.22,.72],[.58,.54],[.36,.34],[.65,.14]];
// 生成地图的实拍圆盘中心：与图片中的道路逐点对齐，旧几何地图仍使用原路线。
export const CAMPAIGN_ART_ROUTE: Point[] = [[270/720,545/660],[170/720,351/660],[398/720,276/660],[237/720,157/660],[415/720,94/660]];
let deferredCampaignMap = false;

export function campaignMap(ui: CocosUi, top = 420, height = 660) {
  const frame = ArtService.frame('map_campaign_v2');
  if (frame) {
    const art=ui.image('CampaignMapArt', frame, 0, top - height / 2, 720, height);
    // image 的短面板尺寸保持原高；地图属于纵向场景，须与旗点一起适配长屏。
    art.getComponent(UITransform)!.setContentSize(720,height*Math.max(1,view.getVisibleSize().height/1280));
    if (deferredCampaignMap) {
      deferredCampaignMap = false;
      const opacity = art.addComponent(UIOpacity);
      opacity.opacity = 0;
      tween(opacity).to(0.2, { opacity: 255 }).start();
    }
    return;
  }
  // 缺图或玩家主动跳过加载也不再显示旧版地图，避免晚到资源造成旧景闪换。
  deferredCampaignMap = true;
  ui.scene('CampaignMapPending', g => {
    const p = new Paint(g, top, height, 440);
    p.box(0, 0, 375, 440, '#172f29');
    for (let i = 0; i < 5; i++) {
      p.line(curve([[-20, 70+i*68], [100, 30+i*68], [235, 95+i*68], [395, 48+i*68]]), '#29483b', 2);
    }
  });
  ui.text('CampaignMapPendingText', ArtService.scenesReady ? '山河图暂未载入' : '山河图载入中…', 0, top-height+35, 420, 18, color('#b7bc9a'));

}

export function campaignFlag(ui: CocosUi, name: string, px: number, py: number, n: number, state: 'current'|'cleared'|'locked', action: () => void) {
  const x=px*720/375-360, y=420-py*660/440;
  ui.panel(name+'Marker',x,y,44,44,state==='current'?color('#aa472d'):state==='cleared'?color('#426650'):color('#5f6652'),22,state==='current'?color('#f4d485'):color('#cab687'),false);
  ui.text(name+'Number',state==='cleared'?'✓':String(n),x,y,40,24,color('#fff0bf'));
  ui.tap(name,x,y,76,76,action);
}

export function campaignCamp(ui: CocosUi) {
  const chest=ArtService.frame('idle_chest')||ArtService.frame('chest');
  ui.scene('CampaignCampArt',g=>{
    const p=new Paint(g,-241,112,88);
    p.box(0,0,375,88,'#263c31');
    if(chest)return;
    const x=310,y=18;
    p.oval(x+2,y+53,31,8,'#52654d');
    p.poly([[x-25,y+28],[x+14,y+25],[x+29,y+32],[x+27,y+50],[x-19,y+55],[x-25,y+48]],'#a78044');
    p.poly([[x-25,y+28],[x-22,y+15],[x+9,y+12],[x+23,y+18],[x+29,y+32],[x+14,y+29]],'#d9bd75');
    p.line([[x-17,y+16],[x-16,y+51]],'#ead08a',3);p.line([[x+10,y+14],[x+13,y+49]],'#dfbf72',3);
    p.box(x-3,y+30,11,11,'#5c5740');p.box(x,y+32,6,7,'#edcf81');
  });
  if(chest)ui.image('CampaignChestArt',chest,236,-292,92,82);
}

function cityBuilding(p: Paint, x: number, y: number, w: number, h: number, kind: string) {
  p.oval(x+w/2,y+h*.91,w*.45,h*.10,'#7b846c');
  p.poly([[x+w*.05,y+h*.82],[x+w*.2,y+h*.9],[x+w*.83,y+h*.9],[x+w*.95,y+h*.82],[x+w*.84,y+h*.98],[x+w*.16,y+h*.98]],'#b9aa83');
  if(kind==='camp') {
    p.poly([[x+w*.16,y+h*.83],[x+w*.42,y+h*.35],[x+w*.72,y+h*.83]],'#d4c19a');
    p.poly([[x+w*.42,y+h*.35],[x+w*.75,y+h*.46],[x+w*.87,y+h*.83],[x+w*.72,y+h*.83]],'#a89b7e');
    p.poly([[x+w*.34,y+h*.83],[x+w*.43,y+h*.59],[x+w*.55,y+h*.83]],'#4c5041');
    p.line([[x+w*.77,y+h*.75],[x+w*.77,y+h*.2]],'#746851',2);
    p.poly([[x+w*.78,y+h*.2],[x+w*.95,y+h*.25],[x+w*.78,y+h*.35]],'#8c5c4c');
    return;
  }
  p.box(x+w*.2,y+h*.47,w*.6,h*.39,'#d2c19b');
  p.box(x+w*.43,y+h*.63,w*.17,h*.23,'#4c5041');
  p.box(x+w*.28,y+h*.59,w*.1,h*.11,'#746851'); p.box(x+w*.68,y+h*.59,w*.1,h*.11,'#746851');
  const roofColor=kind==='summon'?'#8c5c4c':'#61716b';
  p.poly([[x+w*.08,y+h*.52],[x+w*.22,y+h*.43],[x+w*.43,y+h*.22],[x+w*.6,y+h*.22],[x+w*.86,y+h*.43],[x+w*.94,y+h*.52],[x+w*.88,y+h*.55],[x+w*.12,y+h*.55]],roofColor);
  p.line([[x+w*.08,y+h*.52],[x+w*.12,y+h*.55],[x+w*.88,y+h*.55],[x+w*.94,y+h*.52]],'#475951',2);
  if(kind==='tower'||kind==='hall') {
    p.box(x+w*.37,y+h*.28,w*.27,h*.18,'#c4b38f');
    p.poly([[x+w*.26,y+h*.3],[x+w*.4,y+h*.14],[x+w*.58,y+h*.14],[x+w*.75,y+h*.3],[x+w*.7,y+h*.34],[x+w*.3,y+h*.34]],'#61716b');
  }
  if(kind==='market')p.poly([[x+w*.12,y+h*.55],[x+w*.85,y+h*.55],[x+w*.91,y+h*.68],[x+w*.1,y+h*.68]],'#b58769');
}

export type CityBuilding = {name:string; hint:string; page:string; x:number; y:number; w:number; h:number; kind:string};
export const CITY_BUILDINGS: CityBuilding[] = [
  {name:'点将台',hint:'招募武将',page:'summon',x:130,y:40,w:115,h:91,kind:'summon'},
  {name:'群英殿',hint:'英雄养成',page:'heroes',x:28,y:162,w:108,h:77,kind:'hall'},
  {name:'演武场',hint:'对战切磋',page:'arena',x:240,y:157,w:106,h:82,kind:'tower'},
  {name:'铁匠铺',hint:'装备强化',page:'armory',x:30,y:284,w:103,h:71,kind:'forge'},
  {name:'集市',hint:'兑换物资',page:'shop',x:243,y:282,w:100,h:73,kind:'market'},
  {name:'军机营',hint:'调整编队',page:'formation',x:139,y:371,w:98,h:56,kind:'camp'}
];
export function cityMap(ui:CocosUi,top=440,height=790) {
  const frame = ArtService.frame('city_home_v2');
  if (frame) {
    ui.image('CityMapArt', frame, 0, 0, 720, 1280);
    return;
  }
  ui.scene('CityScenery',g=>{
    const p=new Paint(g,top,height,500);
    p.box(0,0,375,500,'#939e7c');
    p.poly([[0,0],[375,0],[375,28],[302,21],[238,32],[161,18],[79,31],[0,23]],'#7f8c72');
    p.poly([[163,15],[196,15],[208,99],[180,176],[207,253],[186,338],[209,500],[169,500],[154,335],[174,253],[148,176],[175,96]],'#b4aa85');
    p.poly([[170,15],[190,15],[201,98],[173,176],[200,253],[179,338],[202,500],[176,500],[161,335],[181,253],[155,176],[182,96]],'#cdbb91');
    p.poly([[52,112],[189,145],[324,118],[331,135],[185,166],[49,130]],'#cdbb91');
    p.poly([[52,290],[188,257],[326,290],[323,311],[187,278],[56,310]],'#cdbb91');
    p.poly([[71,416],[170,371],[270,391],[307,422],[291,432],[262,411],[173,392],[79,434]],'#cdbb91');
    p.poly([[145,223],[190,211],[231,234],[227,278],[187,297],[143,275]],'#d3c39f');
    ([[23,75],[348,91],[19,242],[354,236],[28,399],[342,448]] as Point[]).forEach(([x,y])=>pine(p,x,y,.7));
    CITY_BUILDINGS.forEach(b=>cityBuilding(p,b.x,b.y,b.w,b.h,b.kind));
  });
}
