import { palette } from '../ui/CocosUi';
import { ScreenContext } from './ScreenContext';
import * as store from '../domain/store';
import * as fmt from '../domain/fmt';
import { AutoSummary } from '../services/AutoBattleSession';

export function battleView(ctx: ScreenContext) {
    ctx.title('战斗中',`${ctx.battleMode} · ${ctx.battleIndex}`);
    if(!ctx.fighting)return;
    ctx.fighting.snapshot().forEach((u: any,i: number)=>{
      const x=u.side==='A'?-170:170,y=355-(i%5)*148;
      ctx.ui.rect('Fighter'+i,x,y,300,113,u.side==='A'?palette.green:palette.red);
      ctx.ui.text('FighterName'+i,`${u.name}  ${u.alive?Math.ceil(u.hp):'阵亡'}`,x,y+19,290,21);
      ctx.ui.progress('HP'+i,x,y-26,240,u.hp/u.maxHp);
    });
    ctx.ui.button('Speed',`倍速 ×${store.getState().settings.autoBattleSpeed||1}`,-170,-438,245,68,()=>{
      const speed=store.getState().settings.autoBattleSpeed||1;store.setAutoBattleSpeed(speed===1?2:speed===2?4:1);ctx.show('battle');
    },palette.gold,true);
    ctx.ui.button('BackBattle',ctx.auto?(ctx.autoStopPending?'已预约停止':'本场后停止'):'退出战斗',170,-438,245,68,()=>ctx.auto?ctx.stopAuto(true):ctx.go(ctx.battleMode==='campaign'?'campaign':'journey'),palette.paperDark,true);
    ctx.ui.button('SkipBattle','跳过战斗',0,-515,310,56,()=>ctx.skipBattle(),palette.gold,true);
  }

export function refreshBattleView(ctx: ScreenContext) {
    if (!ctx.fighting) return;
    ctx.fighting.snapshot().forEach((unit: any,i: number)=>{
      const x=unit.side==='A'?-170:170,y=355-(i%5)*148;
      ctx.ui.setText('FighterName'+i,`${unit.name}  ${unit.alive?Math.ceil(unit.hp):'阵亡'}`);
      ctx.ui.updateProgress('HP'+i,x,y-26,240,unit.hp/unit.maxHp);
    });
}

export function resultView(ctx: ScreenContext) {
    const r=ctx.outcome; ctx.title(r?.win?'战斗胜利':'战斗失败',r?.ok?`经验 +${r.gainedXP||0}`:(r?.msg||'结算失败'));
    ctx.ui.rect('Result',0,40,650,710,r?.win?palette.green:palette.red);
    ctx.ui.text('Victory',r?.win?'凯旋':'整备后再战',0,185,575,80,palette.gold);
    const reward = r?.reward || {};
    let rewardText = '调整编队与军械后重试';
    if (ctx.battleMode === 'arena') rewardText = `演武积分 ${reward.delta>=0?'+':''}${reward.delta||0} · 演武令 +${reward.tokens||0}`;
    else if (r?.win && ctx.battleMode === 'tower') rewardText = `元宝 +${reward.gem||0} · 招募令 +${reward.scroll||0} · 碎片 +${reward.shard||0}`;
    else if (r?.win && ctx.battleMode === 'training') rewardText = `练兵经验 +${r.gainedXP||0}`;
    else if (r?.win) rewardText = `铜钱 +${fmt.fmtNum(reward.gold||0)} · 元宝 +${(reward.gem||0)+(reward.chest?.gem||0)} · 招募令 +${(reward.scroll||0)+(reward.chest?.scroll||0)}`;
    ctx.ui.text('Reward',rewardText,0,25,620,26);
    if (r?.win && reward.armoryBox) ctx.ui.text('ExtraReward',`获得军械自选箱 ×1`,0,-23,600,22,palette.gold);
    ctx.ui.text('Duration',`战斗用时 ${r?.duration || 0} 秒`,0,-74,580,21,palette.paper);
    ctx.ui.button('Continue',ctx.battleMode==='campaign'?'返回战役':'返回玩法',-164,-290,284,82,
      ()=>ctx.go(ctx.battleMode==='campaign'?'campaign':'journey'),palette.paperDark);
    if(!ctx.auto)ctx.ui.button('ResultNext',r?.win&&['campaign','tower'].includes(ctx.battleMode)?'挑战下一关':r?.win?'返回玩法':'再战一次',164,-290,284,82,()=>{
      if(r?.win&&ctx.battleMode==='campaign')ctx.startBattle('campaign',ctx.battleIndex+1);
      else if(r?.win&&ctx.battleMode==='tower')ctx.startBattle('tower',ctx.battleIndex+1);
      else if(r?.win)ctx.go('journey');
      else ctx.startBattle(ctx.battleMode,ctx.battleIndex,ctx.battleDiff);
    },palette.gold);
    if(!r?.win&&!ctx.auto)ctx.ui.button('GrowthHelp','查看共享军械',0,-405,385,69,()=>ctx.go('armory'),palette.green);
    if(ctx.auto)ctx.ui.text('NextAuto','自动出征：按当前规则继续',0,-400,600,23);
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
