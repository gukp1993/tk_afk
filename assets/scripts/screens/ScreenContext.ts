import { CocosUi } from '../ui/CocosUi';

export type Page = 'campaign'|'stagePreview'|'home'|'journey'|'heroes'|'heroDetail'|'summon'|'summonResults'|'bag'|'armory'|'armoryCatalog'|'armoryBox'|'shop'|'formation'|'formationPick'|'tower'|'arena'|'quests'|'story'|'battle'|'result'|'autoSummary'|'ad';

/** Navigation and transient interaction state shared by native Cocos screen renderers. */
export interface ScreenContext {
  page: Page;
  ui: CocosUi;
  notice: string;
  pageIndex: number;
  selectedHeroId: string;
  selectedArmorySlot: string;
  selectedFormationSlot: number;
  formationPageIndex: number;
  selectedBoxQ: number;
  fighting: any;
  battleId: string;
  battleMode: string;
  battleIndex: number;
  battleDiff: number;
  battleArenaSeed: number;
  outcome: any;
  lastBattleSnapshot: any[];
  storyStage: number;
  auto: boolean;
  autoStopPending: boolean;
  lastSummon: any[];
  show(page: Page): void;
  go(page: Page): void;
  back(fallback?: Page): void;
  tell(result: any, good: string): void;
  confirm(title: string, detail: string, act: () => void): void;
  playAd(placement: string, reward: () => void): void;
  idleClaimChoice(): void;
  title(text: string, sub?: string): void;
  row(name: string, text: string, y: number, action?: () => void, actionText?: string): void;
  startBattle(mode: string, index: number, diff?: number): void;
  startArenaBattle(diff: number, seed: number): void;
  startAuto(mode: 'campaign'|'training'): void;
  stopAuto(afterBattle?: boolean): void;
  skipBattle(): void;
  summonDraw(type: string): void;
}
