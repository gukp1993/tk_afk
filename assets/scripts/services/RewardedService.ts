import * as config from '../domain/config';
import * as store from '../domain/store';
import * as platform from '../domain/platform';
import * as bridge from './RewardedBridge';

export function remaining(placement: string) {
  const setting = config.AD.placements[placement];
  return setting ? Math.max(0, setting.limit - store.adCount(placement)) : 0;
}

export function configured() {
  return !!(config.AD.rewardedUnitIds[platform.name] && bridge.available());
}

export async function showConfigured(placement: string): Promise<boolean> {
  if (!configured() || remaining(placement) <= 0) return false;
  const unitId = config.AD.rewardedUnitIds[platform.name];
  const result = await bridge.createRewarded(unitId).show();
  if (!result.ended) return false;
  store.adBump(placement);
  store.save();
  return true;
}
