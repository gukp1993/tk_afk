import { Rect, resources, Size, SpriteFrame, Vec2 } from 'cc';

type HeroArt = { sheet: string; x: number; y: number; w: number; h: number };
// Generated once from docs/hero-ui-handoff-v1/assets-manifest.json; rects use its top-left pixel contract.
const SPRITES: Record<string, HeroArt> = {
  "nav_home": {
    "sheet": "icons-common-v1",
    "x": 59,
    "y": 87,
    "w": 244,
    "h": 230
  },
  "nav_journey": {
    "sheet": "icons-common-v1",
    "x": 360,
    "y": 117,
    "w": 257,
    "h": 201
  },
  "nav_campaign": {
    "sheet": "icons-common-v1",
    "x": 665,
    "y": 100,
    "w": 235,
    "h": 223
  },
  "nav_heroes": {
    "sheet": "icons-common-v1",
    "x": 985,
    "y": 87,
    "w": 191,
    "h": 241
  },
  "nav_bag": {
    "sheet": "icons-common-v1",
    "x": 69,
    "y": 386,
    "w": 211,
    "h": 229
  },
  "currency_gold": {
    "sheet": "icons-common-v1",
    "x": 367,
    "y": 391,
    "w": 222,
    "h": 224
  },
  "currency_gem": {
    "sheet": "icons-common-v1",
    "x": 658,
    "y": 437,
    "w": 256,
    "h": 163
  },
  "stat_hp": {
    "sheet": "icons-common-v1",
    "x": 975,
    "y": 417,
    "w": 215,
    "h": 191
  },
  "stat_atk": {
    "sheet": "icons-common-v1",
    "x": 85,
    "y": 698,
    "w": 188,
    "h": 181
  },
  "stat_def": {
    "sheet": "icons-common-v1",
    "x": 398,
    "y": 674,
    "w": 181,
    "h": 221
  },
  "chevron_left": {
    "sheet": "icons-common-v1",
    "x": 705,
    "y": 687,
    "w": 134,
    "h": 207
  },
  "chevron_right": {
    "sheet": "icons-common-v1",
    "x": 1024,
    "y": 686,
    "w": 135,
    "h": 208
  },
  "star_on": {
    "sheet": "icons-common-v1",
    "x": 74,
    "y": 962,
    "w": 215,
    "h": 209
  },
  "star_off": {
    "sheet": "icons-common-v1",
    "x": 367,
    "y": 955,
    "w": 221,
    "h": 216
  },
  "plus": {
    "sheet": "icons-common-v1",
    "x": 695,
    "y": 974,
    "w": 185,
    "h": 183
  },
  "close": {
    "sheet": "icons-common-v1",
    "x": 995,
    "y": 974,
    "w": 191,
    "h": 186
  },
  "faction_all": {
    "sheet": "badges-skills-v1",
    "x": 42,
    "y": 45,
    "w": 368,
    "h": 372
  },
  "faction_wei": {
    "sheet": "badges-skills-v1",
    "x": 480,
    "y": 45,
    "w": 369,
    "h": 372
  },
  "faction_shu": {
    "sheet": "badges-skills-v1",
    "x": 924,
    "y": 45,
    "w": 369,
    "h": 372
  },
  "faction_wu": {
    "sheet": "badges-skills-v1",
    "x": 1365,
    "y": 45,
    "w": 369,
    "h": 372
  },
  "faction_qun": {
    "sheet": "badges-skills-v1",
    "x": 42,
    "y": 464,
    "w": 369,
    "h": 374
  },
  "skill_guanyu_ult": {
    "sheet": "badges-skills-v1",
    "x": 479,
    "y": 468,
    "w": 372,
    "h": 368
  },
  "skill_guanyu_passive": {
    "sheet": "badges-skills-v1",
    "x": 923,
    "y": 468,
    "w": 372,
    "h": 368
  },
  "formation": {
    "sheet": "badges-skills-v1",
    "x": 1369,
    "y": 464,
    "w": 363,
    "h": 373
  },
  "frame_n": {
    "sheet": "components-v1",
    "x": 46,
    "y": 60,
    "w": 315,
    "h": 406
  },
  "frame_r": {
    "sheet": "components-v1",
    "x": 434,
    "y": 60,
    "w": 315,
    "h": 403
  },
  "frame_sr": {
    "sheet": "components-v1",
    "x": 821,
    "y": 60,
    "w": 315,
    "h": 403
  },
  "frame_ssr": {
    "sheet": "components-v1",
    "x": 46,
    "y": 508,
    "w": 310,
    "h": 362
  },
  "button_primary": {
    "sheet": "components-v1",
    "x": 371,
    "y": 629,
    "w": 395,
    "h": 129
  },
  "panel_dark": {
    "sheet": "components-v1",
    "x": 779,
    "y": 631,
    "w": 376,
    "h": 127
  },
  "armory_weapon": {
    "sheet": "components-v1",
    "x": 46,
    "y": 909,
    "w": 314,
    "h": 372
  },
  "armory_armor": {
    "sheet": "components-v1",
    "x": 398,
    "y": 929,
    "w": 388,
    "h": 357
  },
  "armory_jade": {
    "sheet": "components-v1",
    "x": 820,
    "y": 943,
    "w": 307,
    "h": 330
  },
  "hero_guanyu_full": {
    "sheet": "guanyu-full-v1",
    "x": 0,
    "y": 0,
    "w": 1024,
    "h": 1536
  },
  "background_fortress": {
    "sheet": "background-fortress-v1",
    "x": 0,
    "y": 0,
    "w": 941,
    "h": 1672
  }
};

const BASE_FRAMES: Record<string, SpriteFrame> = {};
const CUT_FRAMES: Record<string, SpriteFrame> = {};
const WAITERS: Record<string, Array<(frame: SpriteFrame | null) => void>> = {};

function sourceFrame(sheet: string, done: (frame: SpriteFrame | null) => void) {
  if (BASE_FRAMES[sheet]?.isValid) return done(BASE_FRAMES[sheet]);
  const waiters = WAITERS[sheet] || (WAITERS[sheet] = []);
  waiters.push(done);
  if (waiters.length > 1) return;
  resources.load(`hero-ui/${sheet}/spriteFrame`, SpriteFrame, (error, frame) => {
    if (!error && frame?.isValid) BASE_FRAMES[sheet] = frame;
    const callbacks = WAITERS[sheet] || [];
    delete WAITERS[sheet];
    callbacks.forEach((callback) => callback(error ? null : frame));
  });
}

/** Loads source textures lazily and caches derived rect frames. The caller validates its Node before assignment. */
export function loadHeroSpriteFrame(id: string, done: (frame: SpriteFrame | null) => void) {
  if (id.startsWith('portrait_')) {
    sourceFrame(`portraits/${id.slice('portrait_'.length)}`, done);
    return;
  }
  const art = SPRITES[id];
  if (!art) return done(null);
  if (CUT_FRAMES[id]?.isValid) return done(CUT_FRAMES[id]);
  sourceFrame(art.sheet, (source) => {
    if (!source?.texture) return done(null);
    if (!CUT_FRAMES[id]?.isValid) {
      const frame = new SpriteFrame();
      frame.reset({
        texture: source.texture,
        // SpriteFrame rects use top-left texture coordinates, as does the design manifest.
        rect: new Rect(art.x, art.y, art.w, art.h),
        originalSize: new Size(art.w, art.h),
        offset: new Vec2(0, 0),
      });
      frame.addRef();
      CUT_FRAMES[id] = frame;
    }
    done(CUT_FRAMES[id]);
  });
}

export function heroSpriteIds() { return Object.keys(SPRITES); }
