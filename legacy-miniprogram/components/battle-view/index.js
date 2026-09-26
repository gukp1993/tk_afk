// 战斗渲染组件：绝对定位 10 名武将 + 飘字 + 大招横幅 + 屏幕效果
const B = require('../../utils/battle');
const C = require('../../utils/config');
const H = require('../../utils/heroes');

// 单位中心坐标（rpx），B 为敌方(上方)，A 为我方(下方)
const POS = {
  B3: { x: 255, y: 120 }, B4: { x: 495, y: 120 },
  B0: { x: 150, y: 330 }, B1: { x: 375, y: 330 }, B2: { x: 600, y: 330 },
  A0: { x: 150, y: 600 }, A1: { x: 375, y: 600 }, A2: { x: 600, y: 600 },
  A3: { x: 255, y: 810 }, A4: { x: 495, y: 810 }
};
const CC_ICON = { stun: '✦', freeze: '❄', silence: '🔇' };

Component({
  data: {
    units: [], fx: [], banner: null, flash: false, shake: false,
    timeLeft: C.BATTLE.TIME_LIMIT, running: false, speed: 1, title: ''
  },
  lifetimes: {
    detached() { this.teardown(); }
  },
  methods: {
    start(cfg) {
      this.teardown();
      this.fxId = 0;
      this.timeouts = [];
      this.cfg = cfg || {};
      this.engine = B.createBattle({
        team: cfg.team, enemy: cfg.enemy,
        seed: cfg.seed || (Date.now() % 1000000),
        timeLimit: cfg.timeLimit
      });
      const units = this.buildMeta(cfg.team, cfg.enemy);
      this.setData({
        units, fx: [], banner: null, flash: false, shake: false,
        timeLeft: C.BATTLE.TIME_LIMIT, running: true,
        speed: this.cfg.speed || 1, title: this.cfg.title || '遭遇战'
      });
      this.timer = setInterval(() => this.tick(), 100);
    },
    buildMeta(team, enemy) {
      return team.concat(enemy).map(u => {
        const pos = POS[u.uid] || { x: 375, y: 300 };
        const h = H.getHero(u.heroId);
        return {
          uid: u.uid, side: u.uid.charAt(0), heroId: u.heroId,
          name: u.name, surname: (u.name || '').slice(0, 1),
          faction: u.faction, rarity: h ? h.rarity : 1, isBoss: !!u.isBoss,
          x: pos.x, y: pos.y, hp: u.stats.hp, maxHp: u.stats.hp,
          shield: 0, energy: 0, alive: true, cc: null, acting: '', glowing: false
        };
      });
    },
    teardown() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      (this.timeouts || []).forEach(t => clearTimeout(t));
      this.timeouts = [];
      this.engine = null;
      this.setData({ running: false });
    },
    later(fn, ms) {
      const t = setTimeout(() => {
        this.timeouts = (this.timeouts || []).filter(x => x !== t);
        fn();
      }, ms);
      this.timeouts.push(t);
    },
    setSpeed() {
      const next = this.data.speed >= 4 ? 1 : this.data.speed * 2;
      this.setData({ speed: next });
    },
    skip() {
      if (!this.engine || this.engine.ended) return;
      let guard = 0;
      let r;
      while (!this.engine.ended && guard++ < 4000) r = this.engine.step(0.25);
      this.teardown();
      this.setData({ running: false, over: true });
      const res = this.engine ? this.engine.result() : (r ? { winner: r.winner, duration: r.time, stats: {} } : { winner: 'B', duration: 0, stats: {} });
      this.triggerEvent('finish', { winner: res.winner, duration: res.duration, stats: res.stats, skipped: true });
    },
    retreat() {
      this.teardown();
      this.triggerEvent('retreat');
    },
    tick() {
      if (!this.engine || this.engine.ended) { this.teardown(); return; }
      const speed = this.data.speed;
      let events = [], r = null;
      for (let i = 0; i < speed; i++) {
        r = this.engine.step(0.1);
        events = events.concat(r.events);
        if (r.done) break;
      }
      this.applyEvents(events);
      // 同步动态状态
      const snap = {};
      this.engine.snapshot().forEach(s => { snap[s.uid] = s; });
      const patch = {};
      this.data.units.forEach((u, i) => {
        const s = snap[u.uid];
        if (!s) return;
        if (s.hp !== u.hp) patch[`units[${i}].hp`] = s.hp;
        if (s.energy !== u.energy) patch[`units[${i}].energy`] = s.energy;
        if (s.shield !== u.shield) patch[`units[${i}].shield`] = s.shield;
        if (s.alive !== u.alive) patch[`units[${i}].alive`] = s.alive;
        if (s.cc !== u.cc) patch[`units[${i}].cc`] = s.cc;
      });
      patch.timeLeft = Math.max(0, Math.ceil(C.BATTLE.TIME_LIMIT - (r ? r.time : 0)));
      this.setData(patch);
      if (r && r.done) {
        const res = this.engine.result();
        this.teardown();
        this.setData({ running: false });
        this.triggerEvent('finish', { winner: res.winner, duration: res.duration, stats: res.stats });
      }
    },
    unitIdx(uid) {
      return this.data.units.findIndex(u => u.uid === uid);
    },
    applyEvents(events) {
      if (!events.length) return;
      const addFx = [];
      const patch = {};
      events.forEach(ev => {
        const idx = this.unitIdx(ev.uid);
        const u = idx >= 0 ? this.data.units[idx] : null;
        switch (ev.e) {
          case 'hit': {
            if (!u) break;
            const dot = (ev.kind || '').indexOf('dot') === 0;
            addFx.push({
              id: ++this.fxId, x: u.x, y: u.y - 55,
              text: (ev.crit ? '暴击 ' : '') + '-' + ev.amount,
              cls: ev.crit ? 'float-crit' : (dot ? 'float-dot' : 'float-dmg')
            });
            break;
          }
          case 'heal': {
            if (!u) break;
            addFx.push({ id: ++this.fxId, x: u.x, y: u.y - 55, text: '+' + ev.amount, cls: 'float-heal' });
            break;
          }
          case 'shield': {
            if (!u) break;
            addFx.push({ id: ++this.fxId, x: u.x, y: u.y - 55, text: '盾+' + ev.amount, cls: 'float-shield' });
            break;
          }
          case 'cheat': {
            if (!u) break;
            addFx.push({ id: ++this.fxId, x: u.x, y: u.y - 55, text: '龙胆！免死', cls: 'float-heal' });
            break;
          }
          case 'act': {
            const sidx = this.unitIdx(ev.src);
            if (sidx >= 0) {
              const su = this.data.units[sidx];
              patch[`units[${sidx}].acting`] = su.side === 'A' ? 'lunge-up' : 'lunge-down';
              this.later(() => {
                this.setData({ [`units[${sidx}].acting`]: '' });
              }, 340);
            }
            break;
          }
          case 'ult': {
            if (u) {
              patch[`units[${idx}].glowing`] = true;
              this.later(() => {
                this.setData({ [`units[${idx}].glowing`]: false });
              }, 1400);
            }
            this.setData({
              banner: { skill: ev.skill, who: u ? u.name : '', side: u ? u.side : 'A', scope: ev.scope }
            });
            this.later(() => { this.setData({ banner: null }); }, 1100);
            if (ev.scope === 'all') {
              this.setData({ flash: true });
              this.later(() => { this.setData({ flash: false }); }, 500);
              this.setData({ shake: true });
              this.later(() => { this.setData({ shake: false }); }, 320);
            }
            break;
          }
          case 'death': {
            if (u) addFx.push({ id: ++this.fxId, x: u.x, y: u.y - 40, text: '阵亡', cls: 'float-dmg' });
            break;
          }
        }
      });
      if (addFx.length) {
        const fx = this.data.fx.concat(addFx).slice(-24);
        this.setData({ fx });
        addFx.forEach(f => {
          this.later(() => {
            this.setData({ fx: this.data.fx.filter(x => x.id !== f.id) });
          }, 950);
        });
      }
      if (Object.keys(patch).length) this.setData(patch);
    }
  }
});
