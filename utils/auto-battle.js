// 自动出征状态机。纯逻辑：不调用平台、存档、战斗引擎、UI 或计时器。
// transition(state, event, options) -> { state, commands, ignored? }

const CONFIG = require('./config');
const DEFAULTS = Object.assign({ maxLevel: CONFIG.MAX_LEVEL }, CONFIG.AUTO_BATTLE || {});

function createState() {
  return {
    status: 'idle',
    sessionToken: 0,
    sessionMode: null,
    currentMode: null,
    campaignIndex: null,
    recoveryRounds: 0,
    trainingStartLevel: null,
    trainingWins: 0,
    trainingPurpose: null,
    trainingLevelGain: 2,
    trainingMaxWins: 10,
    delayRemaining: 0,
    launchSeq: 0,
    awaitingStart: false,
    currentBattleId: null,
    lastHandledBattleId: null,
    stopAfterBattle: false,
    resumeStatus: null,
    pauseReasons: {},
    reason: null
  };
}

function transition(input, event, options) {
  const cfg = Object.assign({}, DEFAULTS, options || {});
  const state = cloneState(input || createState());
  const commands = [];
  event = event || {};
  const type = event.type;
  const ignored = (why) => ({ state, commands, ignored: why });

  if (type === 'start') {
    if (isRunning(state)) return ignored('already-running');
    state.sessionToken += 1;
    state.sessionMode = event.mode === 'training' ? 'training' : 'campaign';
    state.currentMode = state.sessionMode;
    state.campaignIndex = state.sessionMode === 'campaign'
      ? positiveInt(event.index || event.cleared + 1, 1) : null;
    state.recoveryRounds = 0;
    state.trainingWins = 0;
    state.stopAfterBattle = false;
    state.reason = null;
    if (state.sessionMode === 'training') {
      if (levelOf(event.level) >= cfg.maxLevel) return stop(state, commands, 'level-max');
      beginTraining(state, 'independent', event.level, cfg);
    }
    launch(state, commands, state.currentMode, state.campaignIndex);
    return { state, commands };
  }

  if (type === 'battleStarted') {
    if (!matchesSession(state, event) || !state.awaitingStart || state.status !== 'fighting') return ignored('stale-start');
    if (!event.ok || !event.battleId) return stop(state, commands, event.reason || 'battle-start-failed');
    state.awaitingStart = false;
    state.currentBattleId = event.battleId;
    return { state, commands };
  }

  if (type === 'settled') {
    if (!matchesSession(state, event)) return ignored('stale-session');
    const battleId = event.battleId;
    if (!battleId || battleId === state.lastHandledBattleId || battleId !== state.currentBattleId) return ignored('stale-or-duplicate-settlement');
    if (!event.ok) return stop(state, commands, event.reason || 'settlement-failed');
    const summary = event.summary || event;
    const outcome = summary.outcome || (event.win === true ? 'win' : event.win === false ? 'loss' : null);
    if (outcome !== 'win' && outcome !== 'loss') return stop(state, commands, 'invalid-settlement');
    state.lastHandledBattleId = battleId;
    state.currentBattleId = null;

    if (state.stopAfterBattle) return stop(state, commands, 'stopped-after-battle');

    if (state.currentMode === 'campaign') {
      if (outcome === 'win') {
        state.campaignIndex += 1;
        state.recoveryRounds = 0;
        scheduleNext(state, cfg);
        return { state, commands };
      }
      const level = levelOf(summary.levelAfter !== undefined ? summary.levelAfter : event.level);
      if (level >= cfg.maxLevel) return stop(state, commands, 'level-max');
      if (state.recoveryRounds >= cfg.recoveryMaxRounds) return stop(state, commands, 'recovery-exhausted');
      state.recoveryRounds += 1;
      beginTraining(state, 'recovery', level, cfg);
      launch(state, commands, 'training', null);
      return { state, commands };
    }

    if (state.currentMode === 'training') {
      if (outcome !== 'win') return stop(state, commands, 'training-loss');
      const gainedXP = Number(summary.gainedXP || 0);
      const level = levelOf(summary.levelAfter !== undefined ? summary.levelAfter : event.level);
      if (gainedXP <= 0 && level < cfg.maxLevel) return stop(state, commands, 'training-no-xp');
      state.trainingWins += 1;
      const targetLevel = Math.min(state.trainingStartLevel + state.trainingLevelGain, cfg.maxLevel);
      const reachedLevel = level >= targetLevel;
      const reachedWins = state.trainingWins >= state.trainingMaxWins;
      if (reachedLevel || reachedWins || level >= cfg.maxLevel) {
        if (state.trainingPurpose === 'recovery') {
          state.currentMode = 'campaign';
          launch(state, commands, 'campaign', state.campaignIndex);
        } else {
          stop(state, commands, reachedLevel ? 'training-level-target' : (level >= cfg.maxLevel ? 'level-max' : 'training-win-limit'));
        }
        return { state, commands };
      }
      launch(state, commands, 'training', null);
      return { state, commands };
    }
    return stop(state, commands, 'unknown-mode');
  }

  if (type === 'tick') {
    if (state.status !== 'resultDelay') return ignored('not-waiting');
    const dt = Math.max(0, Number(event.dt) || 0);
    state.delayRemaining = Math.max(0, state.delayRemaining - dt);
    if (state.delayRemaining <= 1e-9) launch(state, commands, state.currentMode, state.campaignIndex);
    return { state, commands };
  }

  if (type === 'pause') {
    if (!isRunning(state)) return ignored('not-running');
    const reason = String(event.reason || 'manual');
    state.pauseReasons[reason] = true;
    if (state.status !== 'suspended') {
      state.resumeStatus = state.status;
      state.status = 'suspended';
    }
    return { state, commands };
  }

  if (type === 'resume') {
    const reason = String(event.reason || 'manual');
    if (state.status !== 'suspended' || !state.pauseReasons[reason]) return ignored('pause-reason-mismatch');
    delete state.pauseReasons[reason];
    if (Object.keys(state.pauseReasons).length === 0) {
      state.status = state.resumeStatus || 'fighting';
      state.resumeStatus = null;
    }
    return { state, commands };
  }

  if (type === 'stop') {
    if ((state.status === 'fighting' || state.status === 'suspended') && (state.currentBattleId || state.awaitingStart)) {
      if (state.currentBattleId) commands.push({ type: 'interruptBattle', battleId: state.currentBattleId, sessionToken: state.sessionToken });
      return stop(state, commands, event.reason || 'stopped');
    }
    return stop(state, commands, event.reason || 'stopped');
  }

  if (type === 'stopAfterBattle') {
    if (!isRunning(state)) return ignored('not-running');
    if (state.status === 'resultDelay') return stop(state, commands, 'stopped-between-battles');
    state.stopAfterBattle = true;
    return { state, commands };
  }

  return ignored('unknown-event');
}

function launch(state, commands, mode, index) {
  state.status = 'fighting';
  state.currentMode = mode;
  state.currentBattleId = null;
  state.awaitingStart = true;
  state.launchSeq += 1;
  commands.push({
    type: 'startBattle', mode, index: mode === 'campaign' ? index : undefined,
    sessionToken: state.sessionToken, launchId: state.launchSeq
  });
}

function scheduleNext(state, cfg) {
  state.status = 'resultDelay';
  state.awaitingStart = false;
  state.delayRemaining = Math.max(0, Number(cfg.resultDelaySeconds) || 0);
}

function beginTraining(state, purpose, level, cfg) {
  state.currentMode = 'training';
  state.trainingPurpose = purpose;
  state.trainingStartLevel = levelOf(level);
  state.trainingWins = 0;
  state.trainingLevelGain = purpose === 'recovery' ? cfg.recoveryLevelGain : cfg.trainingBatchLevelGain;
  state.trainingMaxWins = purpose === 'recovery' ? cfg.recoveryMaxWins : cfg.trainingBatchMaxWins;
}

function stop(state, commands, reason) {
  state.status = 'stopped';
  state.reason = reason;
  state.currentBattleId = null;
  state.awaitingStart = false;
  state.delayRemaining = 0;
  state.resumeStatus = null;
  state.pauseReasons = {};
  state.stopAfterBattle = false;
  commands.push({ type: 'stopped', reason, sessionToken: state.sessionToken });
  return { state, commands };
}

function matchesSession(state, event) {
  return event.sessionToken === undefined || event.sessionToken === state.sessionToken;
}
function isRunning(state) {
  return ['fighting', 'resultDelay', 'suspended'].indexOf(state.status) >= 0;
}
function levelOf(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
}
function positiveInt(value, fallback) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
function cloneState(state) {
  const next = Object.assign(createState(), state || {});
  next.pauseReasons = Object.assign({}, next.pauseReasons || {});
  return next;
}

module.exports = { createState, transition };
