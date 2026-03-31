export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

export function formatDate(dateStr) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

export function formatGoogleDate(dateStr) {
  const date = new Date(dateStr);
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
}

export function formatMoney(value) {
  return `NT$ ${Number(value).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function getCategoryName(category) {
  const names = {
    stable: '💎 穩定配息',
    dividend: '💰 高股息',
    potential: '🚀 潛力股'
  };
  return names[category] || category;
}

export function getCategoryByShort(category) {
  if (typeof category === 'string') {
    if (category.includes('穩定')) return 'stable';
    if (category.includes('高股')) return 'dividend';
    if (category.includes('潛力')) return 'potential';
  }
  return 'stable';
}

export function parseCsvLine(line) {
  const out = [];
  let curr = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        curr += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(curr.trim());
      curr = '';
    } else {
      curr += ch;
    }
  }
  out.push(curr.trim());
  return out;
}

export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function icsEscape(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}
