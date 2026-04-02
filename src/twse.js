// 台灣證交所 Open API 查詢工具
// 端點來源：https://openapi.twse.com.tw

const BASE  = 'https://openapi.twse.com.tw/v1';
const PROXY = 'https://corsproxy.io/?url=';   // CORS 代理（TWSE 直連有跨域限制）

const CACHE_STOCKS = 'twse_stocks_cache';
const CACHE_DIVS   = 'twse_dividends_cache';
const TTL = 4 * 60 * 60 * 1000; // 4 小時快取

/**
 * 帶 CORS fallback 的 fetch：
 * 1. 先試直連
 * 2. 若回傳 HTML（CORS 被擋）→ 改走 corsproxy.io
 */
async function fetchJSON(url) {
  // 先試直連
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await res.text();
    if (!text.trimStart().startsWith('<')) return JSON.parse(text);
  } catch { /* 直連失敗，繼續走 proxy */ }

  // 走 CORS proxy
  const res = await fetch(PROXY + encodeURIComponent(url));
  if (!res.ok) throw new Error(`伺服器回應 ${res.status}`);
  return res.json();
}

function getCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return (Date.now() - ts < TTL) ? data : null;
  } catch { return null; }
}

function setCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

/** 民國日期字串 → ISO 格式：1150522 → "2026-05-22" */
export function rocToISO(rocStr) {
  if (!rocStr || rocStr.length < 7) return '';
  const y = parseInt(rocStr.slice(0, 3), 10) + 1911;
  const m = rocStr.slice(3, 5);
  const d = rocStr.slice(5, 7);
  return `${y}-${m}-${d}`;
}

/**
 * 查詢股票名稱
 * 回傳 Map<股票代號, 股票名稱>，或單一名稱字串
 */
async function getStockMap() {
  let map = getCache(CACHE_STOCKS);
  if (!map) {
    const list = await fetchJSON(`${BASE}/exchangeReport/STOCK_DAY_ALL`);
    map = {};
    list.forEach(s => { map[s.Code] = s.Name; });
    setCache(CACHE_STOCKS, map);
  }
  return map;
}

export async function lookupStockName(code) {
  const map = await getStockMap();
  return map[code] || null;
}

/**
 * 查詢指定股票代號的配息記錄
 * 回傳陣列，每筆包含：
 *   year, period, cashPerShare, stockPerShare, meetingDate, progress
 */
export async function fetchDividendsForStock(code) {
  let all = getCache(CACHE_DIVS);
  if (!all) {
    all = await fetchJSON(`${BASE}/opendata/t187ap45_L`);
    setCache(CACHE_DIVS, all);
  }

  return all
    .filter(d => d['公司代號'] === code)
    .map(d => {
      // 每股現金配息 = 盈餘現金 + 法定公積現金 + 資本公積現金
      const cash =
        parseFloat(d['股東配發-盈餘分配之現金股利(元/股)']       || 0) +
        parseFloat(d['股東配發-法定盈餘公積發放之現金(元/股)']   || 0) +
        parseFloat(d['股東配發-資本公積發放之現金(元/股)']       || 0);

      // 每股股票股利（換算元/股，10元面額）
      const stock =
        parseFloat(d['股東配發-盈餘轉增資配股(元/股)']           || 0) +
        parseFloat(d['股東配發-法定盈餘公積轉增資配股(元/股)']   || 0) +
        parseFloat(d['股東配發-資本公積轉增資配股(元/股)']       || 0);

      return {
        year:         d['股利年度'],           // 民國年
        period:       d['股利所屬年(季)度'],   // 年度 / 季度
        cashPerShare: Math.round(cash  * 10000) / 10000,
        stockPerShare:Math.round(stock * 10000) / 10000,
        meetingDate:  rocToISO(d['股東會日期'] || ''),
        progress:     d['決議（擬議）進度'] || '',
      };
    })
    .filter(d => d.cashPerShare > 0 || d.stockPerShare > 0)
    .sort((a, b) => parseInt(b.year) - parseInt(a.year));
}

/** 從輸入字串擷取股票代號（取第一個 4-6 位數字串） */
export function extractCode(str) {
  const m = str.trim().match(/^(\d{4,6})/);
  return m ? m[1] : '';
}
