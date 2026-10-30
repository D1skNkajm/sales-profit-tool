// Presentation transforms only: the original acquisition and aggregation stay unchanged.
export const PAGE_SIZE = 50;
export const SORT_LABELS = {revenue: '売上', profit: '粗利益', margin: '粗利益率', quantity: '販売数量'};

export function sortSkus(rows, key = 'revenue', direction = 'desc') {
  if (!Object.hasOwn(SORT_LABELS, key) || !['asc', 'desc'].includes(direction)) throw new Error('並べ替え条件が不正です。');
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    // Uncomputable rates are always last, including ascending order.
    if (a[key] === null && b[key] !== null) return 1;
    if (b[key] === null && a[key] !== null) return -1;
    return (a[key] - b[key]) * sign || a.key.localeCompare(b.key, 'ja');
  });
}

export function pageSkus(rows, requestedPage = 0) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(Math.max(0, Math.trunc(requestedPage) || 0), pages - 1);
  const start = page * PAGE_SIZE;
  return {rows: rows.slice(start, start + PAGE_SIZE), page, pages, start, end: Math.min(start + PAGE_SIZE, rows.length)};
}

export function chartDomain(months, mode) {
  let min = 0, max = 0;
  for (const month of months) {
    const values = mode === 'margin' ? [month.margin] : [month.revenue, month.profit];
    for (const value of values) {
      if (value === null) continue;
      min = Math.min(min, value); max = Math.max(max, value);
    }
  }
  return {min, max: min === max ? max + 1 : max};
}

export const yen = value => new Intl.NumberFormat('ja-JP', {style: 'currency', currency: 'JPY', maximumFractionDigits: 2}).format(value);
export const percent = value => value === null ? '計算不能' : `${value.toFixed(1)}%`;
export const profitText = value => value < 0 ? `${yen(value)}（赤字）` : yen(value);
