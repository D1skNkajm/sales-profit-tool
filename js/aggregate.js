export function aggregateSales(rows) {
  const total = {quantity: 0, revenue: 0, cogs: 0, profit: 0, margin: null};
  const skus = new Map(), months = new Map();
  for (const row of rows) {
    const revenue = row.quantity * row.price, cogs = row.quantity * row.cost;
    const add = target => {
      target.quantity += row.quantity; target.revenue += revenue; target.cogs += cogs;
      if (![target.quantity, target.revenue, target.cogs].every(n => Number.isFinite(n) && n <= Number.MAX_SAFE_INTEGER)) throw new Error('合計が計算可能な範囲を超えています。');
      target.profit = target.revenue - target.cogs;
      target.margin = target.revenue === 0 ? null : target.profit / target.revenue * 100;
    };
    add(total);
    for (const [map, key] of [[skus, row.sku], [months, row.date.slice(0,7)]]) {
      if (!map.has(key)) map.set(key, {key, quantity: 0, revenue: 0, cogs: 0, profit: 0, margin: null});
      add(map.get(key));
    }
  }
  return {total, skus: [...skus.values()].sort((a,b) => b.revenue - a.revenue), months: [...months.values()].sort((a,b) => a.key.localeCompare(b.key))};
}
