import { createMonthChart, createYearChart } from './charts.js';
import { calculateHealthPremium, calculateYield, enrichDividend, toNumber } from './calculations.js';
import { clearState, loadState, saveState } from './storage.js';
import {
  downloadFile,
  escapeHtml,
  formatDate,
  formatGoogleDate,
  formatMoney,
  getCategoryByShort,
  getCategoryName,
  icsEscape,
  parseCsvLine,
  todayISO
} from './utils.js';
import { lookupStockName, fetchDividendsForStock, extractCode } from './twse.js';

const state = {
  dividends: [],
  forecasts: [],
  editingId: null,
  sort: { key: 'divDate', dir: 'desc' },
  charts: { month: null, year: null }
};

const dom = {};

function init() {
  Object.assign(dom, {
    stockName: document.getElementById('stockName'),
    category: document.getElementById('category'),
    divDate: document.getElementById('divDate'),
    divAmount: document.getElementById('divAmount'),
    shares: document.getElementById('shares'),
    buyCost: document.getElementById('buyCost'),
    remarks: document.getElementById('remarks'),
    yieldPreview: document.getElementById('yieldPreview'),
    premiumPreview: document.getElementById('premiumPreview'),
    submitDividendBtn: document.getElementById('submitDividendBtn'),
    cancelEditBtn: document.getElementById('cancelEditBtn'),
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate'),
    filterStock: document.getElementById('filterStock'),
    searchInput: document.getElementById('searchInput'),
    tableBody: document.getElementById('tableBody'),
    emptyState: document.getElementById('emptyState'),
    holdingsBody: document.getElementById('holdingsBody'),
    holdingsEmpty: document.getElementById('holdingsEmpty'),
    forecastBody: document.getElementById('forecastBody'),
    forecastEmpty: document.getElementById('forecastEmpty'),
    nextThreeMonthsAmount: document.getElementById('nextThreeMonthsAmount'),
    totalAmount: document.getElementById('totalAmount'),
    totalCount: document.getElementById('totalCount'),
    avgAmount: document.getElementById('avgAmount'),
    premiumTotal: document.getElementById('premiumTotal'),
    currentYearLabel: document.getElementById('currentYearLabel'),
    previousYearLabel: document.getElementById('previousYearLabel'),
    currentYearTotal: document.getElementById('currentYearTotal'),
    previousYearTotal: document.getElementById('previousYearTotal'),
    yoyDelta: document.getElementById('yoyDelta'),
    forecastStock: document.getElementById('forecastStock'),
    forecastDate: document.getElementById('forecastDate'),
    forecastAmount: document.getElementById('forecastAmount'),
    forecastNotes: document.getElementById('forecastNotes'),
    fileInput: document.getElementById('fileInput'),
    backupInput: document.getElementById('backupInput'),
    toastWrap: document.getElementById('toastWrap')
  });

  bindEvents();

  const loaded = loadState();
  state.dividends = loaded.dividends;
  state.forecasts = loaded.forecasts;

  state.charts.month = createMonthChart(document.getElementById('chart').getContext('2d'));
  state.charts.year = createYearChart(document.getElementById('yearChart').getContext('2d'));

  renderAll();
  updateYieldPreview();
  registerServiceWorker();
}

function bindEvents() {
  dom.submitDividendBtn.addEventListener('click', upsertDividend);
  dom.cancelEditBtn.addEventListener('click', cancelEdit);
  dom.searchInput.addEventListener('input', applyFilter);
  dom.divAmount.addEventListener('input', updateYieldPreview);
  dom.shares.addEventListener('input', updateYieldPreview);
  dom.buyCost.addEventListener('input', updateYieldPreview);

  document.getElementById('applyFilterBtn').addEventListener('click', applyFilter);
  document.getElementById('clearFilterBtn').addEventListener('click', clearFilter);
  document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
  document.getElementById('triggerImportCsvBtn').addEventListener('click', () => dom.fileInput.click());
  dom.fileInput.addEventListener('change', importCSV);
  document.getElementById('clearAllBtn').addEventListener('click', clearAllData);

  document.getElementById('lookupDivBtn').addEventListener('click', lookupDividendData);
  document.getElementById('closeDivPicker').addEventListener('click', () => {
    document.getElementById('dividendPicker').style.display = 'none';
  });

  document.getElementById('addForecastBtn').addEventListener('click', addForecast);
  document.getElementById('exportIcsBtn').addEventListener('click', exportForecastICS);
  document.getElementById('exportGoogleCsvBtn').addEventListener('click', exportForecastGoogleCSV);

  document.getElementById('exportBackupBtn').addEventListener('click', exportBackupJson);
  document.getElementById('importBackupBtn').addEventListener('click', () => dom.backupInput.click());
  dom.backupInput.addEventListener('change', importBackupJson);
  document.getElementById('shareBackupBtn').addEventListener('click', shareBackup);
  document.getElementById('openDriveBtn').addEventListener('click', () => window.open('https://drive.google.com/drive/my-drive', '_blank'));
  document.getElementById('openIcloudBtn').addEventListener('click', () => window.open('https://www.icloud.com/iclouddrive/', '_blank'));

  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (state.sort.key === key) {
        state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort.key = key;
        state.sort.dir = key === 'stockName' ? 'asc' : 'desc';
      }
      renderTable();
    });
  });

  dom.tableBody.addEventListener('click', onDividendTableClick);
  dom.forecastBody.addEventListener('click', onForecastTableClick);
}

function upsertDividend() {
  const stockName = dom.stockName.value.trim();
  const divDate = dom.divDate.value;
  const divAmount = toNumber(dom.divAmount.value);
  const shares = toNumber(dom.shares.value);
  const buyCost = toNumber(dom.buyCost.value);
  const category = dom.category.value;
  const remarks = dom.remarks.value.trim();

  if (!stockName || !divDate || divAmount <= 0 || shares <= 0 || buyCost <= 0) {
    showToast('請填妥股票、日期、配息、股數與買入成本', 'warning');
    return;
  }

  const record = enrichDividend({
    id: state.editingId || Date.now(),
    stockName,
    category,
    divDate,
    divAmount,
    shares,
    buyCost,
    remarks,
    createdAt: new Date().toISOString()
  });

  if (state.editingId) {
    state.dividends = state.dividends.map(d => d.id === state.editingId ? record : d);
    showToast('已更新紀錄', 'success');
  } else {
    state.dividends.push(record);
    if (record.premium > 0) {
      showToast(`已加入，⚠️ 本筆補充保費 ${formatMoney(record.premium)}`, 'warning');
    } else {
      showToast('配息紀錄已加入', 'success');
    }
  }

  persistAndRender();
  resetForm();
}

function onDividendTableClick(event) {
  const target = event.target.closest('button[data-action]');
  if (!target) return;
  const id = Number(target.dataset.id);
  if (!id) return;

  if (target.dataset.action === 'edit') {
    editRecord(id);
    return;
  }

  if (target.dataset.action === 'delete') {
    if (!confirm('確定刪除此筆紀錄嗎？')) return;
    state.dividends = state.dividends.filter(d => d.id !== id);
    persistAndRender();
    showToast('已刪除紀錄', 'success');
  }
}

function editRecord(id) {
  const record = state.dividends.find(d => d.id === id);
  if (!record) return;
  state.editingId = id;
  dom.stockName.value = record.stockName;
  dom.category.value = record.category;
  dom.divDate.value = record.divDate;
  dom.divAmount.value = record.divAmount;
  dom.shares.value = record.shares;
  dom.buyCost.value = record.buyCost;
  dom.remarks.value = record.remarks || '';
  dom.submitDividendBtn.textContent = '💾 儲存修改';
  dom.cancelEditBtn.style.display = 'inline-flex';
  updateYieldPreview();
  if (window.openRecordForm) window.openRecordForm();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  resetForm();
  showToast('已取消編輯', 'warning');
}

function resetForm() {
  state.editingId = null;
  dom.stockName.value = '';
  dom.category.value = 'stable';
  dom.divDate.value = '';
  dom.divAmount.value = '';
  dom.shares.value = '';
  dom.buyCost.value = '';
  dom.remarks.value = '';
  dom.submitDividendBtn.textContent = '✅ 加入紀錄';
  dom.cancelEditBtn.style.display = 'none';
  updateYieldPreview();
}

function updateYieldPreview() {
  const divAmount = toNumber(dom.divAmount.value);
  const shares = toNumber(dom.shares.value);
  const buyCost = toNumber(dom.buyCost.value);
  const yieldValue = calculateYield(divAmount, buyCost);
  const totalDividend = divAmount * (shares > 0 ? shares : 0);
  const premium = calculateHealthPremium(totalDividend);

  if (yieldValue > 0) {
    dom.yieldPreview.textContent = `殖利率 ${yieldValue.toFixed(2)}%`;
    dom.yieldPreview.classList.toggle('yield-good', yieldValue > 5);
  } else {
    dom.yieldPreview.textContent = '殖利率 --';
    dom.yieldPreview.classList.remove('yield-good');
  }

  if (totalDividend > 0) {
    if (premium > 0) {
      dom.premiumPreview.textContent = `總配息 ${formatMoney(totalDividend)}・⚠️扣 ${formatMoney(premium)}`;
    } else {
      dom.premiumPreview.textContent = `總配息 ${formatMoney(totalDividend)}・免扣保費`;
    }
  } else {
    dom.premiumPreview.textContent = '總配息 --';
  }
}

async function lookupDividendData() {
  const rawInput = dom.stockName.value.trim();
  const code = extractCode(rawInput);
  if (!code) {
    showToast('請先輸入股票代號（如 2330）', 'warning');
    return;
  }

  const btn = document.getElementById('lookupDivBtn');
  const picker = document.getElementById('dividendPicker');
  btn.disabled = true;
  btn.textContent = '查詢中…';

  try {
    // 自動帶入股票名稱
    const name = await lookupStockName(code);
    if (name && !rawInput.includes(name)) {
      dom.stockName.value = `${code} ${name}`;
    }

    // 查詢配息記錄
    const records = await fetchDividendsForStock(code);
    const pickerTitle = document.getElementById('divPickerTitle');
    const pickerList  = document.getElementById('divPickerList');

    if (records.length === 0) {
      showToast(`${code} 近期無配息記錄（可能為未上市或無配息）`, 'warning');
      picker.style.display = 'none';
      return;
    }

    pickerTitle.textContent = `${name || code} 配息記錄（點選自動帶入）`;
    pickerList.innerHTML = records.map((r, i) => {
      const stockNote  = r.stockPerShare > 0 ? `・股票股利 ${r.stockPerShare} 元/股` : '';
      const exDivLabel = r.exDivDate ? `除息日 ${r.exDivDate}` : '';
      const payLabel   = r.payDate   ? `・配息日 ${r.payDate}` : '';
      return `
        <div class="div-picker-item" data-idx="${i}">
          <div class="div-picker-left">
            <div class="div-picker-year">${r.year} 年度</div>
            <div class="div-picker-meta">${exDivLabel}${payLabel}${stockNote}</div>
          </div>
          <div>
            <div class="div-picker-cash">${r.cashPerShare} 元/股</div>
            ${r.stockPerShare > 0 ? `<div class="div-picker-stock">+股票股利 ${r.stockPerShare} 元</div>` : ''}
          </div>
        </div>`;
    }).join('');

    // 點選帶入
    pickerList.querySelectorAll('.div-picker-item').forEach(el => {
      el.addEventListener('click', () => {
        const r = records[parseInt(el.dataset.idx)];
        dom.divAmount.value = r.cashPerShare;
        // 優先用配息入帳日，其次除息日
        const fillDate = r.payDate || r.exDivDate || '';
        if (fillDate) dom.divDate.value = fillDate;
        updateYieldPreview();
        picker.style.display = 'none';
        showToast(`已帶入 ${r.cashPerShare} 元/股，請確認股數與每股均價`, 'success');
      });
    });

    picker.style.display = 'block';
  } catch (err) {
    showToast(`查詢失敗：${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '📥 帶入';
  }
}

function addForecast() {
  const stockName = dom.forecastStock.value.trim();
  const payDate = dom.forecastDate.value;
  const amount = toNumber(dom.forecastAmount.value);
  const notes = dom.forecastNotes.value.trim();

  if (!stockName || !payDate || amount <= 0) {
    showToast('請填妥預告股票、日期、金額', 'warning');
    return;
  }

  state.forecasts.push({ id: Date.now(), stockName, payDate, amount, notes });
  dom.forecastStock.value = '';
  dom.forecastDate.value = '';
  dom.forecastAmount.value = '';
  dom.forecastNotes.value = '';

  persistAndRender();
  showToast('已加入配息預告', 'success');
}

function onForecastTableClick(event) {
  const target = event.target.closest('button[data-action="delete-forecast"]');
  if (!target) return;
  const id = Number(target.dataset.id);
  if (!id) return;
  if (!confirm('確定刪除這筆配息預告嗎？')) return;
  state.forecasts = state.forecasts.filter(f => f.id !== id);
  persistAndRender();
  showToast('已刪除預告', 'success');
}

function getFilteredDividends() {
  const startDate = dom.startDate.value;
  const endDate = dom.endDate.value;
  const filterStock = dom.filterStock.value;
  const searchInput = dom.searchInput.value.trim().toLowerCase();

  let filtered = [...state.dividends];
  if (startDate) filtered = filtered.filter(d => d.divDate >= startDate);
  if (endDate) filtered = filtered.filter(d => d.divDate <= endDate);
  if (filterStock) filtered = filtered.filter(d => d.stockName === filterStock);
  if (searchInput) {
    filtered = filtered.filter(d => d.stockName.toLowerCase().includes(searchInput) || (d.remarks || '').toLowerCase().includes(searchInput));
  }

  filtered.sort((a, b) => compareBySort(a, b, state.sort));
  return filtered;
}

function compareBySort(a, b, sort) {
  const key = sort.key;
  let va = key === 'yield' ? a.yieldPct : a[key];
  let vb = key === 'yield' ? b.yieldPct : b[key];

  if (key === 'divDate') {
    va = new Date(a.divDate).getTime();
    vb = new Date(b.divDate).getTime();
  }

  if (typeof va === 'string') {
    const result = va.localeCompare(vb, 'zh-Hant');
    return sort.dir === 'asc' ? result : -result;
  }

  const diff = toNumber(va) - toNumber(vb);
  return sort.dir === 'asc' ? diff : -diff;
}

function renderAll() {
  renderTable();
  renderHoldings();
  renderForecasts();
  renderTotals();
  renderStockFilter();
  updateCharts();
}

function renderTable() {
  const list = getFilteredDividends();
  if (list.length === 0) {
    dom.tableBody.innerHTML = '';
    dom.emptyState.style.display = 'block';
    return;
  }

  dom.emptyState.style.display = 'none';
  dom.tableBody.innerHTML = list.map(d => {
    const premiumTag = d.premium > 0
      ? `<span class="tag tag-warning">⚠️ 扣 ${formatMoney(d.premium)}</span>`
      : '<span class="tag tag-safe">免扣</span>';
    const yieldClass = d.yieldPct > 5 ? 'yield-good' : '';

    return `
      <tr>
        <td>${formatDate(d.divDate)}</td>
        <td><strong>${escapeHtml(d.stockName)}</strong></td>
        <td><span class="tag tag-${d.category}">${getCategoryName(d.category)}</span></td>
        <td style="color: var(--secondary); font-weight: 800;">${formatMoney(d.totalDividend)}</td>
        <td>${Math.round(d.shares).toLocaleString('zh-TW')}</td>
        <td>${formatMoney(d.buyCost)}</td>
        <td class="${yieldClass}" style="font-weight:700;">${d.yieldPct.toFixed(2)}%</td>
        <td style="color:#059669;font-weight:800;">${formatMoney(d.totalDividend)}</td>
        <td>${premiumTag}</td>
        <td style="font-weight:700;">${formatMoney(d.netAmount)}</td>
        <td>${escapeHtml(d.remarks || '-')}</td>
        <td>
          <div class="actions">
            <button class="btn btn-secondary" data-action="edit" data-id="${d.id}" style="padding:6px 10px;">✏️</button>
            <button class="btn btn-danger" data-action="delete" data-id="${d.id}" style="padding:6px 10px;">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderHoldings() {
  const byStock = new Map();
  state.dividends.forEach(d => {
    if (!byStock.has(d.stockName)) byStock.set(d.stockName, { stockName: d.stockName, totalCost: 0, totalDividend: 0 });
    const item = byStock.get(d.stockName);
    item.totalCost = Math.max(item.totalCost, d.buyCost * d.shares);
    item.totalDividend += d.totalDividend;
  });

  const rows = Array.from(byStock.values()).sort((a, b) => b.totalDividend - a.totalDividend);
  if (rows.length === 0) {
    dom.holdingsBody.innerHTML = '';
    dom.holdingsEmpty.style.display = 'block';
    return;
  }

  dom.holdingsEmpty.style.display = 'none';
  dom.holdingsBody.innerHTML = rows.map(row => {
    const progress = row.totalCost > 0 ? Math.min((row.totalDividend / row.totalCost) * 100, 100) : 0;
    const color = progress >= 50 ? '#059669' : progress >= 15 ? '#2563eb' : '#94a3b8';
    return `
      <div class="holding-item">
        <div class="holding-top">
          <span class="holding-name">${escapeHtml(row.stockName)}</span>
          <span class="holding-pct" style="color:${color}">${progress.toFixed(1)}%</span>
        </div>
        <div class="holding-bar-track">
          <div class="holding-bar-fill" style="width:${progress}%;background:${color};"></div>
        </div>
        <div class="holding-bottom">
          <span>成本 ${formatMoney(row.totalCost)}</span>
          <span style="color:#059669;font-weight:600;">已回收 ${formatMoney(row.totalDividend)}</span>
        </div>
      </div>`;
  }).join('');
}

function renderForecasts() {
  const sorted = [...state.forecasts].sort((a, b) => new Date(a.payDate) - new Date(b.payDate));
  if (sorted.length === 0) {
    dom.forecastBody.innerHTML = '';
    dom.forecastEmpty.style.display = 'block';
  } else {
    dom.forecastEmpty.style.display = 'none';
    dom.forecastBody.innerHTML = sorted.map(f => `
      <tr>
        <td>${formatDate(f.payDate)}</td>
        <td>${escapeHtml(f.stockName)}</td>
        <td style="font-weight:800;color:#0f766e;">${formatMoney(f.amount)}</td>
        <td>${escapeHtml(f.notes || '-')}</td>
        <td><button class="btn btn-danger" data-action="delete-forecast" data-id="${f.id}" style="padding:6px 10px;">🗑️</button></td>
      </tr>
    `).join('');
  }

  const now = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 3);
  const sum = state.forecasts
    .filter(f => {
      const d = new Date(f.payDate);
      return d >= now && d <= end;
    })
    .reduce((acc, f) => acc + toNumber(f.amount), 0);
  dom.nextThreeMonthsAmount.textContent = formatMoney(sum);
}

function renderTotals() {
  const filtered = getFilteredDividends();
  const total = filtered.reduce((sum, d) => sum + d.totalDividend, 0);
  const premiumTotal = filtered.reduce((sum, d) => sum + d.premium, 0);
  const count = filtered.length;
  const avg = count > 0 ? total / count : 0;

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const currentYearTotal = filtered.filter(d => new Date(d.divDate).getFullYear() === currentYear).reduce((sum, d) => sum + d.totalDividend, 0);
  const previousYearTotal = filtered.filter(d => new Date(d.divDate).getFullYear() === previousYear).reduce((sum, d) => sum + d.totalDividend, 0);
  const delta = currentYearTotal - previousYearTotal;

  dom.totalAmount.textContent = formatMoney(total);
  dom.totalCount.textContent = count.toLocaleString('zh-TW');
  dom.avgAmount.textContent = formatMoney(avg);
  dom.premiumTotal.textContent = formatMoney(premiumTotal);
  dom.currentYearLabel.textContent = `${currentYear} 年`;
  dom.previousYearLabel.textContent = `${previousYear} 年`;
  dom.currentYearTotal.textContent = formatMoney(currentYearTotal);
  dom.previousYearTotal.textContent = formatMoney(previousYearTotal);
  dom.yoyDelta.textContent = `${delta >= 0 ? '+' : '-'}${formatMoney(Math.abs(delta))}`;
  dom.yoyDelta.classList.remove('value-positive', 'value-negative');
  dom.yoyDelta.classList.add(delta >= 0 ? 'value-positive' : 'value-negative');
}

function renderStockFilter() {
  const selected = dom.filterStock.value;
  const stocks = [...new Set(state.dividends.map(d => d.stockName))].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  dom.filterStock.innerHTML = '<option value="">全部股票</option>' + stocks.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  if (stocks.includes(selected)) dom.filterStock.value = selected;
}

function updateCharts() {
  const filtered = getFilteredDividends();

  const byMonth = {};
  filtered.forEach(d => {
    const month = d.divDate.slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + d.totalDividend;
  });
  const monthLabels = Object.keys(byMonth).sort();
  state.charts.month.data.labels = monthLabels;
  state.charts.month.data.datasets[0].data = monthLabels.map(label => byMonth[label]);
  state.charts.month.update();

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const previous = filtered.filter(d => new Date(d.divDate).getFullYear() === previousYear).reduce((sum, d) => sum + d.totalDividend, 0);
  const current = filtered.filter(d => new Date(d.divDate).getFullYear() === currentYear).reduce((sum, d) => sum + d.totalDividend, 0);

  state.charts.year.data.labels = [`${previousYear}`, `${currentYear}`];
  state.charts.year.data.datasets[0].data = [previous, current];
  state.charts.year.update();
}

function applyFilter() {
  renderTable();
  renderTotals();
  updateCharts();
}

function clearFilter() {
  dom.startDate.value = '';
  dom.endDate.value = '';
  dom.filterStock.value = '';
  dom.searchInput.value = '';
  applyFilter();
  showToast('已重置篩選條件', 'success');
}

function clearAllData() {
  if (!confirm('警告：將刪除所有配息紀錄與預告，確定嗎？')) return;
  state.dividends = [];
  state.forecasts = [];
  clearState();
  renderAll();
  resetForm();
  showToast('所有資料已清除', 'success');
}

function exportCSV() {
  const list = getFilteredDividends();
  if (list.length === 0) {
    showToast('沒有可匯出的資料', 'warning');
    return;
  }

  const headers = ['配息日期', '股票名稱', '分類', '每股配息', '股數', '每股均價', '總配息', '殖利率%', '補充保費', '實拿', '備註'];
  const rows = list.map(d => [
    d.divDate,
    d.stockName,
    getCategoryName(d.category),
    d.divAmount.toFixed(2),
    d.shares,
    d.buyCost.toFixed(2),
    d.totalDividend.toFixed(2),
    d.yieldPct.toFixed(2),
    d.premium.toFixed(2),
    d.netAmount.toFixed(2),
    d.remarks || ''
  ]);

  const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(','))].join('\n');
  downloadFile(csv, `dividend_${todayISO()}.csv`, 'text/csv;charset=utf-8;');
  showToast('CSV 匯出完成', 'success');
}

function importCSV(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const lines = text.trim().split('\n');
    const records = [];

    lines.slice(1).forEach((line, index) => {
      const cells = parseCsvLine(line);
      const divDate = cells[0];
      const stockName = cells[1];
      const category = getCategoryByShort(cells[2]);
      const divAmount = toNumber(cells[3]);
      const shares = toNumber(cells[4]);
      const buyCost = toNumber(cells[5]);
      const remarks = cells[9] || '';

      if (divDate && stockName && divAmount > 0) {
        records.push(enrichDividend({
          id: Date.now() + index,
          stockName,
          category,
          divDate,
          divAmount,
          shares: shares > 0 ? shares : 1,
          buyCost: buyCost > 0 ? buyCost : divAmount,
          remarks,
          createdAt: new Date().toISOString()
        }));
      }
    });

    if (records.length === 0) {
      showToast('無法讀取 CSV 資料', 'error');
      return;
    }

    state.dividends = [...state.dividends, ...records];
    persistAndRender();
    showToast(`已匯入 ${records.length} 筆紀錄`, 'success');
  };

  reader.readAsText(file);
  event.target.value = '';
}

function exportBackupJson() {
  const backup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    dividends: state.dividends,
    forecasts: state.forecasts
  };
  downloadFile(JSON.stringify(backup, null, 2), `dividend_backup_${todayISO()}.json`, 'application/json;charset=utf-8;');
  showToast('雲端備份檔已匯出', 'success');
}

function importBackupJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || !Array.isArray(parsed.dividends)) throw new Error('格式錯誤');
      if (!confirm('將以備份覆蓋目前資料，確定還原嗎？')) return;

      state.dividends = parsed.dividends.map(enrichDividend).filter(d => d.stockName && d.divDate && d.divAmount > 0);
      state.forecasts = Array.isArray(parsed.forecasts) ? parsed.forecasts : [];
      persistAndRender();
      showToast('備份還原完成', 'success');
    } catch (error) {
      showToast(`備份檔讀取失敗：${error.message}`, 'error');
    }
  };

  reader.readAsText(file);
  event.target.value = '';
}

async function shareBackup() {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    dividends: state.dividends,
    forecasts: state.forecasts
  };
  const file = new File([JSON.stringify(payload, null, 2)], `dividend_backup_${todayISO()}.json`, { type: 'application/json' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: '股息記錄器備份',
        text: '請將此檔案存到 Google Drive 或 iCloud',
        files: [file]
      });
      showToast('已開啟分享，請選擇 Drive 或 iCloud', 'success');
    } catch {
      showToast('分享已取消', 'warning');
    }
  } else {
    exportBackupJson();
    showToast('此裝置不支援直接分享，已改為下載備份檔', 'warning');
  }
}

function exportForecastICS() {
  if (state.forecasts.length === 0) {
    showToast('沒有可匯出的預告資料', 'warning');
    return;
  }

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dividend Tracker Pro//TW//', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  state.forecasts.forEach(f => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${f.id}@dividend-tracker`);
    lines.push(`DTSTAMP:${todayISO().replaceAll('-', '')}T000000Z`);
    lines.push(`DTSTART;VALUE=DATE:${String(f.payDate).replaceAll('-', '')}`);
    lines.push(`SUMMARY:${icsEscape(`配息預告 ${f.stockName}`)}`);
    lines.push(`DESCRIPTION:${icsEscape(`預估配息 ${formatMoney(f.amount)}${f.notes ? ` / ${f.notes}` : ''}`)}`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');

  downloadFile(lines.join('\r\n'), `dividend_forecast_${todayISO()}.ics`, 'text/calendar;charset=utf-8;');
  showToast('iCal 檔已匯出', 'success');
}

function exportForecastGoogleCSV() {
  if (state.forecasts.length === 0) {
    showToast('沒有可匯出的預告資料', 'warning');
    return;
  }

  const headers = ['Subject', 'Start Date', 'All Day Event', 'Description'];
  const rows = state.forecasts.map(f => [
    `配息預告 ${f.stockName}`,
    formatGoogleDate(f.payDate),
    'True',
    `預估配息 ${formatMoney(f.amount)}${f.notes ? ` / ${f.notes}` : ''}`
  ]);

  const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(','))].join('\n');
  downloadFile(csv, `google_calendar_forecast_${todayISO()}.csv`, 'text/csv;charset=utf-8;');
  showToast('Google Calendar 匯入 CSV 已匯出', 'success');
}

function persistAndRender() {
  saveState({ dividends: state.dividends, forecasts: state.forecasts });
  renderAll();
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  dom.toastWrap.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      showToast('離線模式啟用失敗，請重新整理後再試', 'warning');
    });
  }
}

init();
