import { Color } from 'cc';
import { CocosUi, hexColor as tone } from '../ui/CocosUi';
import { ScreenContext } from './ScreenContext';
import * as store from '../domain/store';
import * as stages from '../domain/stages';
import * as items from '../domain/items';
import * as config from '../domain/config';
import * as fmt from '../domain/fmt';
import * as progression from '../domain/progression';
import { firstTimeOverlay } from './TutorialOverlay';
import { AutoSummary } from '../services/AutoBattleSession';

const GOLD=tone('#e3ba70'), PAPER=tone('#f0dfbd'), DIM=tone('#a69776');
const BG=tone('#1d120b'), CARD=tone('#2a1a18'), BLUE=tone('#4d91bd');
const PURPLE=tone('#a678c5'), GREEN=tone('#7fbd94'), RED=tone('#bb614c');

function fighterPosition(side: string, slot: number): [number, number] {
  const frontX=[-215,0,215], backX=[-114,114];
  // A 侧后排上移到 -405，给底部自动出征面板/按钮行让位（原 -467 会被面板盖住血条与名字）
  return slot<3 ? [frontX[slot],side==='A'?-208:245]
    : [backX[slot-3],side==='A'?-405:480];
}

function battleTitle(ctx: ScreenContext) {
  if(ctx.battleMode==='campaign') {
    const stage=stages.makeStageEnemies(ctx.battleIndex);
    return `第 ${ctx.battleIndex} 关 · ${stage.name}`;
  }
  if(ctx.battleMode==='expedition')return '远征 · 第 '+ctx.battleIndex+' 层';
  if(ctx.battleMode==='hall')return '名人堂挑战';
  return ({tower:'群英塔',training:'连续练兵',arena:'演武场'} as Record<string,string>)[ctx.battleMode] || '战斗';
}

function returnPage(ctx: ScreenContext) {
  return ctx.battleMode==='arena'?'arena':ctx.battleMode==='tower'?'tower':ctx.battleMode==='expedition'||ctx.battleMode==='hall'?'journey':'campaign';
}

function drawFighter(U: CocosUi, unit: any, index: number) {
  const [x,y]=fighterPosition(unit.side,unit.slot ?? index%5);
  const rim=unit.side==='A'?([GOLD,BLUE,PURPLE,GOLD,BLUE][unit.slot%5]):([PURPLE,BLUE,RED,PURPLE,BLUE][unit.slot%5]);
  U.panel(`Fighter${index}`,x,y,90,91,CARD,13,rim);
  U.text(`FighterGlyph${index}`,unit.name.slice(0,1),x,y+2,76,53,PAPER);
  if(unit.cc)U.text(`FighterCC${index}`,'✦',x+46,y+48,25,18,GOLD);
  U.progress(`HP${index}`,x,y-58,105,unit.hp/unit.maxHp,unit.side==='A'?GREEN:RED);
  U.progress(`Energy${index}`,x,y-69,105,(unit.energy||0)/100,GOLD);
  U.text(`FighterName${index}`,unit.name,x,y-88,116,17,unit.side==='A'?GOLD:DIM);
}

function battleTimerInfo(ctx: ScreenContext): { text: string; urgent: boolean } {
  const dur=ctx.fighting?.result()?.duration||ctx.outcome?.duration||0;
  const left=Math.max(0,config.BATTLE.TIME_LIMIT-Math.floor(dur));
  const ot=config.BATTLE.OVERTIME;
  const raging=!!(ot&&dur>ot.start);
  return { text:`⌛ ${left}s${raging?' · 狂暴':''}`, urgent:left<15||raging };
}

function drawField(U: CocosUi, ctx: ScreenContext, snapshot: any[]) {
  U.rect('BattleBackdrop',0,0,720,1280,BG);
  U.text('BattleTitle',battleTitle(ctx),-82,592,520,27,GOLD);
  const timer=battleTimerInfo(ctx);
  U.text('BattleTimer',timer.text,292,592,150,23,timer.urgent?RED:DIM);
  U.scene('BattleCenterLine',g=>{
    g.strokeColor=tone('#795b34');g.lineWidth=2;
    g.moveTo(-330,8);g.lineTo(330,8);g.stroke();
  });
  U.panel('BattleVsBg',0,8,108,34,BG,4);
  U.text('BattleVs','对 阵',0,8,92,18,DIM);
  U.text('BattleLegend','绿条 生命 · 金条 怒气 · 卡边颜色=品质',-140,560,360,15,tone('#7c6a4e'));
  // 实时输出对比条（研讨会十 D1）：底部细条按双方累计输出占比
  {
    const tt=((ctx.fighting as any).sideTotals?((ctx.fighting as any).sideTotals()):null);
    if(tt&&(tt.a>0||tt.b>0)){
      const total=Math.max(1,tt.a+tt.b);
      const wA=Math.max(0.06,tt.a/total), wB=1-wA;
      U.rect('DmgBarBkg',0,-455,600,10,new Color(20,14,10,200));
      U.rect('DmgBarA',-300+300*wA,-455,600*wA,10,new Color(120,180,130,220));
      U.rect('DmgBarB',-300+600*wA+300*wB,-455,600*wB,10,new Color(190,90,80,220));
      U.text('DmgBarTxt',`我军输出 ${fmt.fmtNum(tt.a)} · 敌军 ${fmt.fmtNum(tt.b)}`,0,-437,600,14,tone('#b8a888'));
    }
  }
  snapshot.forEach((unit,index)=>drawFighter(U,unit,index));
  // 伤害数字弹窗
  var popDisp = (ctx as any).combatPopupDisplay || [];
  for (var pi = 0; pi < popDisp.length; pi++) {
    var pp = popDisp[pi];
    var age = Date.now() - pp.bornAt;
    var speed = store.getState().settings && store.getState().settings.autoBattleSpeed || 1;
    var alpha = Math.max(0, 1 - age / (800 / speed));
    var offsetY = -100 - (age / 800) * 60;
    var col = pp.crit ? new Color(255, 120, 40, Math.round(255 * alpha)) : new Color(255, 255, 200, Math.round(255 * alpha));
    var fontSize = pp.crit ? 32 : 24;
    U.text('DmgNum' + pi, pp.text, pp.x, pp.y + offsetY, 120, fontSize, col);
  }
  // 大招释放名称弹窗
  var lu = (ctx.fighting as any) && (ctx.fighting as any).lastUlt;
  if (lu) {
    // 大招横幅 1.2s 淡出（研讨会八修复：无超时挂 30 秒+）+ B 侧坐标修正
    var age = Date.now() - (lu.wallTime || 0);
    if (age < 1200) {
      var castSide = lu.uid && lu.uid.charAt(0) === 'A' ? 'A' : 'B';
      var casterUnit = snapshot.find(function(u){return u.uid===lu.uid;});
      if (casterUnit) {
        var px = casterUnit.slot < 3 ? [-215,0,215][casterUnit.slot] : [-114,114][casterUnit.slot-3];
        var py = (castSide==='A' ? -208 : 245) - 80;
        var alpha = age < 900 ? 230 : Math.floor(230 * (1200 - age) / 300);
        U.panel('UltPopup',px,py,260,42,new Color(46,26,12,alpha),6,GOLD);
        U.text('UltPopupTxt',lu.name,px,py,250,20,GOLD);
      }
    }
  }
}

export function battleView(ctx: ScreenContext) {
  const U=ctx.ui;
  if(!ctx.fighting)return;
  drawField(U,ctx,ctx.fighting.snapshot());
  if(ctx.auto){
    U.panel('AutoStatus',0,-580,678,116,tone('#281b13'),10,GOLD);
    U.text('AutoStatusTitle',ctx.autoStopPending?'本场结束后停止':'自动出征进行中',0,-542,620,23,GOLD);
    U.text('AutoStatusDetail',`第 ${ctx.battleIndex} 关 · 战斗中`,0,-573,615,17,DIM);
    U.button('AutoSpeed',`×${store.getState().settings.autoBattleSpeed||1}`,-240,-606,118,38,()=>changeSpeed(ctx),tone('#443024'));
    U.button('AutoStopAfter','本场后停止',-39,-606,246,38,()=>ctx.stopAuto(true),tone('#443024'));
    U.button('AutoStop','立即停止',238,-606,170,38,()=>ctx.stopAuto(false),tone('#443024'));
  }else{
    U.button('Retreat','撤退',-245,-594,132,58,()=>ctx.go(returnPage(ctx)),tone('#443024'));
    U.button('Speed',`加速 ×${store.getState().settings.autoBattleSpeed||1}`,-45,-594,190,58,()=>changeSpeed(ctx),tone('#443024'));
    U.button('Skip','跳过战斗',219,-594,208,58,()=>ctx.skipBattle(),tone('#b78b43'));
  }
}

function changeSpeed(ctx: ScreenContext) {
  const speed=store.getState().settings.autoBattleSpeed||1;
  store.setAutoBattleSpeed(speed===1?2:speed===2?4:1);
  ctx.show('battle');
}

export function refreshBattleView(ctx: ScreenContext) {
  if(!ctx.fighting)return;
  ctx.fighting.snapshot().forEach((unit: any,i: number)=>{
    const [x,y]=fighterPosition(unit.side,unit.slot ?? i%5);
    ctx.ui.updateProgress(`HP${i}`,x,y-58,105,unit.hp/unit.maxHp);
    ctx.ui.updateProgress(`Energy${i}`,x,y-69,105,(unit.energy||0)/100);
    ctx.ui.setText(`FighterName${i}`,unit.alive?unit.name:`${unit.name} · 阵亡`);
  });
  ctx.ui.setText('BattleTimer',battleTimerInfo(ctx).text);
}

// 败北诊断：取终局快照里存活敌方的最高血量占比，给一条可执行提示（我方被团灭时同样带血量信息）
function defeatDiag(ctx: ScreenContext, r: any, brief=false): string {
  const foes=(ctx.lastBattleSnapshot||[]).filter((u:any)=>u.side==='B'&&u.alive)
    .sort((a:any,b:any)=>(b.hp/b.maxHp)-(a.hp/a.maxHp));
  const top=foes[0];
  const topPct=top?Math.round(top.hp/top.maxHp*100):null;
  const timedOut=(r?.duration||0)>=config.BATTLE.TIME_LIMIT;
  if(topPct===null)return brief?'我方全灭 · 敌阵完好':'我方全灭 · 尝试克制阵营或升级军械';
  if(brief)return `${top.name} 仍剩 ${topPct}% 血`;
  if(topPct<=15)return `${top.name}只剩 ${topPct}% 血 · 再强化一轮即可过关`;
  if(timedOut)return `${top.name}仍剩 ${topPct}% 血 · 输出不足，试试克制阵营（魏→蜀→吴→群→魏）或升级军械`;
  return `我方被击败 · ${top.name}仍剩 ${topPct}% 血 · 试试克制阵营或调整布阵`;
}

export function resultView(ctx: ScreenContext) {
  const r=ctx.outcome,U=ctx.ui;
  drawField(U,ctx,ctx.lastBattleSnapshot||[]);
  U.rect('ResultDim',0,0,720,1280,new Color(0,0,0,185));
  U.panel('ResultPanel',0,-12,572,512,tone('#271b13'),16,GOLD);
  U.text('ResultTitle',(r&&r.replay?'【回放】':'')+(r?.win?'凯  旋':'败  北'),0,174,514,56,r?.win?GOLD:DIM);
  const reward=r?.reward||{};
  // 处方单提前计算（败北行是否用 brief 诊断取决于处方是否激活）
  let rx:any=null;
  if(!ctx.auto&&ctx.battleMode==='campaign'&&r&&!r.win&&!r.replay&&config.DEFEAT_RX.enabled){
    const enemyFactions=(stages.makeStageEnemies(ctx.battleIndex).units||[]).map((u:any)=>u.hero&&u.hero.faction);
    rx=progression.buildDefeatPrescriptions(store.getState(),{
      questList:store.questList,idlePending:store.idlePending,bountyInfo:store.bountyInfo,summonPityInfo:store.summonPityInfo,borrowInfo:store.borrowInfo
    },{duration:r.duration||0,snapshot:ctx.lastBattleSnapshot||[],enemyFactions});
  }
  let diagBrief=!!rx;
  let lines: string[]=[];
  if(r&&r.replay) lines=[`复盘 · ${r.replayName||'对局回放'}`,`用时 ${Math.round((r.duration||0)*10)/10} 秒`];
  else if(!r?.ok) lines=[r?.msg||'结算失败'];
  else if(ctx.battleMode==='arena'){
    const fmtBonus=(b:any)=>b?Object.keys(b).map((k:string)=>({gold:'铜钱',gem:'元宝',token:'演武令',seals:'印信'} as any)[k]?`${({gold:'铜钱',gem:'元宝',token:'演武令',seals:'印信'} as any)[k]}+${fmt.fmtNum((b as any)[k])}`:'').filter(Boolean).join('·'):'';
    lines=r?.win?[`演武积分 ${reward.delta>=0?'+':''}${reward.delta||0} · 演武令 +${reward.tokens||0}`,
      ...(reward.weekRankUp?[`周段位奖 ${reward.weekRankUp.name}：${fmtBonus(reward.weekRankUp)}`]:[]),
      ...(reward.rankUp?[`首达 ${reward.rankUp.name}！元宝 +${reward.rankUp.gem} · 精铁 +${reward.rankUp.iron}`]:[])]
    :[defeatDiag(ctx,r),`演武积分 ${reward.delta||0} · 演武令 +${reward.tokens||0}`];
  }
  else if(ctx.battleMode==='tower') lines=r?.win?[`元宝 +${reward.gem||0} · 精铁 +${reward.iron||0} · 招募令 +${reward.scroll||0}`,`武将碎片 +${reward.shard||0}`]:[defeatDiag(ctx,r)];
  else if(ctx.battleMode==='hall'){
    const hr=reward.hallReward||{};
    if(!r?.win) lines=[defeatDiag(ctx,r),'名人堂挑战不限次数'];
    else {
      const parts:string[]=[];
      if(hr.firstKill)parts.push('首杀荣耀 +'+(hr.firstKillHonor||0));
      if(hr.firstThreeStar)parts.push('三星评价 +'+(hr.threeStarHonor||0)+' 荣耀 · 碎片 +'+(hr.shard||0));
      if(hr.weeklyClear)parts.push('周全胜！演武令 +'+hr.token);
      lines=[parts.join(' · ')||'挑战成功（重复挑战不发奖）','名人堂荣耀 '+((store as any).hallInfo().honor)];
      if(hr.title)lines.push('获得称号：'+hr.title);
    }
  }
  else if(ctx.battleMode==='training') lines=[`练兵经验 +${r.gainedXP||0}`];
  else if(ctx.battleMode==='weekboss'){
    const wbr=reward||{};
    lines=[`对魔王输出：${fmt.fmtNum(wbr.damage||0)}（占血量 ${((wbr.pct||0)*100).toFixed(1)}%）`,
      wbr.improved?`刷新本周纪录！`:`本周最高 ${(store.weekBossInfo().bestPct*100).toFixed(1)}%`,
      `档位奖：${Object.entries(wbr.reward||{}).map(([k,n]:any)=>({seals:'印信',token:'演武令'} as any)[k]?`${({seals:'印信',token:'演武令'} as any)[k]}×${n}`:'').filter(Boolean).join(' · ')||'—'}`];
  }
  else if(ctx.battleMode==='dungeon'){
    const dr=reward||{};
    lines=r?.win?(dr.kind==='gold'?[`屯金第 ${dr.floor} 层通关 · 铜钱 +${fmt.fmtNum(dr.gold||0)}`]:[`屯兵第 ${dr.floor} 层通关 · 主公经验 +${dr.xpDirect||0}${r.levelAfter>r.levelBefore?` · 升至 Lv.${r.levelAfter}`:''}`]):[defeatDiag(ctx,r),'军屯不计入主线进度 · 明日再来'];
  }
  else if(r?.win){
    if(reward.first){
      lines=[`元宝 +${reward.gem||0} · 铜钱 +${fmt.fmtNum(reward.gold||0)}${reward.scroll?` · 招募令 +${reward.scroll}`:''}`,
        `首通经验 +${r.gainedXP||0}`];
    } else lines=[`铜钱 +${fmt.fmtNum(reward.gold||0)} · 经验 +${r.gainedXP||0}`,'重复挑战不重复发放首通奖励'];
  }
  else lines=['普通奖励需凯旋后方可领取',defeatDiag(ctx,r,diagBrief)];
  lines.slice(0,3).forEach((line,i)=>U.text(`ResultLine${i}`,line,0,99-i*40,515,22,PAPER));
  // 名将首通特写（战报中心 P3）：击败每章第 10 关名将的一次性文案，回放态不显示
  if(r?.win&&!r.replay&&ctx.battleMode==='campaign'&&reward.first&&stages.makeStageEnemies(ctx.battleIndex).isBoss){
    const bossName=stages.makeStageEnemies(ctx.battleIndex).units[0]?.hero?.name||'名将';
    const FLAVOR=[`${bossName}阵前授首 · 此关首破，威名入册`,`一战破${bossName} · 鼓角暂歇，前路已开`,`阵斩${bossName} · 首功记于麾下，三军喝彩`,`${bossName}授首 · 千军让道，此捷入青史`,`攻陷${bossName}大纛 · 关隘既克，声震此方`];
    U.text('ResultGlory',FLAVOR[ctx.battleIndex%FLAVOR.length],0,130,514,18,GOLD);
  }
  const msLabels=(reward.milestones||[]).map((m:any)=>m.label);
  if(r?.win&&reward.finale)U.text('ResultFinale','第一期主线完成 · 主线 120/120',0,14,500,24,GOLD);
  else if(r?.win&&msLabels.length){
    U.text('ResultMilestone',`里程碑：${msLabels.join('；')} ›`,0,14,515,19,GOLD);
    U.tap('ResultMilestoneTap',0,14,515,30,()=>ctx.go(reward.milestones.some((m:any)=>m.kind==='armoryBox')?'armory':'bag'));
  }
  if(r?.win&&reward.first){
    const dropName=reward.armory&&!reward.armory.duplicate
      ?(items.CATALOG.find((x:any)=>x.id===reward.armory.itemId)?.name||'随机军械'):null;
    U.text('ResultDrop',dropName?`掉落军械：${dropName}`
      :reward.armory&&reward.armory.duplicate?(reward.armory.iron?`重复军械折算精铁 +${reward.armory.iron}`:'重复军械已入熔炉库存（可熔回/合成）')
      :'随机军械：本次未掉落（65% 概率）',0,-24,515,18,DIM);
  }
  if(r?.win&&reward.armoryBox)U.text('ResultBox',`${['','R','SR','SSR'][reward.armoryBox]||''}军械自选箱 ×1 · 待选择`,0,-58,480,19,GOLD);
  const starText=ctx.battleMode==='campaign'&&r?.win?`评星 ${'★'.repeat(Math.max(1,Math.min(3,r.stars||1)))} · `:'';
  U.text('ResultDuration',`${starText}用时 ${Math.round((r?.duration||0)*10)/10} 秒`,0,-96,470,19,DIM);
  // DPS 结算榜（研讨会八方案 5）：数据已就绪，复用 settled.stats 按输出排序 TOP3
  if(r?.stats&&r.win){
    const dps=Object.entries(r.stats as Record<string,{dmg:number}>)
      .filter(([uid])=>uid.charAt(0)==='A')
      .sort((a,b)=>b[1].dmg-a[1].dmg).slice(0,3);
    if(dps.length&&dps[0][1].dmg>0){
      const names=(ctx.lastBattleSnapshot||[]).filter((u:any)=>u.side==='A');
      const dpsText=dps.map(([uid,st])=>{
        const u=names.find((n:any)=>n.uid===uid);
        return (u?u.name:uid)+' '+fmt.fmtNum(st.dmg);
      }).join(' · ');
      U.text('ResultDPS','输出前三：'+dpsText,0,-66,540,16,DIM);
    }
  }
  if(r&&r.replay){
    U.button('ResultCloseReplay','关闭回放',0,-165,478,59,()=>ctx.go('hall'),tone('#3a2b20'));
  } else {
    U.button('ResultShare','分享',-139,-228,232,53,()=>{const st2=stages.makeStageEnemies(ctx.battleIndex);ctx.shareResult('我在挂机定三国打到第'+ctx.battleIndex+'关·'+(st2.name||'')+'！');},tone('#5a7a4c'));
  U.button('ResultBack','返回',-139,-165,232,59,()=>ctx.go(returnPage(ctx)),tone('#3a2b20'));
    U.button('ResultRetry','再战',139,-165,232,59,()=>ctx.battleMode==='arena'?ctx.startArenaBattle(ctx.battleDiff,ctx.battleArenaSeed):ctx.startBattle(ctx.battleMode,ctx.battleIndex,ctx.battleDiff),tone('#3a2b20'));
  }
  if(!ctx.auto){
    if(ctx.battleMode==='campaign'&&!r?.win){
      // 卡关处方单（研讨会二 P1）：归因 + 按资源可完成度生成的处方按钮（rx 已在行文案前计算）
      if(rx){
        firstTimeOverlay(ctx,'rx');
        U.text('ResultHint',rx.attribution.text,0,-116,540,16,DIM);
        (rx.items as any[]).forEach((p:any,i:number)=>{
          U.button(i===0?'ResultGrowth':'ResultNext',p.text,-139+i*278,-228,232,53,()=>ctx.go(p.page as any),tone('#4c6e57'));
        });
      } else {
        const pity=store.summonPityInfo();
        U.text('ResultHint',`卡关提示：SSR 保底 ${pity.sinceSsr}/${pity.ssrHard} 抽 · 换克制阵营或升级军械后再战`,0,-116,540,16,DIM);
        U.button('ResultGrowth','推荐布阵',-139,-228,232,53,()=>ctx.go('formation'),tone('#4c6e57'));
        U.button('ResultNext','升级军械',139,-228,232,53,()=>ctx.go('armory'),tone('#4c6e57'));
      }
    } else {
      if(r?.win)U.text('ResultDoneText','已 凯 旋',-139,-228,232,30,DIM);
      else U.button('ResultGrowth','查看武将',-139,-228,232,53,()=>ctx.go('heroes'),tone('#4c6e57'));
      if(!r?.win&&ctx.battleMode==='arena'){
        // 演武败北：'再战'已可重打，不再重复渲染'重新挑战'
        U.text('ResultArenaTip','调整布阵或升级军械后再来切磋',139,-228,232,20,DIM);
      } else {
        U.button('ResultNext',r?.win&&['campaign','tower'].includes(ctx.battleMode)?'挑战下一关':r?.win?'返回玩法':'重新挑战',139,-228,232,53,()=>{
          if(r?.win&&ctx.battleMode==='campaign')ctx.startBattle('campaign',ctx.battleIndex+1);
          else if(r?.win&&ctx.battleMode==='tower')ctx.startBattle('tower',ctx.battleIndex+1);
          else if(r?.win)ctx.go(returnPage(ctx));
          else if(ctx.battleMode==='arena')ctx.startArenaBattle(ctx.battleDiff,ctx.battleArenaSeed);
          else ctx.startBattle(ctx.battleMode,ctx.battleIndex,ctx.battleDiff);
        },tone('#b78b43'));
      }
    }
  }else U.text('NextAuto','自动出征 · 即将继续',0,-218,500,22,GOLD);
}

export function autoSummary(ctx: ScreenContext, summary: AutoSummary) {
  const reason: Record<string,string>={
    'manual-stop':'已手动停止','stopped-after-battle':'本场结束后停止',
    'recovery-exhausted':'暂时受阻，收获材料后再战','training-loss':'练兵失败',
    'training-win-limit':'练兵次数已满','training-level-target':'达到本轮练兵目标',
    'level-max':'主公等级已满','replaced-by-battle':'已切换手动挑战'
  };
  const U=ctx.ui;
  U.rect('SummaryBackdrop',0,0,720,1280,BG);
  U.text('SummaryTitle','自动出征已停止',0,510,640,38,GOLD);
  U.text('SummaryReason',reason[summary.reason]||summary.reason||'本轮已结束',0,460,625,21,DIM);
  U.panel('SummaryPanel',0,31,648,725,tone('#291d15'),13,GOLD);
  U.text('SummaryStage',`关卡 ${summary.startStage} → ${summary.endStage}`,0,310,597,31,GOLD);
  U.text('SummaryBattles',`战斗 ${summary.battles} 场 · 胜 ${summary.wins} · 败 ${summary.losses}`,0,245,597,25,PAPER);
  U.text('SummaryTime',`用时 ${Math.floor(summary.elapsedSeconds/60)}分${summary.elapsedSeconds%60}秒`,0,189,597,21,DIM);
  U.panel('SummaryRewards',0,40,577,188,tone('#1f2e25'),9,tone('#8a7650'));
  U.text('SummaryRewardTitle','本轮收获',0,103,530,24,GOLD);
  U.text('SummaryGold',`铜钱 +${fmt.fmtNum(summary.gold)} · 元宝 +${summary.gem} · 招募令 +${summary.scroll}`,0,49,530,19,PAPER);
  U.text('SummaryXP',`经验 +${summary.xp} · 精铁 +${summary.iron}`,0,4,530,19,PAPER);
  U.text('SummaryLevel',`主公 Lv.${summary.startLevel} → Lv.${summary.endLevel}`,0,-113,550,21,DIM);
  U.text('SummaryRecent',summary.recent.join(' · '),0,-169,550,18,DIM);
  // 处方同源（处方单批次）：自动受阻时给「可立即完成」处方按钮
  if(summary.reason==='recovery-exhausted'){
    const enemyFactions=(stages.makeStageEnemies(ctx.battleIndex).units||[]).map((u:any)=>u.hero&&u.hero.faction);
    const rx=progression.buildDefeatPrescriptions(store.getState(),{
      questList:store.questList,idlePending:store.idlePending,bountyInfo:store.bountyInfo,summonPityInfo:store.summonPityInfo,borrowInfo:store.borrowInfo
    },{duration:0,snapshot:ctx.lastBattleSnapshot||[],enemyFactions});
    if(rx&&(rx.items as any[]).length){
      U.text('SummaryRxTitle','受阻处方 · 照做后再战',0,-224,550,18,GOLD);
      (rx.items as any[]).slice(0,2).forEach((p:any,i:number)=>{
        U.button('SummaryRx'+i,p.text,0,-276-i*56,560,48,()=>ctx.go(p.page as any),tone('#4c6e57'));
      });
    }
  }
  U.button('SummaryBack','返回战役',0,-405,430,78,()=>ctx.go('campaign'),tone('#b78b43'));
}
