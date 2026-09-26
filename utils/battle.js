// 回合制实时战斗引擎（tick 模拟，纯 JS 可独立测试）
const { BEATS, FACTION_ADV, factionBonus, BATTLE } = require('./config');
const { makeRng } = require('./rng');

// unit spec: { uid, heroId, name, faction, cls, level, star, stats:{hp,atk,def,spd,crit}, ult:{name,desc,effects}, passive:{mods...}, row, isBoss }
function createBattle(cfg) {
  const seed = cfg.seed || 1;
  const rng = makeRng(seed);
  const limit = cfg.timeLimit || BATTLE.TIME_LIMIT;
  const stats = {}; // uid -> {dmg, heal}
  const sides = { A: buildSide(cfg.team, 'A'), B: buildSide(cfg.enemy, 'B') };
  let time = 0;
  let ended = false;
  let winner = null;

  function buildSide(list, tag) {
    const units = list.map((u, i) => ({
      uid: u.uid || (tag + i),
      side: tag, slot: i, row: u.row !== undefined ? u.row : (i <= 2 ? 0 : 1),
      name: u.name, heroId: u.heroId, faction: u.faction, cls: u.cls, level: u.level,
      isBoss: !!u.isBoss,
      startHpPct: u.startHpPct || 0,
      base: Object.assign({}, u.stats),
      ult: u.ult || { name: '奋击', effects: [{ t: 'dmg', tgt: 'single', mult: 2 }] },
      passive: u.passive || {},
      // 运行时
      hp: u.stats.hp, maxHp: u.stats.hp, shield: 0, energy: 0,
      alive: true, actTimer: rng.range(0.2, 0.9),
      buffs: [], dots: [], hots: [], cc: null,
      cheat: (u.passive && u.passive.cheatDeath) || 0
    }));
    // 光环 + 阵营加成
    const fcount = {};
    units.forEach(u => { fcount[u.faction] = (fcount[u.faction] || 0) + 1; });
    const fb = factionBonus(Math.max.apply(null, Object.keys(fcount).map(k => fcount[k])));
    let auraAtk = 0, auraDef = 0, auraSpd = 0;
    units.forEach(u => {
      const p = u.passive;
      auraAtk += p.auraAtk || 0; auraDef += p.auraDef || 0; auraSpd += p.auraSpd || 0;
    });
    units.forEach(u => {
      u.auraAtk = auraAtk + fb.atk;
      u.auraDef = auraDef;
      u.auraSpd = auraSpd;
      u.fbHp = fb.hp;
      u.maxHp = Math.floor(u.maxHp * (1 + (u.passive.hp || 0)) * (1 + fb.hp));
      u.hp = u.startHpPct > 0 ? Math.max(1, Math.floor(u.maxHp * u.startHpPct)) : u.maxHp;
      u.energy = (u.passive.firstEnergy || 0);
      stats[u.uid] = { dmg: 0, heal: 0 };
    });
    return units;
  }

  function aliveOf(side) { return sides[side].filter(u => u.alive); }
  function foesOf(u) { return aliveOf(u.side === 'A' ? 'B' : 'A'); }
  function alliesOf(u) { return aliveOf(u.side); }

  function effStat(u, stat) {
    let pct = u.passive[stat] || 0;
    for (const b of u.buffs) if (b.stat === stat) pct += b.pct;
    let v = u.base[stat] * (1 + pct);
    if (stat === 'atk') v *= (1 + u.auraAtk);
    if (stat === 'def') v *= (1 + u.auraDef);
    if (stat === 'spd') v *= (1 + u.auraSpd);
    return v;
  }
  function critChance(u) {
    let c = (u.base.crit || 0.05) + (u.passive.crit || 0);
    for (const b of u.buffs) if (b.stat === 'crit') c += b.pct;
    return Math.min(0.95, c);
  }

  // ---- 目标选择 ----
  function pickBy(u, pred) {
    const fs = foesOf(u);
    if (!fs.length) return null;
    const sorted = fs.slice().sort((a, b) => (a.slot - b.slot));
    const hit = sorted.find(pred);
    return hit || null;
  }
  function defaultTarget(u) {
    const cls = u.cls;
    if (cls === 'archer') {
      return pickBy(u, x => x.row === 1) || pickBy(u, () => true);
    }
    if (cls === 'mage') {
      const fs = foesOf(u);
      return fs.length ? fs[Math.floor(rng.next() * fs.length)] : null;
    }
    return pickBy(u, x => x.row === 0) || pickBy(u, () => true);
  }
  function lowest(units, key) {
    return units.slice().sort((a, b) => a[key] - b[key])[0] || null;
  }
  function resolveTargets(src, tgt) {
    const foes = foesOf(src);
    const allies = alliesOf(src);
    switch (tgt) {
      case 'self': return [src];
      case 'allEnemies': return foes;
      case 'allAllies': return allies;
      case 'frontRow': return foes.filter(x => x.row === 0);
      case 'backRow': return foes.filter(x => x.row === 1);
      case 'rand2': return rng.shuffle(foes).slice(0, 2);
      case 'rand3': return rng.shuffle(foes).slice(0, 3);
      case 'randEach': return foes.length ? [foes[Math.floor(rng.next() * foes.length)]] : [];
      case 'lowestEnemy': return lowest(foes, 'hp') ? [lowest(foes, 'hp')] : [];
      case 'strongestEnemy': { const t = foes.slice().sort((a, b) => b.maxHp - a.maxHp)[0]; return t ? [t] : []; }
      case 'lowestAlly': return lowest(allies, 'hp') ? [lowest(allies, 'hp')] : [];
      case 'single': default: { const t = defaultTarget(src); return t ? [t] : []; }
    }
  }

  // ---- 伤害/治疗 ----
  function emit(ev) { events.push(ev); }
  function gainEnergy(u, amt) {
    u.energy = Math.min(BATTLE.ENERGY_MAX, u.energy + amt * (1 + (u.passive.energyGain || 0)));
  }
  function applyDamage(src, tgt, raw, opts) {
    opts = opts || {};
    if (!tgt.alive) return;
    let dmg = raw;
    const K = BATTLE.DEF_K(src.level || 1);
    const defF = K / (K + effStat(tgt, 'def'));
    const fac = BEATS[src.faction] === tgt.faction ? FACTION_ADV : 1;
    let crit = false;
    if (!opts.noCrit) crit = rng.chance(critChance(src));
    const critM = crit ? (BATTLE.CRIT_BASE_DMG + (src.passive.critDmg || 0)) : 1;
    const exec = opts.execute && (tgt.hp / tgt.maxHp < opts.execute) ? 1.8 : 1;
    dmg = dmg * defF * fac * critM * exec * rng.range(0.92, 1.08);
    dmg *= (1 - (src === tgt ? 0 : (tgt.passive.dmgReduce || 0)));
    dmg = Math.max(1, Math.floor(dmg));
    // 护盾吸收
    if (tgt.shield > 0) {
      const absorbed = Math.min(tgt.shield, dmg);
      tgt.shield -= absorbed;
      dmg -= absorbed;
      if (absorbed > 0) emit({ e: 'shieldHit', uid: tgt.uid, amount: absorbed });
    }
    if (dmg > 0) {
      tgt.hp -= dmg;
      tgt.hp = Math.max(0, tgt.hp);
      stats[src.uid].dmg += dmg;
      emit({ e: 'hit', uid: tgt.uid, src: src.uid, amount: dmg, crit, kind: opts.kind || 'atk' });
      gainEnergy(tgt, BATTLE.ENERGY_HIT);
      // 吸血
      const ls = (opts.ls || 0) + (src.passive.vamp || 0);
      if (ls > 0 && src.alive) healHp(src, dmg * ls);
      // 反弹
      const th = tgt.passive.thorns || 0;
      if (th > 0 && src.alive && !opts.isReflect) {
        const r = Math.max(1, Math.floor(dmg * th));
        dealRaw(src, r, 'reflect');
      }
    }
    if (tgt.hp <= 0) handleDeath(tgt, src);
  }
  function dealRaw(u, amount, kind) {
    if (!u.alive) return;
    u.hp = Math.max(0, u.hp - amount);
    emit({ e: 'hit', uid: u.uid, src: null, amount, crit: false, kind });
    if (u.hp <= 0) handleDeath(u, null);
  }
  function healHp(u, amount) {
    if (!u.alive || amount <= 0) return;
    const real = Math.min(u.maxHp - u.hp, Math.floor(amount));
    if (real > 0) {
      u.hp += real;
      stats[u.uid].heal += real;
      emit({ e: 'heal', uid: u.uid, amount: real });
    }
  }
  function handleDeath(u, killer) {
    if (u.cheat > 0) {
      u.cheat--;
      u.hp = 1;
      emit({ e: 'cheat', uid: u.uid });
      return;
    }
    u.alive = false;
    u.buffs = []; u.dots = []; u.hots = []; u.cc = null; u.shield = 0;
    emit({ e: 'death', uid: u.uid });
    if (killer && killer.alive) {
      gainEnergy(killer, BATTLE.ENERGY_KILL);
      const rk = killer.passive.rageOnKill;
      if (rk) gainEnergy(killer, rk);
    }
    checkEnd();
  }

  // ---- 效果执行 ----
  function castUlt(u) {
    u.energy = 0;
    const fx = u.ult.effects || [];
    const scope = fx.some(f => f.tgt === 'allEnemies') ? 'all'
      : fx.some(f => f.tgt === 'frontRow' || f.tgt === 'backRow') ? 'row' : 'single';
    emit({ e: 'ult', uid: u.uid, skill: u.ult.name, scope });
    for (const f of fx) applyEffect(u, f);
  }
  function applyEffect(src, fx) {
    const tgts = resolveTargets(src, fx.tgt);
    switch (fx.t) {
      case 'dmg': {
        const hits = fx.hits || 1;
        for (let i = 0; i < hits; i++) {
          let list = tgts.filter(x => x.alive);
          if (fx.tgt === 'randEach') list = resolveTargets(src, 'randEach');
          if (fx.tgt === 'lowestEnemy') { const t = resolveTargets(src, 'lowestEnemy')[0]; list = t ? [t] : []; }
          if (fx.tgt === 'strongestEnemy') { const t = resolveTargets(src, 'strongestEnemy')[0]; list = t ? [t] : []; }
          if (!list.length) break;
          for (const t of list) {
            if (!t.alive) continue;
            applyDamage(src, t, effStat(src, 'atk') * fx.mult, { ls: fx.ls || 0, execute: fx.execute, kind: 'ult' });
          }
        }
        break;
      }
      case 'heal': {
        for (const t of tgts) healHp(t, effStat(src, 'atk') * fx.mult * (1 + (src.passive.heal || 0)));
        break;
      }
      case 'hot': {
        for (const t of tgts) t.hots.push({ perTick: effStat(src, 'atk') * fx.mult * (1 + (src.passive.heal || 0)), remaining: fx.dur, acc: 0 });
        break;
      }
      case 'shield': {
        for (const t of tgts) {
          t.shield += Math.floor(effStat(src, 'atk') * fx.mult);
          emit({ e: 'shield', uid: t.uid, amount: Math.floor(effStat(src, 'atk') * fx.mult) });
        }
        break;
      }
      case 'buff': {
        for (const t of tgts) addBuff(t, fx.stat, fx.pct, fx.dur);
        break;
      }
      case 'debuff': {
        for (const t of tgts) addBuff(t, fx.stat, -fx.pct, fx.dur);
        break;
      }
      case 'cc': {
        for (const t of tgts) {
          if (!t.alive) continue;
          t.cc = { kind: fx.kind, remaining: fx.dur };
          emit({ e: 'cc', uid: t.uid, kind: fx.kind, dur: fx.dur });
        }
        break;
      }
      case 'dot': {
        for (const t of tgts) {
          if (!t.alive) continue;
          t.dots.push({ kind: fx.kind, perTick: effStat(src, 'atk') * fx.mult, remaining: fx.dur, acc: 0, src: src.uid });
        }
        break;
      }
      case 'energy': {
        for (const t of tgts) gainEnergy(t, fx.amt);
        break;
      }
    }
  }
  function addBuff(u, stat, pct, dur) {
    if (!u.alive) return;
    const ex = u.buffs.find(b => b.stat === stat);
    if (ex) { ex.pct = pct; ex.remaining = dur; }
    else u.buffs.push({ stat, pct, remaining: dur });
  }

  function normalAttack(u) {
    const t = defaultTarget(u);
    if (!t) return;
    emit({ e: 'act', uid: u.uid, type: 'atk', tgt: t.uid });
    applyDamage(u, t, effStat(u, 'atk'), { kind: 'atk' });
    gainEnergy(u, BATTLE.ENERGY_ATK);
  }

  function checkEnd() {
    if (ended) return;
    if (!aliveOf('A').length) { ended = true; winner = 'B'; emit({ e: 'end', winner: 'B', duration: time }); }
    else if (!aliveOf('B').length) { ended = true; winner = 'A'; emit({ e: 'end', winner: 'A', duration: time }); }
  }

  const events = [];
  function step(dt) {
    if (ended) return { events: [], done: true, winner };
    const out = [];
    // swap & clear
    events.length = 0;
    time += dt;
    for (const tag of ['A', 'B']) {
      for (const u of sides[tag]) {
        if (!u.alive) continue;
        // buff/cc/dot 计时
        for (const b of u.buffs) b.remaining -= dt;
        u.buffs = u.buffs.filter(b => b.remaining > 0);
        // hot/dot 结算不受控制状态影响
        for (const h of u.hots) { h.acc += dt; while (h.acc >= 1) { h.acc -= 1; healHp(u, h.perTick); } }
        u.hots = u.hots.filter(h => h.remaining - dt > -1);
        for (const h of u.hots) h.remaining -= dt;
        u.hots = u.hots.filter(h => h.remaining > 0);
        for (const d of u.dots) {
          d.acc += dt;
          while (d.acc >= 1 && u.alive) {
            d.acc -= 1;
            dealRaw(u, Math.max(1, Math.floor(d.perTick)), 'dot:' + d.kind);
          }
        }
        u.dots = u.dots.filter(d => d.remaining - dt > -1 && u.alive);
        for (const d of u.dots) d.remaining -= dt;
        u.dots = u.dots.filter(d => d.remaining > 0);
        if (!u.alive) continue;
        // 控制状态：硬控（眩晕/冰冻）跳过行动；沉默只禁大招（下方满怒分支处理）
        if (u.cc) {
          u.cc.remaining -= dt;
          if (u.cc.remaining <= 0) { u.cc = null; emit({ e: 'ccEnd', uid: u.uid }); }
          else if (u.cc.kind !== 'silence') continue;
        }
        // 行动
        u.actTimer -= dt;
        if (u.actTimer <= 0) {
          const interval = BATTLE.BASE_ATTACK_INTERVAL / Math.max(0.3, effStat(u, 'spd'));
          if (u.energy >= BATTLE.ENERGY_MAX && !u.cc) {
            if (u.passive && hasSilence(u)) { normalAttack(u); }
            else castUlt(u);
          } else {
            normalAttack(u);
          }
          u.actTimer = interval;
        }
      }
    }
    if (time >= limit && !ended) {
      ended = true; winner = 'B';
      emit({ e: 'end', winner: 'B', duration: time, timeout: true });
    }
    checkEnd();
    return { events: events.slice(), done: ended, winner, time };
  }
  function hasSilence(u) { return u.cc && u.cc.kind === 'silence'; }

  function snapshot() {
    const out = [];
    for (const tag of ['A', 'B']) {
      for (const u of sides[tag]) {
        out.push({
          uid: u.uid, side: tag, slot: u.slot, name: u.name, hp: Math.floor(u.hp), maxHp: u.maxHp,
          shield: Math.floor(u.shield), energy: Math.floor(u.energy), alive: u.alive,
          cc: u.cc ? u.cc.kind : null, dots: u.dots.length
        });
      }
    }
    return out;
  }
  function result() {
    return { winner, duration: Math.round(time * 10) / 10, stats };
  }
  return { step, snapshot, result, get ended() { return ended; } };
}

// 由武将定义+等级+星+装备生成战斗单元
function buildUnit(calc, uid, row) {
  return {
    uid, heroId: calc.id, name: calc.name, faction: calc.faction, cls: calc.cls,
    level: calc.level, star: calc.star, row: row !== undefined ? row : calc.row,
    stats: calc.stats, ult: calc.ult, passive: calc.passive, isBoss: calc.isBoss || false
  };
}
module.exports = { createBattle, buildUnit };
