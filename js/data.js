// Data acquisition is isolated so a future API adapter can return the same rows.
export async function readSalesFile(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error('CSVは10MB以下にしてください。');
  return parseSalesCSV(await file.text());
}
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === ',') { row.push(cell); cell = ''; closed = false; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = ''; closed = false;
    } else if (c === '"' && !cell && !closed) quoted = true;
    else { if (closed || c === '"') throw new Error('CSVの引用符の形式が不正です。'); cell += c; }
  }
  if (quoted) throw new Error('CSVの引用符が閉じられていません。');
  if (cell || row.length || closed) { row.push(cell); rows.push(row); }
  return rows;
}
const headers = ['SKU', '販売数量', '販売単価', '仕入原価', '販売日'];
export function parseSalesCSV(text) {
  const source = parseCSV(text);
  if (!source.length) throw new Error('CSVが空です。');
  const head = source.shift().map(v => v.trim());
  if (new Set(head).size !== head.length || headers.some(h => !head.includes(h))) throw new Error('ヘッダーには SKU,販売数量,販売単価,仕入原価,販売日 を重複なく指定してください。');
  const errors = [], rows = [];
  source.forEach((cells, i) => {
    if (cells.every(c => !c.trim())) return;
    const issues = []; const get = h => (cells[head.indexOf(h)] ?? '').trim();
    if (cells.length !== head.length) issues.push('列数がヘッダーと一致しません');
    const sku = get('SKU'); if (!sku) issues.push('SKUがありません');
    const numeric = (h, integer) => {
      const s = get(h), n = Number(s);
      if (!/^\d+(?:\.\d+)?$/.test(s) || !Number.isFinite(n) || n < 0 || (integer && !Number.isSafeInteger(n))) issues.push(`${h}は0以上の${integer ? '整数' : '数値'}で指定してください`);
      return n;
    };
    const quantity = numeric('販売数量', true), price = numeric('販売単価'), cost = numeric('仕入原価');
    const date = get('販売日'), d = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== date) issues.push('販売日は実在する日付（YYYY-MM-DD）で指定してください');
    if (![quantity * price, quantity * cost].every(n => Number.isFinite(n) && n <= Number.MAX_SAFE_INTEGER)) issues.push('金額が計算可能な範囲を超えています');
    if (issues.length) errors.push({row: i + 2, message: issues.join('／')});
    else rows.push({sku, quantity, price, cost, date});
  });
  if (!rows.length && !errors.length) throw new Error('データ行がありません。');
  return {rows, errors};
}
export function toCSV(rows) {
  return '\uFEFF' + rows.map(row => row.map(value => {
    let s = String(value ?? '');
    // Prevent spreadsheet formula execution in user-controlled text.
    if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}
