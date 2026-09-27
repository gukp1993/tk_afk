import { _decorator, Component, game, Game, Node, profiler, ResolutionPolicy, view } from 'cc';
import { CocosUi, hexColor, palette } from './ui/CocosUi';
import * as store from './domain/store';
import * as stages from './domain/stages';
import * as config from './domain/config';
import * as battleRules from './domain/battle';
import * as fmt from './domain/fmt';
import * as rewarded from './services/RewardedService';
import { AutoBattleSession } from './services/AutoBattleSession';
import * as campaignScreens from './screens/CampaignScreens';
import * as heroScreens from './screens/HeroScreens';
import * as battleScreens from './screens/BattleScreens';
import { Page, ScreenContext } from './screens/ScreenContext';

const { ccclass } = _decorator;

/** Native Cocos scene controller. Rules and save migrations come from the tested shared domain. */
@ccclass('CocosBootstrap')
export class CocosBootstrap extends Component implements ScreenContext {
  public page: Page = 'campaign';
  private content!: Node;
  public ui!: CocosUi;
  public notice = '';
  public pageIndex = 0;
  public selectedHeroId = 'liubei';
  public heroDetailOrigin: Page = 'heroes';
  public selectedArmorySlot = 'weapon';
  public selectedFormationSlot = 0;
  public formationPageIndex = 0;
  public selectedBoxQ = 1;
  public fighting: any = null;
  public battleId = '';
  public battleMode = 'campaign';
  public battleIndex = 1;
  public battleDiff = 1;
  public battleArenaSeed = 0;
  private refreshTime = 0;
  public outcome: any = null;
  public lastBattleSnapshot: any[] = [];
  public storyStage = 1;
  public auto = false;
  public autoStopPending = false;
  private autoSession!: AutoBattleSession;
  private adPlacement = '';
  private adSeconds = 0;
  private adReturn: Page = 'home';
  private adReward: (() => void) | null = null;
  public lastSummon: any[] = [];
  private navigation: Page[] = [];

  onLoad() {
    view.setDesignResolutionSize(720, 1280, ResolutionPolicy.FIXED_WIDTH);
    profiler.hideStats();
    store.load();
    store.checkDailyReset();
    this.autoSession = new AutoBattleSession();
    const pending = store.getState().battle.pending;
    if (pending) store.interruptBattle(pending.id, 'cocos-restart');
    this.content = new Node('GameContent');
    this.node.addChild(this.content);
    game.on(Game.EVENT_HIDE, this.onHide, this);
    game.on(Game.EVENT_SHOW, this.onShow, this);
    this.show('campaign');
  }
  onDestroy() {
    game.off(Game.EVENT_HIDE, this.onHide, this);
    game.off(Game.EVENT_SHOW, this.onShow, this);
    store.save();
  }
  private onHide() { if(this.auto) this.autoAction(this.autoSession.pause('background')); store.save(); }
  private onShow() { if(this.auto) this.autoAction(this.autoSession.resume('background')); store.idlePending(); this.show(this.page); }

  update(dt: number) {
    if (this.page === 'ad' && this.adPlacement && this.adSeconds > 0) {
      const before = Math.ceil(this.adSeconds);
      this.adSeconds = Math.max(0, this.adSeconds - dt);
      if (Math.ceil(this.adSeconds) !== before) this.show('ad');
    }
    if (this.fighting && this.autoSession.state.status !== 'suspended') {
      const speed = store.getState().settings.autoBattleSpeed || 1;
      const step = this.fighting.step(Math.min(0.1, dt) * speed);
      this.refreshTime += dt;
      if (step.done) this.finishBattle(step.winner === 'A');
      else if (this.page === 'battle' && this.refreshTime > 0.3) {
        this.refreshTime = 0;
        battleScreens.refreshBattleView(this);
      }
    } else if (this.auto) this.autoAction(this.autoSession.tick(dt));
  }

  public show(page: Page) {
    this.page = page;
    for (const child of this.content.children.slice()) child.destroy();
    const verticalScale=Math.max(1,view.getVisibleSize().height/1280);
    const U = this.ui = new CocosUi(this.content,verticalScale), s = store.getState();
    U.rect('Backdrop', 0, 0, 720, 1280, hexColor('#171009'));
    if (page === 'journey' || page === 'shop') {
      const resources: [string, number][] = [['铜钱',s.res.gold],['元宝',s.res.gem],['招募令',s.res.scroll],['演武令',s.res.token],['碎片',s.res.shard]];
      const y=page==='journey'?590:513;
      resources.forEach(([label,value],i)=>{
        const x=-278+i*139;
        U.panel('ResourcePill'+i,x,y,130,39,palette.ink,19,palette.gold);
        U.text('ResourceText'+i,`${label} ${fmt.fmtNum(value)}`,x,y,119,16,palette.gold);
      });
    }
    const render: Record<Page, () => void> = {
      campaign: () => campaignScreens.campaign(this), stagePreview: () => campaignScreens.stagePreview(this), home: () => campaignScreens.home(this), journey: () => campaignScreens.journey(this),
      heroes: () => heroScreens.heroes(this), heroDetail: () => heroScreens.heroDetail(this), summon: () => heroScreens.summon(this), summonResults: () => heroScreens.summonResults(this), bag: () => campaignScreens.bag(this),
      armory: () => heroScreens.armory(this), armoryCatalog: () => heroScreens.armoryCatalog(this), armoryBox: () => heroScreens.armoryBox(this), shop: () => campaignScreens.shop(this), formation: () => campaignScreens.formation(this), formationPick: () => campaignScreens.formationPick(this), quests: () => campaignScreens.quests(this),
      tower: () => campaignScreens.tower(this), arena: () => campaignScreens.arena(this), story: () => campaignScreens.storyView(this),
      battle: () => battleScreens.battleView(this), result: () => battleScreens.resultView(this), autoSummary: () => battleScreens.autoSummary(this, this.autoSession.summary), ad: () => this.adView()
    };
    render[page]();
    if (this.notice) U.text('Notice', this.notice, 0, -510, 670, 20, palette.gold);
    if(['home','journey','campaign','heroes','bag','summon'].includes(page)) {
      U.rect('NavBackground', 0, -594, 720, 92, palette.ink);
      const nav: [Page,string,string][] = [['home','城','主城'],['journey','图','玩法'],['campaign','战','战役'],['heroes','将','英雄'],['bag','囊','背包']];
      nav.forEach(([p,glyph,label], i) => {
        const x=-288+144*i, active=p===page || (p==='campaign'&&page==='stagePreview');
        if(active) U.panel('NavActive'+p,x,-591,135,84,palette.paperDark,8,palette.gold);
        U.text('NavGlyph'+p,glyph,x,-577,120,34,active?palette.ink:palette.gold);
        U.text('NavLabel'+p,label,x,-613,120,16,active?palette.ink:palette.muted);
        U.tap('Nav'+p,x,-594,138,90,()=>this.go(p));
      });
    }
  }
  public go(page: Page) {
    if (this.page==='battle' && page!=='battle' && this.fighting && !this.auto) {
      const stopped=store.interruptBattle(this.battleId,'navigate-away');
      if (!stopped.ok) { this.notice=stopped.msg; this.show('battle'); return; }
      this.fighting=null;
      this.battleId='';
    }
    this.notice = '';
    if (page !== this.page) {
      if (['home','journey','campaign','heroes','bag'].includes(page)) this.navigation = [];
      else if (this.navigation[this.navigation.length-1] === page) this.navigation.pop();
      else this.navigation.push(this.page);
    }
    this.show(page);
  }
  public back(fallback: Page = 'campaign') { this.go(this.navigation[this.navigation.length-1] || fallback); }
  public tell(result: any, good: string) { this.notice = result?.ok ? good : (result?.msg || '操作失败'); this.show(this.page); }
  public confirm(title: string, detail: string, act: () => void) {
    const U = this.ui;
    const mask = U.rect('ConfirmMask', 0, 0, 720, 1280, palette.ink);
    mask.on(Node.EventType.TOUCH_END, () => {});
    U.rect('ConfirmPanel', 0, 0, 625, 385, palette.paper);
    U.text('ConfirmTitle', title, 0, 120, 575, 34, palette.ink);
    U.text('ConfirmDetail', detail, 0, 24, 555, 23, palette.ink);
    U.button('ConfirmCancel', '再想想', -150, -112, 240, 72, () => this.show(this.page), palette.green);
    U.button('ConfirmDo', '确认', 150, -112, 240, 72, act, palette.red);
  }
  public playAd(placement: string, reward: () => void) {
    if (rewarded.remaining(placement) <= 0) return this.tell({ok:false,msg:'今日该奖励次数已用完'},'');
    if (rewarded.configured()) {
      rewarded.showConfigured(placement).then(done => {
        if (done) reward();
        else this.tell({ok:false,msg:'未看完广告，无奖励'},'');
      }).catch(() => this.tell({ok:false,msg:'广告暂不可用，稍后重试'},''));
      return;
    }
    this.adReturn = this.page;
    this.adPlacement = placement;
    this.adSeconds = 3;
    this.adReward = reward;
    this.go('ad');
  }
  public idleClaimChoice() {
    const U=this.ui, idle=store.idlePending();
    U.rect('IdleChoiceMask',0,0,720,1280,palette.ink).on(Node.EventType.TOUCH_END,()=>{});
    U.rect('IdleChoicePanel',0,0,630,405,palette.paper);
    U.text('IdleChoiceTitle','领取挂机收益',0,130,565,34,palette.ink);
    U.text('IdleChoiceAmount',`可领铜钱 ${fmt.fmtNum(idle.gold)} · 精铁 ${idle.iron}`,0,48,565,24,palette.ink);
    U.button('IdleNormal','普通领取',-155,-65,255,81,()=>{
      const r=store.claimIdle(false);this.tell(r,`获得铜钱 ${fmt.fmtNum(r.gold)}、精铁 ${r.iron}`);
    },palette.green);
    U.button('IdleAd','双倍 · 看广告',155,-65,255,81,()=>this.playAd('idle2x',()=>{
      const r=store.claimIdle(true);this.tell(r,`双倍领取铜钱 ${fmt.fmtNum(r.gold)}`);
    }),palette.gold);
    U.button('IdleCancel','稍后再领',0,-151,250,56,()=>this.show('campaign'),palette.paperDark);
  }
  private adView() {
    const conf = config.AD.placements[this.adPlacement];
    this.title('模拟广告 · 测试模式', conf?.name || '激励视频');
    this.ui.rect('AdPanel',0,60,640,725,palette.green);
    this.ui.text('AdIcon','▣',0,170,200,105,palette.gold);
    this.ui.text('AdTimer',this.adSeconds>0?`播放中… ${Math.ceil(this.adSeconds)} 秒`:'播放完成',0,5,520,33);
    this.ui.text('AdHint','提前关闭不发奖励',0,-90,510,22,palette.paper);
    this.ui.button('AdClose','关闭',-158,-335,280,87,()=>{this.adPlacement='';this.adReward=null;this.go(this.adReturn);},palette.paperDark);
    if(this.adSeconds<=0)this.ui.button('AdClaim','领取奖励',158,-335,280,87,()=>{
      const callback=this.adReward, target=this.adReturn, placement=this.adPlacement;
      this.adPlacement='';this.adReward=null;
      store.adBump(placement);store.save();this.go(target);callback?.();
    },palette.gold);
  }
  public title(text: string, sub = '') {
    this.ui.text('Title', text, 0, 609, 650, 35, palette.gold);
    if (sub) this.ui.text('Subtitle', sub, 0, 563, 650, 19, palette.muted);
  }
  public row(name: string, text: string, y: number, action?: () => void, actionText = '查看') {
    this.ui.panel(name, 0, y, 652, 91, palette.green, 9, palette.gold);
    this.ui.text(name+'Text', text, action ? -78 : 0, y, action ? 440 : 620, 21);
    if (action) this.ui.button(name+'Action', actionText, 255, y, 108, 65, action, palette.paperDark);
  }
  public summonDraw(type: string) { heroScreens.summonDraw(this, type); }

  public skipBattle() {
    if (!this.fighting) return;
    for (let i=0; i<1000; i++) {
      const result=this.fighting.step(0.1);
      if (result.done) { this.finishBattle(result.winner === 'A'); return; }
    }
    this.tell({ok:false,msg:'战斗仍在进行，请稍后再试'},'');
  }
  private finishBattle(win: boolean) {
    const duration=this.fighting?.result()?.duration || 0;
    this.lastBattleSnapshot=this.fighting?.snapshot() || [];
    const settled=store.settleBattle(this.battleId,{win});
    this.outcome={...settled,win,duration};
    this.fighting=null;
    this.show('result');
    if(this.auto)this.autoAction(this.autoSession.settled(settled));
  }

  public startAuto(mode: 'campaign'|'training') {
    if (this.fighting || this.auto) return this.tell({ok:false,msg:'已有战斗进行中'},'');
    this.autoAction(this.autoSession.start(mode));
  }
  public stopAuto(afterBattle = true) {
    this.autoAction(afterBattle ? this.autoSession.stopAfterBattle() : this.autoSession.stop('manual-stop'));
    this.show(this.page);
  }
  private autoAction(commands: any[]) {
    this.auto = this.autoSession.running;
    this.autoStopPending = !!this.autoSession.state.stopAfterBattle;
    for (const command of commands) {
      if (command.type === 'startBattle') this.startBattle(command.mode, command.index || 0, 1, true);
      if (command.type === 'interruptBattle') {
        const stopped = store.interruptBattle(command.battleId, 'auto-stopped');
        if (stopped.ok) { this.fighting = null; this.battleId = ''; }
      }
      if (command.type === 'stopped') { this.auto = false; this.show('autoSummary'); }
    }
  }

  public startArenaBattle(diff: number, seed: number) { this.startBattle('arena',0,diff,false,seed); }

  public startBattle(mode: string,index: number,diff=1,fromAuto=false,arenaSeed=0) {
    if(this.fighting)return this.tell({ok:false,msg:'已有战斗进行中'},'');
    if(this.auto && !fromAuto) return this.confirm('自动出征进行中','结束当前自动会话后再开始手动挑战？',()=>{
      this.autoAction(this.autoSession.stop('replaced-by-battle'));
      this.startBattle(mode,index,diff);
    });
    if(mode==='campaign'&&!fromAuto&&!store.isStorySeen(index)&&stages.makeStageEnemies(index).story){
      this.storyStage=index;this.go('story');return;
    }
    if(mode==='campaign'&&fromAuto&&!store.isStorySeen(index)){store.markStorySeen(index);store.save();}
    const effectiveArenaSeed=arenaSeed||Date.now();
    const enemy=mode==='campaign'?stages.makeStageEnemies(index):mode==='tower'?stages.makeTowerEnemies(index):mode==='training'?stages.makePracticeEnemies(store.playerLevel(),Date.now()):stages.makeArenaEnemies(store.teamPower(),effectiveArenaSeed,diff);
    const started=store.beginBattle({mode,index,diff,referenceLevel:enemy.units[0]?.level||store.playerLevel()});
    if(!started.ok){
      if(fromAuto) this.autoAction(this.autoSession.battleStarted(false,undefined,started.msg));
      return this.tell(started,'');
    }
    this.battleId=started.id;this.battleMode=mode;this.battleIndex=index;this.battleDiff=diff;this.battleArenaSeed=mode==='arena'?effectiveArenaSeed:0;
    this.fighting=battleRules.createBattle({team:store.playerUnits(),enemy:store.enemyUnits(enemy.units),seed:Date.now()});
    this.lastBattleSnapshot=[];
    if(fromAuto) this.autoAction(this.autoSession.battleStarted(true,started.id));
    this.refreshTime=0;this.go('battle');
  }
}
