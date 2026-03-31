import { STORAGE_KEYS } from './config.js';
import { enrichDividend } from './calculations.js';

function parseList(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

export function loadState() {
  const v2 = parseList(STORAGE_KEYS.dividends);
  const legacy = parseList(STORAGE_KEYS.legacyDividends);
  const rawDividends = v2.length > 0 ? v2 : legacy;
  const dividends = rawDividends.map(enrichDividend).filter(d => d.stockName && d.divDate && d.divAmount > 0);
  const forecasts = parseList(STORAGE_KEYS.forecasts);
  return { dividends, forecasts };
}

export function saveState({ dividends, forecasts }) {
  localStorage.setItem(STORAGE_KEYS.dividends, JSON.stringify(dividends));
  localStorage.setItem(STORAGE_KEYS.forecasts, JSON.stringify(forecasts));
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEYS.legacyDividends);
  localStorage.removeItem(STORAGE_KEYS.dividends);
  localStorage.removeItem(STORAGE_KEYS.forecasts);
}
