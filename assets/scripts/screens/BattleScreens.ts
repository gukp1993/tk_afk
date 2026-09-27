import { palette, hexColor as tone } from '../ui/CocosUi';
import { ScreenContext } from './ScreenContext';
import * as store from '../domain/store';
import * as fmt from '../domain/fmt';
import { AutoSummary } from '../services/AutoBattleSession';

const GOLD=tone('#e3ba70'),PAPER=tone('#f0dfbd'),DIM=tone('#a69776');
function fighterPosition(side:string,index:number):[number,number] {
  const front:[number,number][]=[[-185,0],[0,0],[185,0]];
  const back:[number,number][]=[[-94,0],[94,0]];
  const slot=index<3?front[index]:back[index-3];
  return [slot[0],(side==='A'?-210:303)+(index<3?0:(side==='A'?148:-148))];
}

export function battleView(ctx: ScreenContext) {
    const U=ctx.ui,mode:Record<string,string>={campaign:'战役',tower:'群英塔',training:'练兵',arena:'演武场'};
    U.rect('BattleBackdrop',0,0,720,1280,tone('#20160e'));
    U.text('BattleTitle',`${mode[ctx.battleMode]||'战斗'} · 第 ${ctx.battleIndex} 关`,-99,565,500,36,GOLD);
    U.text('BattleHint','敌军',0,424,200,22,DIM);
    U.scene('BattleGround',g=>{
      g.strokeColor=tone('#503b25');g.lineWidth=3;
      g.moveTo(-355,40);g.lineTo(355,40);g.stroke();
      g.moveTo(-355,-320);g.lineTo(355,-320);g.stroke();
    });
    if(!ctx.fighting)return;
    ctx.fighting.snapshot().forEach((u: any,i: number)=>{
      const [x,y]=fighterPosition(u.side,i%5),accent=u.side==='A'?tone('#e1aa58'):tone('#8c6a9a');
      U.panel('Fighter'+i,x,y,122,118,tone('#30241c'),15,accent);
      U.text('FighterGlyph'+i,u.name[0]||'将',x,y+2,101,61,PAPER);
      U.progress('HP'+i,x,y-77,121,u.hp/u.maxHp,tone('#d96f4d'));
      U.text('FighterName'+i,`${u.name}${u.alive?'':' · 阵亡'}`,x,y-106,148,18,DIM);
    });
    U.panel('SpeedPanel',-179,-431,250,68,tone('#3c2c1c'),9,GOLD);
    U.text('SpeedText',`倍速 ×${store.getState().settings.autoBattleSpeed||1}`,-179,-431,234,22,GOLD);
    U.tap('SpeedTap',-179,-431,250,68,()=>{
      const speed=store.getState().settings.autoBattleSpeed||1;store.setAutoBattleSpeed(speed===1?2:speed===2?4:1);ctx.show('battle');
    });
    U.panel('BackBattle',179,-431,250,68,tone('#3c2c1c'),9,GOLD);
    U.text('BackBattleText',ctx.auto?(ctx.autoStopPending?'已预约停止':'本场后停止'):'退出战斗',179,-431,235,22,GOLD);
    U.tap('BackBattleTap',179,-431,250,68,()=>ctx.auto?ctx.stopAuto(true):ctx.go(ctx.battleMode==='campaign'?'campaign':'journey'));
    U.panel('SkipBattle',0,-522,344,64,tone('#c99a4a'),9,GOLD);
    U.text('SkipBattleText','跳过战斗',0,-522,325,25,tone('#342215'));
    U.tap('SkipBattleTap',0,-522,344,64,()=>ctx.skipBattle());
  }

export function refreshBattleView(ctx: ScreenContext) {
    if (!ctx.fighting) return;
    ctx.fighting.snapshot().forEach((unit: any,i: number)=>{
      const [x,y]=fighterPosition(unit.side,i%5);
      ctx.ui.setText('FighterName'+i,`${unit.name}${unit.alive?'':' · 阵亡'}`);
      ctx.ui.updateProgress('HP'+i,x,y-77,121,unit.hp/unit.maxHp);
    });
}

export function resultView(ctx: ScreenContext) {
    const r=ctx.outcome,U=ctx.ui;
    U.rect('ResultBackdrop',0,0,720,1280,tone('#20160e'));
    U.text('ResultTitle',r?.win?'战斗胜利':'战斗失败',0,522,610,42,GOLD);
    U.text('ResultExperience',r?.ok?`经验 +${r.gainedXP||0}`:(r?.msg||'结算失败'),0,471,540,22,DIM);
    U.panel('Result',0,28,666,715,r?.win?tone('#334a3a'):tone('#50302a'),16,GOLD);
    U.scene('ResultEmblem',g=>{
      g.strokeColor=GOLD;g.lineWidth=4;g.circle(0,239,107);g.stroke();
      g.circle(0,239,93);g.stroke();
    });
    U.text('Victory',r?.win?'凯旋':'整备后再战',0,239,590,60,GOLD);
    const reward = r?.reward || {};
    let rewardText = '调整编队与军械后重试';
    if (ctx.battleMode === 'arena') rewardText = `演武积分 ${reward.delta>=0?'+':''}${reward.delta||0} · 演武令 +${reward.tokens||0}`;
    else if (r?.win && ctx.battleMode === 'tower') rewardText = `元宝 +${reward.gem||0} · 招募令 +${reward.scroll||0} · 碎片 +${reward.shard||0}`;
    else if (r?.win && ctx.battleMode === 'training') rewardText = `练兵经验 +${r.gainedXP||0}`;
    else if (r?.win) rewardText = `铜钱 +${fmt.fmtNum(reward.gold||0)} · 元宝 +${(reward.gem||0)+(reward.chest?.gem||0)} · 招募令 +${(reward.scroll||0)+(reward.chest?.scroll||0)}`;
    U.text('RewardHeading',r?.win?'本场收获':'战斗建议',0,67,590,25,GOLD);
    U.panel('RewardPanel',0,-16,600,112,tone('#28382e'),8,tone('#8c784f'));
    U.text('Reward',rewardText,0,3,575,22,PAPER);
    if (r?.win && reward.armoryBox) U.text('ExtraReward',`获得军械自选箱 ×1`,0,-41,550,20,GOLD);
    U.text('Duration',`战斗用时 ${r?.duration || 0} 秒`,0,-133,580,19,DIM);
    U.panel('Continue',-166,-295,284,80,tone('#3c2c1c'),9,GOLD);
    U.text('ContinueText',ctx.battleMode==='campaign'?'返回战役':'返回玩法',-166,-295,270,24,PAPER);
    U.tap('ContinueTap',-166,-295,284,80,()=>ctx.go(ctx.battleMode==='campaign'?'campaign':'journey'));
    if(!ctx.auto){
      U.panel('ResultNext',166,-295,284,80,tone('#c99a4a'),9,GOLD);
      U.text('ResultNextText',r?.win&&['campaign','tower'].includes(ctx.battleMode)?'挑战下一关':r?.win?'返回玩法':'再战一次',166,-295,270,23,tone('#342215'));
      U.tap('ResultNextTap',166,-295,284,80,()=>{
      if(r?.win&&ctx.battleMode==='campaign')ctx.startBattle('campaign',ctx.battleIndex+1);
      else if(r?.win&&ctx.battleMode==='tower')ctx.startBattle('tower',ctx.battleIndex+1);
      else if(r?.win)ctx.go('journey');
      else ctx.startBattle(ctx.battleMode,ctx.battleIndex,ctx.battleDiff);
      });
    }
    if(!r?.win&&!ctx.auto){
      U.panel('GrowthHelp',0,-412,386,64,tone('#406b55'),8,GOLD);
      U.text('GrowthHelpText','查看共享军械',0,-412,363,20,PAPER);
      U.tap('GrowthHelpTap',0,-412,386,64,()=>ctx.go('armory'));
    }
    if(ctx.auto)U.text('NextAuto','自动出征：按当前规则继续',0,-411,600,21,GOLD);
  }

export function autoSummary(ctx: ScreenContext, summary: AutoSummary) {
  const reasons: Record<string,string> = {
    'manual-stop':'已手动停止', 'stopped-after-battle':'本场结束后停止',
    'recovery-exhausted':'暂时受阻，收获材料后再战',
    'training-loss':'练兵失败', 'training-win-limit':'练兵次数已满',
    'training-level-target':'达到本轮练兵目标', 'level-max':'主公等级已满',
    'replaced-by-battle':'已切换手动挑战'
  };
  ctx.title('自动出征结算', reasons[summary.reason] || summary.reason || '本轮已停止');
  ctx.ui.rect('AutoSummaryPanel',0,20,645,710,palette.green);
  ctx.ui.text('AutoRecord',`战斗 ${summary.battles} 场 · 胜 ${summary.wins} · 败 ${summary.losses}`,0,260,610,31,palette.gold);
  ctx.ui.text('AutoStage',`主线推进 ${summary.stages} 关 · 下一关 ${summary.endStage}`,0,171,600,23);
  ctx.ui.text('AutoLevel',`主公 Lv.${summary.startLevel} → Lv.${summary.endLevel} · 经验 +${summary.xp}`,0,95,610,23);
  ctx.ui.text('AutoGain',`铜 +${fmt.fmtNum(summary.gold)}  元宝 +${summary.gem}  招募令 +${summary.scroll}`,0,20,610,22);
  ctx.ui.text('AutoDuration',`本轮用时 ${summary.elapsedSeconds} 秒`,0,-64,600,21);
  ctx.ui.text('AutoRecent',summary.recent.join(' · '),0,-152,605,18);
  ctx.ui.button('AutoSummaryBack','返回战役',0,-410,430,86,()=>ctx.go('campaign'),palette.gold);
}
