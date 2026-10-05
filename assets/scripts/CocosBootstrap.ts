import { _decorator, Color, Component, game, Game, Node, profiler, ResolutionPolicy, view } from 'cc';
import { CocosUi, hexColor, palette } from './ui/CocosUi';
import * as store from './domain/store';
import * as stages from './domain/stages';
import * as config from './domain/config';
import * as battleRules from './domain/battle';
import * as fmt from './domain/fmt';
import * as platform from './domain/platform';
import * as rewarded from './services/RewardedService';
import { AutoBattleSession } from './services/AutoBattleSession';
import { ArtService } from './services/ArtService';
import { BattleFx } from './services/BattleFx';
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
  private initialArtPending = true;
  private initialArtElapsed = 0;
  public ui!: CocosUi;
  public notice = '';
  private noticeAt = 0;
  public pageIndex = 0;
  public selectedHeroId = 'liubei';
  public heroDetailOrigin: Page = 'heroes';
  public selectedArmorySlot = 'weapon';
  public selectedFormationSlot = 0;
  public formationPageIndex = 0;
  public selectedBoxQ = 1;
  public fighting: any = null;
  public trialHeroId = ''; // 名将试炼当前对象（C2）
  public sceneKey = ''; // 名场面当前对象（四时战纪第二批）
  public battleSceneName = ''; // 名场面标题（结算/战斗页用）
  public battleId = '';
  public battleMode = 'campaign';
  public armedTactic: string | null = null;
  public battleIndex = 1;
  public battleDiff = 1;
  public battleArenaSeed = 0;
  private refreshTime = 0;
  private battleFinishPending: { win: boolean; elapsed: number } | null = null;
  public outcome: any = null;
  public lastBattleSnapshot: any[] = [];
  public storyStage = 1;
  public storyArchiveCh = 0;
  public storyReview = false;
  public auto = false;
  public autoStopPending = false;
  private bountyRefresh = 0;
  private autoSession!: AutoBattleSession;
  private adPlacement = '';
  private adSeconds = 0;
  private adReturn: Page = 'home';
  private adGrant: (() => any) | null = null;
  private adSuccessText = '';
  public lastSummon: any[] = [];
  private navigation: Page[] = [];
  private static readonly PAGE_NAMES: Record<string, string> = {
    home: '主城', journey: '玩法', campaign: '战役', heroes: '英雄', bag: '背包', stagePreview: '关卡',
    heroDetail: '武将详情', summon: '点将台', summonResults: '召唤结果', armory: '军械', armoryCatalog: '军械图鉴',
    armoryBox: '军械箱', shop: '集市', formation: '编队', formationPick: '选择武将', quests: '任务', tower: '群英塔',
    arena: '演武场', arenaBoard: '演武排行', dungeon: '军屯', weekboss: '魔王讨伐', settings: '设置', story: '剧情',
    storyTransition: '过场', storyArchive: '剧情回顾', sevenDay: '七日目标', bounty: '悬赏', forge: '锻造台', codex: '图鉴', achv: '成就',
    expedition: '远征', hall: '名人堂', quad: '四方台', relics: '神兵阁', season: '四时战纪', seasonScenes: '名场面'
  };

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
    this.drawInitialLoading();
    this.hookDiag();
    // 超慢加载保留明确的进入选择，不自动露出旧地图再突变。
    this.scheduleOnce(() => {
      if (!this.initialArtPending) return;
      this.ui.setText('StartupDetail', '场景加载较慢，可继续等待或先进入游戏');
      this.ui.button('StartupSkip', '先进入游戏', 0, -140, 280, 56, () => this.finishInitialLoading(), palette.green);
    }, 8);
    // 美术预加载（2026-10-02 美术阶段）：装载完成后重绘一次当前菜单页，让已交付立绘/图标立即生效
    ArtService.preload((n) => {
      if (!this.isValid) return;
      if (!this.initialArtPending && n > 0 && this.page && ['home', 'journey', 'campaign', 'stagePreview', 'heroes', 'heroDetail', 'formation', 'formationPick', 'bag', 'summon', 'summonResults', 'shop', 'armory', 'armoryCatalog', 'armoryBox'].indexOf(this.page) >= 0) {
        try { this.show(this.page); } catch (e) { /* 重绘失败静默，保留占位页 */ }
      }
    }, () => this.finishInitialLoading());
  }

  private drawInitialLoading() {
    const U = this.ui = new CocosUi(this.content, Math.max(1, view.getVisibleSize().height / 1280), platform.safeAreaInsets());
    U.rect('StartupBackdrop', 0, 0, 720, 1280, new Color(12, 29, 26));
    U.panel('StartupFrame', 0, 20, 610, 310, new Color(19, 43, 35, 235), 14, new Color(157, 126, 72, 145), false);
    U.line('StartupTitleRule', [[-170, 25], [170, 25]], 1, palette.gold);
    U.text('StartupTitle', '挂机定三国', 0, 100, 520, 42, palette.gold);
    U.text('StartupStatus', '正在准备山河…', 0, -15, 510, 24, palette.text);
    U.text('StartupDetail', '场景就绪后，即刻出征', 0, -67, 560, 18, palette.muted);
  }

  private finishInitialLoading() {
    if (!this.initialArtPending || !this.isValid) return;
    this.initialArtPending = false;
    this.show(this.page);
  }

  onDestroy() {
    game.off(Game.EVENT_HIDE, this.onHide, this);
    game.off(Game.EVENT_SHOW, this.onShow, this);
    store.save();
  }
  private onHide() {
    // 退后台中断模拟广告：不发奖、不占成功次数
    if (this.page === 'ad' && this.adPlacement) { this.adPlacement = ''; this.adGrant = null; }
    if (this.auto) this.autoAction(this.autoSession.pause('background'));
    store.save();
  }
  private onShow() {
    if (this.page === 'ad' && !this.adPlacement) this.page = this.adReturn;
    if (this.auto) this.autoAction(this.autoSession.resume('background'));
    store.idlePending();
    this.show(this.page);
  }

  update(dt: number) {
    if (this.initialArtPending) {
      this.initialArtElapsed += dt;
      this.ui.setText('StartupStatus', '正在准备山河' + '·'.repeat(1 + Math.floor(this.initialArtElapsed * 2) % 3));
      return;
    }
    CocosUi.updateFloaters(dt);
    CocosUi.updateFlyItems(dt);
    if (this.page === 'ad' && this.adPlacement && this.adSeconds > 0) {
      const before = Math.ceil(this.adSeconds);
      this.adSeconds = Math.max(0, this.adSeconds - dt);
      if (Math.ceil(this.adSeconds) !== before) this.show('ad');
    }
    if (this.page === 'ad' && this.adPlacement) {
      const ratio = Math.min(1, 1 - this.adSeconds / 3);
      this.ui.updateProgress('AdProgress', 0, 40, 540, ratio);
      this.ui.setText('AdTimer', ratio >= 1 ? '播放完成 · 可领取奖励' : `播放中… ${Math.ceil(this.adSeconds)} 秒 · ${Math.floor(ratio * 100)}%`);
    }
    // If the finishing hit is an SSR ultimate, leave the resolved battlefield up long
    // enough for its full-screen scene to render. Rules are already settled by step();
    // this only delays the result transition and advances the visual clock.
    if (this.battleFinishPending) {
      const speed = store.getState().settings.autoBattleSpeed || 1;
      const advance = Math.min(0.1, dt) * speed;
      BattleFx.tick(dt, speed);
      this.battleFinishPending.elapsed += advance;
      if ((BattleFx.ultimateScenesLive === 0 && this.battleFinishPending.elapsed >= 0.24) ||
          this.battleFinishPending.elapsed >= BattleFx.ultimateSceneMaxTail) {
        const win = this.battleFinishPending.win;
        this.battleFinishPending = null;
        this.finishBattle(win);
      }
      return;
    }
    if (this.fighting && this.autoSession.state.status !== 'suspended') {
      const speed = store.getState().settings.autoBattleSpeed || 1;
      const step = this.fighting.step(Math.min(0.1, dt) * speed);
      this.refreshTime += dt;
      // A0 表现层管线：伤害数字/大招横幅由 BattleFx 每帧消费 events 渲染（旧 combatPopupDisplay/
      // _popupCount/lastUltDisplay 死路渲染已删除，职责整体迁入 BattleFx）
      const snap = this.fighting.snapshot();
      if (this.page === 'battle') BattleFx.feed(step.events, snap, this.ui, this.content);
      BattleFx.tick(dt, speed);
      const refreshGap = 0.3 / speed;
      if (step.done) {
        if (this.page === 'battle' && BattleFx.ultimateScenesLive > 0) this.battleFinishPending = { win: step.winner === 'A', elapsed: 0 };
        else this.finishBattle(step.winner === 'A');
      }
      else if (this.page === 'battle' && this.refreshTime > refreshGap) {
        this.refreshTime = 0;
        battleScreens.refreshBattleView(this);
      }
    } else if (this.auto) this.autoAction(this.autoSession.tick(dt));
    // 悬赏页停留时周期重绘：倒计时走动、到点自动变"领赏"
    if (this.page === 'bounty') {
      this.bountyRefresh += dt;
      if (this.bountyRefresh > 10) { this.bountyRefresh = 0; this.show('bounty'); }
    }
    // Notice 4 秒自动消隐（体验官复扫 P2：toast 常驻叠印下方内容）
    if (this.notice && this.noticeAt && Date.now() - this.noticeAt > 4000) {
      this.notice = ''; this.noticeAt = 0; this.show(this.page);
    }
  }

  private diagHooked = false;
  private hookDiag() {
    if (this.diagHooked) return;
    this.diagHooked = true;
    (globalThis as any).__tkDiag = () => ({ diag: store.diagSnapshot(), page: this.page, notice: this.notice, sceneKey: this.sceneKey, fx: BattleFx.live, ultimateScenes: BattleFx.ultimateScenesLive });
    (globalThis as any).__tkNav = (p: string) => { try { this.show(p as any); return true; } catch (e) { return false; } };
  }
  public show(page: Page) {
    if (this.initialArtPending) { this.page = page; return; }
    this.page = page;
    for (const child of this.content.children.slice()) child.destroy();
    ArtService.releasePortraits();
    // P1-① 防御清场（第二轮走查）：战斗 fx overlay 挂在常驻 fxLayer 上，任何非战斗页渲染时强制清空——
    // 无论泄漏链路（自动连战/跳过/中断）如何，用户可见症状必然消失；战斗页刷新不受影响
    if (page !== 'battle') { this.battleFinishPending = null; BattleFx.onBattleEnd(); }
    const verticalScale=Math.max(1,view.getVisibleSize().height/1280);
    const U = this.ui = new CocosUi(this.content,verticalScale,platform.safeAreaInsets()), s = store.getState();
    U.rect('Backdrop', 0, 0, 720, 1280, hexColor('#171009'));
    // 页面背景（2026-10-03 美术阶段）：分包 scene_<page>.jpg 有图用图、无图回退纯色；叠压暗层保 UI 可读
    const sceneKey = ({ home: 'scene_home', journey: 'scene_journey', campaign: 'scene_campaign', stagePreview: 'scene_campaign', heroes: 'scene_heroes', bag: 'scene_bag', shop: 'scene_bag', armory: 'scene_armory', armoryCatalog: 'scene_armory', armoryBox: 'scene_armory', arena: 'scene_arena_v2', arenaBoard: 'scene_arena_v2', tower: 'scene_heroic_hall', hall: 'scene_heroic_hall', storyArchive: 'scene_heroic_hall', codex: 'scene_heroic_hall', achv: 'scene_heroic_hall' } as Record<string, string | undefined>)[page];
    const sceneFrame = sceneKey ? ArtService.frame(sceneKey) : null;
    if (sceneFrame) {
      U.image('BackdropArt', sceneFrame, 0, 0, 720, 1280);
      U.rect('BackdropDim', 0, 0, 720, 1280, new Color(8, 6, 4, 96));
    }
    if (page === 'journey' || page === 'shop') {
      U.resourcePills([
        ['铜钱',fmt.fmtNum(s.res.gold)],['元宝',fmt.fmtNum(s.res.gem)],['招募令',fmt.fmtNum(s.res.scroll)],
        ['演武令',fmt.fmtNum(s.res.token)],['碎片',fmt.fmtNum(s.res.shard)]
      ], page==='journey'?590:513);
    }
    const render: Record<Page, () => void> = {
      campaign: () => campaignScreens.campaign(this), stagePreview: () => campaignScreens.stagePreview(this), home: () => campaignScreens.home(this), journey: () => campaignScreens.journey(this),
      heroes: () => heroScreens.heroes(this), heroDetail: () => heroScreens.heroDetail(this), summon: () => heroScreens.summon(this), summonResults: () => heroScreens.summonResults(this), bag: () => campaignScreens.bag(this),
      armory: () => heroScreens.armory(this), armoryCatalog: () => heroScreens.armoryCatalog(this), armoryBox: () => heroScreens.armoryBox(this), shop: () => campaignScreens.shop(this), formation: () => campaignScreens.formation(this), formationPick: () => campaignScreens.formationPick(this), quests: () => campaignScreens.quests(this),
      tower: () => campaignScreens.tower(this), arena: () => campaignScreens.arena(this), arenaBoard: () => campaignScreens.arenaBoard(this), dungeon: () => campaignScreens.dungeonView(this), weekboss: () => campaignScreens.weekBossView(this), settings: () => campaignScreens.settingsView(this), story: () => campaignScreens.storyView(this), storyArchive: () => campaignScreens.storyArchiveView(this), sevenDay: () => campaignScreens.sevenDayView(this), bounty: () => campaignScreens.bountyView(this), forge: () => heroScreens.forgeView(this), codex: () => heroScreens.codexView(this), achv: () => heroScreens.achvView(this), expedition: () => campaignScreens.expeditionView(this), hall: () => campaignScreens.hallView(this), quad: () => campaignScreens.quadTowerView(this), relics: () => heroScreens.relicsView(this), season: () => campaignScreens.seasonView(this), seasonScenes: () => campaignScreens.seasonScenesView(this),
      battle: () => battleScreens.battleView(this), result: () => battleScreens.resultView(this), autoSummary: () => battleScreens.autoSummary(this, this.autoSession.summary), ad: () => this.adView(),
      storyTransition: () => campaignScreens.storyTransitionView(this)
    };
    render[page]();
    // 面包屑路径条（I2 交互线）：三级及更深页面显示"祖先 > 当前"，逐环可点直达；两级不显示避免拥挤
    // R4：heroDetail 顶部标题/立绘与面包屑同带（y=484），入豁免列表不再绘制
    // 剧情衔接批次三：story 同为全屏沉浸页，页面自带章/关标题（y=479 与面包屑同带重叠，实拍 04/12 截图缺陷），按 battle 同款跳过
    // 批次四：storyTransition（章末过场）同为沉浸页，同款豁免
    if (this.navigation.length >= 2 && ['battle','result','autoSummary','ad','summonResults','heroDetail','story','storyTransition'].indexOf(page) < 0) {
      // R6：相邻同名段渲染前去重（机械栈产生的"点将台 > 点将台"类脏链合并为一段）；
      // segIdx 记录各段在真实栈中的下标，面包屑跳转仍按原栈位置截断
      const raw: Page[] = [...this.navigation, page];
      const pageName = (p: Page) => CocosBootstrap.PAGE_NAMES[p] || p;
      const segs: Page[] = [];
      const segIdx: number[] = [];
      raw.forEach((sp, i) => { if (i === 0 || pageName(sp) !== pageName(segs[segs.length - 1])) { segs.push(sp); segIdx.push(i); } });
      let cx = -150;
      segs.forEach((sp, i) => {
        const nm = pageName(sp);
        const w = nm.length * 17 + 10;
        if (i < segs.length - 1) {
          U.text('Crumbs' + i, nm, cx + w / 2 - 5, 484, w, 17, hexColor('#c9b489'));
          U.tap('CrumbsTap' + i, cx + w / 2 - 5, 484, w + 12, 40, () => this.goBreadcrumb(segIdx[i]));
          cx += w + 8;
          U.text('CrumbsSep' + i, '>', cx, 484, 14, 15, hexColor('#8a7c5f'));
          cx += 22;
        } else U.text('CrumbsCur', nm, cx + w / 2 - 5, 484, w, 17, hexColor('#8a7c5f'));
      });
    }
    if (this.notice) U.text('Notice', this.notice, 0, -510, 670, 20, palette.gold);
    if(['home','journey','campaign','heroes','bag','summon'].includes(page) && !heroScreens.isBlockingHeroModalOpen(page)) {
      U.rect('NavBackground', 0, -594, 720, 92, new Color(9, 31, 27, 248));
      U.line('NavGoldTop',[[-360,-548],[360,-548]],2,palette.gold);
      const nav: [Page,string,string][] = [['home','主城','城'],['journey','玩法','玩'],['campaign','战役','战'],['heroes','英雄','将'],['bag','背包','囊']];
      const badges = store.navBadges() as Record<string, boolean>;
      nav.forEach(([p,label,glyph], i) => {
        const x=-288+144*i, active=p===page || (p==='campaign'&&page==='stagePreview');
        if(active) {
          U.panel('NavActive'+p,x,-594,140,89,new Color(112,91,45,120),5,new Color(211,163,73,95),false);
          U.line('NavActiveTop'+p,[[x-48,-551],[x+48,-551]],3,palette.gold);
        }
        U.seal('NavIcon'+p,x,-577,46,glyph,active?palette.gold:palette.ink,palette.gold,active?palette.ink:palette.gold,26,'nav_'+p);
        U.text('NavLabel'+p,label,x,-620,123,21,active?palette.gold:palette.paper);
        if(badges[p])U.dot('NavDot'+p,x+52,-566);
        U.tap('Nav'+p,x,-594,138,90,()=>this.go(p));
      });
    }
  }
  public go(page: Page) {
    if (this.page==='battle' && page!=='battle' && this.fighting && !this.auto) {
      const stopped=store.interruptBattle(this.battleId,'navigate-away');
      if (!stopped.ok) { this.notice=stopped.msg; this.noticeAt=Date.now(); this.show('battle'); return; }
      this.fighting=null;
      this.battleId='';
      BattleFx.onBattleEnd(); // 离开战斗页必清 fx（红线 4：跨场残留 P2 教训）
    }
    this.notice = '';
    if (page !== this.page) {
      if (['home','journey','campaign','heroes','bag'].includes(page)) this.navigation = [];
      else if (this.navigation[this.navigation.length-1] === page) this.navigation.pop();
      // R6：summonResults 是瞬态结果页，不进导航栈——作为目标不压栈、从它离开也不压栈（否则返回动作会把它带入栈），back 直通点将台
      else if (page !== 'summonResults' && this.page !== 'summonResults') this.navigation.push(this.page);
    }
    this.show(page);
  }
  public back(fallback: Page = 'campaign') { this.go(this.navigation[this.navigation.length-1] || fallback); }
  /** 面包屑跳转（I2）：截断栈到目标层级并直达，不经过 go 的压栈逻辑。 */
  private goBreadcrumb(level: number) {
    this.notice = '';
    this.navigation = this.navigation.slice(0, level + 1);
    const target = this.navigation[this.navigation.length - 1];
    if (target) this.show(target);
  }
  public tell(result: any, good: string) {
    this.notice = result?.ok ? good : (result?.msg || '操作失败');
    this.noticeAt = Date.now();
    this.show(this.page);
    // 领取飞字（研讨会七 P4）：成功且有奖励数据时在屏幕中央偏上飘字
    const hasRewardData = result?.ok && (!!result?.reward || !!result?.rewards
      || ['gold', 'gem', 'scroll', 'token', 'shard', 'iron'].some(k => typeof result[k] === 'number' && result[k] > 0));
    if (hasRewardData) {
      this.spawnRewardFloater(result);
    } else if (result?.ok && result?.label) {
      this.spawnLabelFloater(good || result.label);
    }
  }
  private spawnRewardFloater(result: any) {
    // I3：兼容三种形态——reward 对象 / rewards 增量映射（claimDailyRewards）/ 顶层平铺数值字段
    const reward: any = result?.reward && typeof result.reward === 'object' ? result.reward
      : result?.rewards && typeof result.rewards === 'object' ? result.rewards
      : result;
    const CN: Record<string,string> = {gold:'铜钱',gem:'元宝',scroll:'令',token:'演武令',shard:'碎片',iron:'精铁',seals:'印信',medal:'战功',stones:'淬火石'};
    const parts = Object.entries(reward)
      .filter(([k]) => k in CN)
      .map(([k, v]) => `${CN[k]}+${v}`);
    if (parts.length) {
      const color = new (this.ccColor())(255, 220, 120, 255);
      CocosUi.floatText(this.content, 0, -80, parts.join('  '), color);
      // I3 领取飞包：页面顶栏有资源 pill 时，印章从飘字处飞向对应 pill 并脉冲
      // 目标按页面分发：journey/shop = ResourcePill 行；campaign = 顶栏 GoldPill/GemPill
      const flat: Record<string, number> = {};
      Object.entries(reward).forEach(([k, v]) => { if (typeof v === 'number' && v) flat[k] = v; });
      const rw: Record<string, number> = reward;
      const GLYPH: Record<string, string> = { gold: '钱', gem: '宝', scroll: '令', token: '令', shard: '片', iron: '铁' };
      const pillY = this.page === 'journey' ? 590 : this.page === 'shop' ? 513 : 600;
      const targets: Record<string, [number, number, string]> = {};
      if (this.page === 'journey' || this.page === 'shop') {
        const order = ['gold', 'gem', 'scroll', 'token', 'shard'];
        order.forEach((k, i) => { targets[k] = [-278 + i * 139, pillY, 'ResourcePill' + i]; });
      } else if (this.page === 'campaign') {
        targets.gold = [70, 600, 'GoldPill'];
        targets.gem = [216, 600, 'GemPill'];
      }
      Object.keys(targets)
        .filter(k => rw[k])
        .slice(0, 3)
        .forEach(k => {
          const [tx, ty, nodeName] = targets[k];
          CocosUi.flyGlyph(0, -60, tx, ty, GLYPH[k] || k[0], color, () => {
            const pill = this.ui.node(nodeName);
            if (pill) CocosUi.pulses.push({ node: pill, elapsed: 0 });
          });
        });
    }
  }
  private spawnLabelFloater(text: string) {
    if (!text) return;
    const color = new (this.ccColor())(255, 220, 120, 255);
    CocosUi.floatText(this.content, 0, -80, text, color);
  }
  private ccColor() { return Color; }
  /** 分享战绩（研讨会十 S1）：wx.shareAppMessage 被动分享，不发奖励（合规）。 */
  public shareResult(title: string, query?: string) {
    try {
      const g = globalThis as any;
      if (g.wx && g.wx.shareAppMessage) {
        const payload: any = { title: title || '挂机定三国 · 三国放置卡牌' };
        if (query) payload.query = query;
        g.wx.shareAppMessage(payload);
      }
    } catch (e) { /* 平台不支持静默 */ }
  }
  public confirm(title: string, detail: string, act: () => void) {
    const U = this.ui;
    const mask = U.rect('ConfirmMask', 0, 0, 720, 1280, new Color(12, 10, 8, 190));
    mask.on(Node.EventType.TOUCH_END, () => {});
    // U4 二阶段：弹层框体统一描金系（暗底+金框+金字标题），按钮色保留
    U.panel('ConfirmPanel', 0, 0, 625, 385, hexColor('#2a1e12'), 14, palette.gold);
    U.text('ConfirmTitle', title, 0, 120, 575, 34, palette.gold);
    U.text('ConfirmDetail', detail, 0, 24, 555, 23, hexColor('#f0e6cd'));
    U.button('ConfirmCancel', '再想想', -150, -112, 240, 72, () => this.show(this.page), palette.green);
    U.button('ConfirmDo', '确认', 150, -112, 240, 72, act, palette.red);
  }
  public playAd(placement: string, grant: () => any, successText: string) {
    if (rewarded.remaining(placement) <= 0) return this.tell({ok:false,msg:'今日该奖励次数已用完'},'');
    if (rewarded.configured()) {
      rewarded.showConfigured(placement).then(done => {
        if (done) {
          // 真实广告路径同样走原子事务：次数与奖励同存档提交
          const r = store.adReward(placement, grant);
          this.tell(r, r.ok ? successText : '');
        }
        else this.tell({ok:false,msg:'未看完广告，无奖励'},'');
      }).catch(() => this.tell({ok:false,msg:'广告暂不可用，稍后重试'},''));
      return;
    }
    this.adReturn = this.page;
    this.adPlacement = placement;
    this.adSeconds = 3;
    this.adGrant = grant;
    this.adSuccessText = successText;
    this.go('ad');
  }
  private claimAdReward() {
    const grant = this.adGrant, placement = this.adPlacement, target = this.adReturn, text = this.adSuccessText;
    this.adGrant = null; this.adPlacement = '';
    if (!grant) { this.go(target); return; }
    const r = store.adReward(placement, grant);
    this.go(target);
    this.tell(r, r.ok ? text : '');
  }
  public idleClaimChoice() {
    const U=this.ui, idle=store.idlePending(), quota=store.gemQuotaInfo();
    const fastLimit=config.AD.placements.fast.limit, fastLeft=Math.max(0, fastLimit-store.adCount('fast'));
    const fastOk=fastLeft>0 && quota.remaining>=config.FAST_AD.gem;
    U.rect('IdleChoiceMask',0,0,720,1280,palette.ink).on(Node.EventType.TOUCH_END,()=>{});
    // U4 二阶段：描金系统一
    U.panel('IdleChoicePanel',0,-10,664,648,hexColor('#2a1e12'),14,palette.gold);
    U.text('IdleChoiceTitle','领取挂机收益',0,252,565,34,palette.gold);
    const companionBuff = store.companionInfo && store.companionInfo().buffActive;
    U.text('IdleChoiceAmount',`自然待领：铜钱 ${fmt.fmtNum(idle.gold)} · 精铁 ${idle.iron}${companionBuff?'（含义从 +10%）':''}`,0,204,565,24,hexColor('#f0e6cd'));
    U.text('IdleGemLine',`今日元宝额度 ${quota.claimedGem}/${quota.cap} · 待领元宝 ${fmt.fmtNum(quota.pending)} · 00:00 重置`,0,170,600,19,hexColor('#c9b489'));
    U.button('IdleNormal','普通领取',-155,100,255,81,()=>{
      const r=store.claimIdle(false);
      this.tell(r,`获得铜钱 ${fmt.fmtNum(r.gold)}${r.gem?` · 元宝 ${fmt.fmtNum(r.gem)}`:''} · 精铁 ${r.iron}`);
    },palette.green);
    U.button('IdleAd','双倍 · 看模拟广告',155,100,255,81,()=>this.playAd('idle2x',()=>store.claimIdleInternal(true),'双倍领取挂机收益'),palette.gold);
    U.text('IdleAdNote','双倍只加倍铜钱，不倍增元宝',155,40,255,16,hexColor('#a99778'));
    U.panel('FastPanel',0,-52,600,148,hexColor('#312218'),8,hexColor('#795b34'));
    U.text('FastTitle','快速收获 · 看模拟广告',-88,-16,340,24,hexColor('#f0e6cd'));
    U.text('FastLeft',`剩余 ${fastLeft}/${fastLimit} 次`,218,-16,140,22,hexColor('#f0e6cd'));
    U.text('FastDesc','立即获得 1 小时：元宝 1000＋铜钱＋精铁 25\n元宝计入今日 5000 额度；精铁不占自然累计',0,-62,560,32,hexColor('#ad9977'));
    U.button('IdleFast',fastOk?'立即快收':'今日次数或额度不足',0,-172,560,64,()=>this.playAd('fast',()=>store.fastRewardAdMutation(),'快速收获成功'),fastOk?palette.gold:palette.paperDark);
    U.button('IdleCancel','稍后再领',0,-256,250,56,()=>this.show('campaign'),palette.paperDark);
  }
  private adView() {
    const conf = config.AD.placements[this.adPlacement];
    this.title('模拟广告 · 测试模式', conf?.name || '激励视频');
    this.ui.rect('AdPanel',0,40,640,760,palette.green);
    this.ui.text('AdIcon','▣',0,190,200,105,palette.gold);
    this.ui.progress('AdProgress',0,40,540,0);
    this.ui.text('AdTimer',this.adSeconds>0?`播放中… ${Math.ceil(this.adSeconds)} 秒 · ${Math.floor((1-this.adSeconds/3)*100)}%`:'播放完成 · 可领取奖励',0,-25,520,26);
    this.ui.text('AdHint','提前关闭不扣次数、不发奖励',0,-90,510,22,palette.paper);
    this.ui.text('AdTest','模拟广告 · 测试模式 · 不接真实广告位',0,-140,560,18,palette.muted);
    this.ui.button('AdClose','关闭',-158,-335,280,87,()=>{this.adPlacement='';this.adGrant=null;this.go(this.adReturn);},palette.paperDark);
    if(this.adSeconds<=0)this.ui.button('AdClaim','领取奖励',158,-335,280,87,()=>this.claimAdReward(),palette.gold);
  }
  public title(text: string, sub = '') {
    this.ui.panel('TitleBand',0,607,684,60,new Color(9,27,24,185),9,new Color(177,139,75,125),false);
    if (text.length <= 10) {
      this.ui.line('TitleLeftFlourish',[[-313,608],[-248,608]],1,palette.gold);
      this.ui.line('TitleRightFlourish',[[248,608],[313,608]],1,palette.gold);
    }
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
  private lastReplaySpec: any = null;
  public replaying = false;
  public startReplay(record: any) {
    if (this.fighting || this.auto) return this.tell({ ok: false, msg: '已有战斗进行中' }, '');
    const rec = record || {};
    if (rec.v !== 1) return this.tell({ ok: false, msg: '战报版本过期，无法回放' }, '');
    this.replaying = true;
    this.battleMode = rec.mode || 'hall';
    this.battleIndex = rec.index != null ? rec.index : (rec.seat || 0);
    this.battleId = 'replay';
    (this as any).replayName = rec.name || rec.lineupName || '对局回放';
    this.fighting = battleRules.createBattle({ seed: rec.seed, timeLimit: rec.timeLimit, team: rec.team, enemy: rec.enemy, env: rec.effects && rec.effects.env || null, reinforce: rec.effects && rec.effects.reinforce || null, healScale: rec.effects && rec.effects.healScale || null });
    // 回放跨场重置（6.2-3 既有缺陷修复）：与实况同钩子，防上一场的 fx 状态抑制本场表现
    BattleFx.reset();
    this.go('battle');
  }
  private finishBattle(win: boolean) {
    this.battleFinishPending = null;
    if (this.replaying) {
      const duration=this.fighting?.result()?.duration || 0;
      const snapshot=this.fighting?.snapshot() || [];
      this.outcome={ win, replay:true, replayName:(this as any).replayName||'对局回放', duration, aliveCount:snapshot.filter((u:any)=>u.side==='A'&&u.alive).length };
      BattleFx.onBattleEnd();
      this.fighting=null; this.replaying=false;
      this.show('result');
      return;
    }
    const duration=this.fighting?.result()?.duration || 0;
    this.lastBattleSnapshot=this.fighting?.snapshot() || [];
    const aliveCount=this.lastBattleSnapshot.filter((u:any)=>u.side==='A'&&u.alive).length;
    const battleStats=this.fighting?.result()?.stats||null;
    const bossMaxHp=this.battleMode==='weekboss'?(this.lastBattleSnapshot.find((u:any)=>u.side==='B')?.maxHp||0):0;
    const settled=store.settleBattle(this.battleId,{win,duration,aliveCount,stats:battleStats,maxHp:bossMaxHp});
    if(this.lastReplaySpec){
      // 战报中心：名人堂带 hallStars；战役带评星（首通挑战），其余模式 stars 置 0
      const stars=this.battleMode==='hall'?(settled.reward&&settled.reward.hallStars||0):(settled.reward&&settled.reward.stars||0);
      store.saveReplay(Object.assign({},this.lastReplaySpec,{ts:Date.now(),win,stars,duration}));
      this.lastReplaySpec=null;
    }
    this.outcome={...settled,win,duration,stats:battleStats};
    BattleFx.onBattleEnd(); // 结算前清 fx：skipBattle 的批量 step 事件不入 feed，避免爆发
    this.fighting=null;
    this.show('result');
    // 震动反馈（研讨会七 P5）：战斗胜利短震
    if (win && !this.replaying) {
      CocosUi.vibrateShort();
    }
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
      if (command.type === 'storyPause') {
        // 剧情暂停（批次一）：自动出征遇未读剧情节点，弹剧情页；看完/跳过后经 finishAutoStory 恢复连战
        this.storyStage = command.index; this.storyReview = false; this.go('story');
      }
      if (command.type === 'interruptBattle') {
        const stopped = store.interruptBattle(command.battleId, 'auto-stopped');
        if (stopped.ok) { this.fighting = null; this.battleId = ''; }
      }
      if (command.type === 'stopped') { this.auto = false; this.show('autoSummary'); }
    }
  }

  /** 自动剧情暂停的出口：看完或跳过均标记已读（看过≠细读，防反复打断），随后恢复连战。 */
  public finishAutoStory() {
    if (this.autoSession.state.status !== 'story') return;
    const idx = this.autoSession.state.storyStage;
    if (idx && !store.isStorySeen(idx)) { store.markStorySeen(idx); store.save(); }
    this.autoAction(this.autoSession.storyDone());
  }

  public startArenaBattle(diff: number, seed: number) { this.startBattle('arena',0,diff,false,seed); }
  public startDungeonBattle(kind: string, floor: number) { this.startBattle('dungeon',floor,1,false,0,kind); }
  public startWeekBoss() {
    // 周常 Boss 专用管线（体验官/仿真代理指出的可达性缺陷修复）：扣次数+建敌+进战斗
    if (this.fighting || this.auto) return this.tell({ ok: false, msg: '已有战斗进行中' }, '');
    const wb = store.weekBossInfo();
    if (!wb.enabled) return this.tell({ ok: false, msg: '魔王讨伐未开放' }, '');
    if (wb.attemptsLeft <= 0) return this.tell({ ok: false, msg: '本周讨伐次数已用完' }, '');
    const enemy = stages.makeWeekBossEnemies(wb.weekId, store.playerLevel());
    const started = store.beginBattle({ mode: 'weekboss', index: 1, referenceLevel: store.playerLevel() });
    if (!started.ok) return this.tell(started, '');
    this.battleId = started.id; this.battleMode = 'weekboss'; this.battleIndex = 1; this.battleDiff = 1; this.battleArenaSeed = 0;
    this.fighting = battleRules.createBattle({ team: store.playerUnits(this.armedTactic, false), enemy: store.enemyUnits(enemy.units), seed: Date.now(), timeLimit: config.BATTLE.TIME_LIMIT });
    BattleFx.reset(); // 每场重置 fx（试玩 P2：跨场保留旧状态会抑制新一场的表现）
    this.lastBattleSnapshot = [];
    this.refreshTime = 0;
    this.go('battle');
  }
  public battleDungeonKind: string = '';

  public startBattle(mode: string,index: number,diff=1,fromAuto=false,arenaSeed=0,dungeonKind?: string) {
    if(this.fighting)return this.tell({ok:false,msg:'已有战斗进行中'},'');
    if(this.auto && !fromAuto) return this.confirm('自动出征进行中','结束当前自动会话后再开始手动挑战？',()=>{
      this.autoAction(this.autoSession.stop('replaced-by-battle'));
      this.startBattle(mode,index,diff);
    });
    if(mode==='campaign'&&!fromAuto&&!store.isStorySeen(index)&&stages.makeStageEnemies(index).story){
      this.storyStage=index;this.storyReview=false;this.go('story');return;
    }
    // 剧情推图衔接批次一（2026-10-05 方案）：删除自动出征对未读剧情的静默 markStorySeen——
    // 自动路过不再烧掉补看资格；自动链路的剧情展示由状态机 storyPause 暂停点负责（见 autoAction）
    const effectiveArenaSeed=arenaSeed||Date.now();
    let _hallLineup:any=null;
    if(mode==='hall'){const bh=store.beginHall(index);if(!bh.ok)return this.tell(bh,'');_hallLineup=bh.lineup;}
    const enemy=mode==='campaign'?stages.makeStageEnemies(index):mode==='tower'?stages.makeTowerEnemies(index):mode==='training'?stages.makePracticeEnemies(store.playerLevel(),Date.now()):mode==='expedition'?store.makeExpeditionFloor(index):mode==='trial'?stages.makeTrialEnemies(this.trialHeroId,store.playerLevel()):mode==='scene'?stages.makeSceneEnemies(this.sceneKey,store.playerLevel()):mode==='quad'?(():any=>{const qi=store.quadTowerInfo();const anchor=Math.max(10,Math.min(120,store.getState().campaign.cleared||0));return stages.makeQuadTowerEnemies(qi.faction,qi.weekId,anchor,index);})():mode==='dungeon'?stages.makeDungeonEnemies(dungeonKind==='train'?'train':'gold',index,store.playerLevel()):mode==='hall'?(():any=>{const bh=store.beginHall(index);if(!bh.ok)return null;return stages.makeHallEnemies(bh.lineup,store.teamPower(),index);})():stages.makeArenaEnemies(store.teamPower(),effectiveArenaSeed,diff);
    const started=store.beginBattle({mode,index,diff,referenceLevel:enemy.units[0]?.level||store.playerLevel(),hallLineup:_hallLineup,hallWeek:(store.getState().week||{}).weekId||null,dungeonKind,trialHero:mode==='trial'?(this.trialHeroId||null):null,sceneKey:mode==='scene'?(this.sceneKey||null):null});
    this.battleDungeonKind=dungeonKind||'';
    if(!started.ok){
      if(fromAuto) this.autoAction(this.autoSession.battleStarted(false,undefined,started.msg));
      return this.tell(started,'');
    }
    this.battleId=started.id;this.battleMode=mode;this.battleIndex=index;if(mode==='scene'){const sc2=(config.SEASON as any).scenes.byId[this.sceneKey];this.battleSceneName=sc2?sc2.name:'';}this.battleDiff=diff;this.battleArenaSeed=mode==='arena'?effectiveArenaSeed:0;
    let effects=null;
    if(mode==='campaign') effects=stages.stageBattleEffects(stages.makeStageEnemies(index));
    else if(mode==='expedition') effects=stages.stageBattleEffects(enemy);
    else if(mode==='scene') effects=(enemy as any).effects||null;
    const battleSeed=Date.now();
    let teamUnits=store.playerUnits(this.armedTactic,!(config.BORROW&&config.BORROW.excludedModes||[]).includes(mode));
    if(mode==='quad'){
      const qi=store.quadTowerInfo();
      teamUnits=teamUnits.filter((u:any)=>u.faction===qi.faction);
    }
    if(mode==='scene'){
      const sc=(config.SEASON as any).scenes.byId[this.sceneKey];
      if(sc.type==='faction'){
        teamUnits=teamUnits.filter((u:any)=>u.faction===sc.faction);
        if(!teamUnits.length){ return this.tell({ok:false,msg:'该阵营无可上阵武将'},''); }
      }
    }
    // 远征加护（研讨会十二 A1）：仅远征战斗把本周加护被动并入我方全军
    if(mode==='expedition'){
      const bm=store.expeditionBoonMods();
      Object.keys(bm).forEach((k:string)=>{teamUnits.forEach((u:any)=>{u.passive=Object.assign({},u.passive);u.passive[k]=(u.passive[k]||0)+bm[k];});});
    }
    this.fighting=battleRules.createBattle(Object.assign({team:teamUnits,enemy:store.enemyUnits(enemy.units),seed:battleSeed},effects||{}));
    // 每场重置 fx 管线（试玩 P2：跨场保留旧状态会抑制新一场的伤害数字）
    BattleFx.reset();
    // 战报捕获（战报中心 P3）：battleSeed 与 createBattle 同源（修复回放 RNG 漂移）
    {
      const cap=config.REPLAYS.capture;
      const specBase={ v:1 as const, seed:battleSeed, timeLimit:config.BATTLE.TIME_LIMIT,
        // 回归巡检 R-中修复：快照补 heroId（立绘 key）——此前裁掉导致回放全程字卡；旧战报缺 heroId 回退字卡向后兼容
        team:store.playerUnits((this as any).armedTactic,false).map((u:any)=>({uid:u.uid,name:u.name,faction:u.faction,cls:u.cls,level:u.level,row:u.row,stats:u.stats,ult:u.ult,passive:u.passive,isBoss:false,heroId:u.heroId})),
        enemy:enemy.units.map((u:any)=>{const e2=store.enemyUnits([u])[0];return {uid:e2.uid,name:e2.name,faction:e2.faction,cls:e2.cls,level:e2.level,row:e2.row,stats:e2.stats,ult:e2.ult,passive:e2.passive,isBoss:!!e2.isBoss,heroId:(e2 as any).heroId};}),
        effects:effects||null };
      if(mode==='hall'&&cap.hall){
        this.lastReplaySpec=Object.assign(specBase,{mode:'hall',seat:index,lineupId:_hallLineup.id,lineupName:_hallLineup.name,name:_hallLineup.name});
      } else if(mode==='campaign'&&cap.campaignFirst&&started.first){
        this.lastReplaySpec=Object.assign(specBase,{mode:'campaign',index,first:true,name:enemy.name||`第 ${index} 关`});
      } else if(mode==='tower'&&cap.towerMilestone&&started.first&&index%5===0){
        this.lastReplaySpec=Object.assign(specBase,{mode:'tower',index,name:`群英塔 · 第 ${index} 层`});
      } else if(mode==='arena'&&cap.arenaHigh&&diff>((config.REPLAYS.arenaHighDiff))){
        this.lastReplaySpec=Object.assign(specBase,{mode:'arena',index,diff,name:'演武 · 凶险切磋'});
      } else {
        this.lastReplaySpec=null;
      }
    }
    this.lastBattleSnapshot=[];
    if(fromAuto) this.autoAction(this.autoSession.battleStarted(true,started.id));
    this.refreshTime=0;this.go('battle');
  }
}
