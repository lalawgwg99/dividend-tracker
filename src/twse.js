/**
 * 台股資料查詢 — 使用 FinMind 開源 API
 * https://finmindtrade.com/
 * 免費方案：無需 API Key，每日 600 次請求
 */

const FINMIND = 'https://api.finmindtrade.com/api/v4/data';

const CACHE_NAME  = 'finmind_name_';    // key = stockCode
const CACHE_DIV   = 'finmind_div_';     // key = stockCode
const TTL = 6 * 60 * 60 * 1000;        // 6 小時快取

/* ── 快取工具 ── */
function getCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return (Date.now() - ts < TTL) ? data : null;
  } catch { return null; }
}
function setCache(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); }
  catch { /* sessionStorage 滿了就跳過 */ }
}

/* ── 通用 fetch ── */
async function finmindFetch(params) {
  const url = `${FINMIND}?${new URLSearchParams(params)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FinMind 回應 ${res.status}`);
  const json = await res.json();
  if (json.status !== 200) throw new Error(json.msg || '查詢失敗');
  return json.data;
}

/**
 * 查詢股票名稱
 * dataset: TaiwanStockInfo
 * 回傳 "台積電" 或 null
 */
export async function lookupStockName(code) {
  const cacheKey = CACHE_NAME + code;
  const cached = getCache(cacheKey);
  if (cached !== null) return cached;

  const data = await finmindFetch({
    dataset: 'TaiwanStockInfo',
    data_id: code,
  });

  const name = data?.[0]?.stock_name || null;
  setCache(cacheKey, name);
  return name;
}

/**
 * 查詢股票歷年配息記錄
 * dataset: TaiwanStockDividend
 *
 * 回傳陣列，每筆：
 *   { year, cashPerShare, stockPerShare, exDivDate, payDate }
 */
export async function fetchDividendsForStock(code) {
  const cacheKey = CACHE_DIV + code;
  const cached = getCache(cacheKey);
  if (cached !== null) return cached;

  // 抓近 10 年資料
  const startDate = `${new Date().getFullYear() - 10}-01-01`;
  const data = await finmindFetch({
    dataset:    'TaiwanStockDividend',
    data_id:    code,
    start_date: startDate,
  });

  const result = data
    .map(d => {
      const cash =
        (parseFloat(d.CashEarningsDistribution)  || 0) +
        (parseFloat(d.CashStatutorySurplus)       || 0);
      const stock =
        (parseFloat(d.StockEarningsDistribution)  || 0) +
        (parseFloat(d.StockStatutorySurplus)       || 0);

      return {
        year:         d.year || '',
        cashPerShare: Math.round(cash  * 100000) / 100000,
        stockPerShare:Math.round(stock * 100000) / 100000,
        exDivDate:    d.CashExDividendTradingDate || '',  // 除息日
        payDate:      d.CashDividendPaymentDate   || '',  // 配息入帳日
        announceDate: d.AnnouncementDate          || '',
      };
    })
    .filter(d => d.cashPerShare > 0 || d.stockPerShare > 0)
    .sort((a, b) => (b.exDivDate > a.exDivDate ? 1 : -1));

  setCache(cacheKey, result);
  return result;
}

/**
 * 從輸入字串擷取股票代號（取開頭 4-6 位數字）
 * "2330 台積電" → "2330"
 */
export function extractCode(str) {
  const m = (str || '').trim().match(/^(\d{4,6})/);
  return m ? m[1] : '';
}
