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
  const divAmount = toNumber(raw.divAmount);   // 每股配息
  const shares = toNumber(raw.shares);
  const buyCost = toNumber(raw.buyCost);       // 每股均價
  const totalDividend = divAmount * (shares > 0 ? shares : 1);  // 總配息
  const premium = calculateHealthPremium(totalDividend);
  return {
    id: raw.id || Date.now() + Math.random(),
    stockName: raw.stockName || '',
    category: raw.category || 'stable',
    divDate: raw.divDate,
    divAmount,           // 每股配息（原始欄位，供殖利率計算用）
    shares,
    buyCost,             // 每股均價
    totalDividend,       // 總配息 = 每股配息 × 股數
    yieldPct: calculateYield(divAmount, buyCost),
    premium,             // 補充保費（依總配息計算）
    netAmount: Math.max(totalDividend - premium, 0),
    remarks: raw.remarks || '',
    createdAt: raw.createdAt || new Date().toISOString()
  };
}
