import * as rules from '../domain/auto-battle';
import * as config from '../domain/config';
import * as store from '../domain/store';
import * as stages from '../domain/stages';

export interface AutoSummary {
  battles: number;
  wins: number;
  losses: number;
  stages: number;
  xp: number;
  gold: number;
  gem: number;
  scroll: number;
  iron: number;
  startLevel: number;
  endLevel: number;
  startStage: number;
  endStage: number;
  elapsedSeconds: number;
  reason: string;
  recent: string[];
}

/** Reuses the V1 tested transition rules; Cocos owns execution and rendering. */
export class AutoBattleSession {
  state: any = rules.createState();
  summary: AutoSummary = this.emptySummary();
  private startedAt = 0;

  get running(): boolean {
    return ['fighting', 'resultDelay', 'suspended', 'story'].includes(this.state.status);
  }

  /** 是否正停在剧情页（自动出征剧情暂停，批次一）。 */
  get storyPaused(): boolean {
    return this.state.status === 'story';
  }

  start(mode: 'campaign'|'training'): any[] {
    this.startedAt = Date.now();
    this.summary = this.emptySummary();
    return this.dispatch({ type: 'start', mode, cleared: store.getState().campaign.cleared,
      level: store.playerLevel() });
  }

  battleStarted(ok: boolean, battleId?: string, reason?: string): any[] {
    return this.dispatch({ type: 'battleStarted', ok, battleId, reason, sessionToken: this.state.sessionToken });
  }

  settled(result: any): any[] {
    if (result.ok) {
      const reward = result.reward || {};
      this.summary.battles++;
      if (result.outcome === 'win') this.summary.wins++;
      else this.summary.losses++;
      if (result.mode === 'campaign' && result.outcome === 'win') this.summary.stages++;
      this.summary.xp += result.gainedXP || 0;
      this.summary.gold += (reward.gold || 0) + (reward.chest?.gold || 0);
      this.summary.gem += (reward.gem || 0) + (reward.chest?.gem || 0);
      this.summary.scroll += (reward.scroll || 0) + (reward.chest?.scroll || 0);
      this.summary.iron += reward.armory?.duplicate ? (reward.armory.iron || 0) : 0;
      this.summary.recent.unshift(`${result.mode === 'campaign' ? '战役' : '练兵'}${result.outcome === 'win' ? '胜' : '败'}`);
      this.summary.recent = this.summary.recent.slice(0, 8);
    }
    return this.dispatch({ type: 'settled', ok: !!result.ok, battleId: result.id,
      summary: result, sessionToken: this.state.sessionToken });
  }

  tick(dt: number): any[] {
    return this.state.status === 'resultDelay' ? this.dispatch({ type: 'tick', dt }) : [];
  }

  stopAfterBattle(): any[] { return this.dispatch({ type: 'stopAfterBattle' }); }
  stop(reason: string): any[] { return this.dispatch({ type: 'stop', reason }); }
  pause(reason: string): any[] { return this.dispatch({ type: 'pause', reason }); }
  resume(reason: string): any[] { return this.dispatch({ type: 'resume', reason }); }
  /** 剧情页看完/跳过后恢复连战（批次一 storyPause 配套事件）。 */
  storyDone(): any[] { return this.dispatch({ type: 'storyDone', sessionToken: this.state.sessionToken }); }

  private dispatch(event: any): any[] {
    // 剧情闸门的「未读」判定经 options 注入纯状态机：存档/叙事数据访问留在会话层
    const options = Object.assign({}, config.AUTO_BATTLE, {
      storyUnread: (index: number) => !store.isStorySeen(index) && !!stages.makeStageEnemies(index).story
    });
    const next = rules.transition(this.state, event, options);
    this.state = next.state;
    if (this.state.status === 'stopped') {
      this.summary.reason = this.state.reason || '已停止';
      this.summary.endLevel = store.playerLevel();
      this.summary.endStage = store.getState().campaign.cleared + 1;
      this.summary.elapsedSeconds = Math.max(0, Math.floor((Date.now() - this.startedAt) / 1000));
    }
    return next.commands;
  }

  private emptySummary(): AutoSummary {
    const level = store.playerLevel(), stage = store.getState().campaign.cleared + 1;
    return { battles: 0, wins: 0, losses: 0, stages: 0, xp: 0, gold: 0,
      gem: 0, scroll: 0, iron: 0, startLevel: level, endLevel: level,
      startStage: stage, endStage: stage, elapsedSeconds: 0, reason: '', recent: [] };
  }
}
