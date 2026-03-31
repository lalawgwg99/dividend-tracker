import { HEALTH_PREMIUM_RATE, HEALTH_PREMIUM_THRESHOLD } from './config.js';

export function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function calculateYield(divAmount, buyCost) {
  if (!buyCost || buyCost <= 0) return 0;
  return (divAmount / buyCost) * 100;
}

export function calculateHealthPremium(divAmount) {
  if (divAmount > HEALTH_PREMIUM_THRESHOLD) {
    return divAmount * HEALTH_PREMIUM_RATE;
  }
  return 0;
}

export function enrichDividend(raw) {
  const divAmount = toNumber(raw.divAmount);
  const shares = toNumber(raw.shares);
  const buyCost = toNumber(raw.buyCost);
  const premium = calculateHealthPremium(divAmount);
  return {
    id: raw.id || Date.now() + Math.random(),
    stockName: raw.stockName || '',
    category: raw.category || 'stable',
    divDate: raw.divDate,
    divAmount,
    shares,
    buyCost,
    yieldPct: calculateYield(divAmount, buyCost),
    premium,
    netAmount: Math.max(divAmount - premium, 0),
    remarks: raw.remarks || '',
    createdAt: raw.createdAt || new Date().toISOString()
  };
}
