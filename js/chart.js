import {chartDomain, yen, percent, profitText} from './presentation.js';

export function renderChart(container, months, mode, selectedMonth, onSelect) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const width = Math.max(420, container.clientWidth, months.length * 74 + 80);
  svg.setAttribute('viewBox', `0 0 ${width} 232`);
  svg.style.minWidth = `${width}px`;
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', mode === 'margin' ? '月別の粗利益率。月を選択して数値を確認できます' : '月別の売上と粗利益。月を選択して数値を確認できます');
  const el = (tag, attrs, text, parent = svg) => {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    parent.append(node); return node;
  };
  const {min, max} = chartDomain(months, mode);
  const y = value => 184 - (value - min) / (max - min) * 160;
  const axis = value => mode === 'margin'
    ? `${new Intl.NumberFormat('ja-JP', {maximumFractionDigits: 1}).format(value)}%`
    : Math.abs(value) >= 10000
      ? `${new Intl.NumberFormat('ja-JP', {maximumFractionDigits: 1}).format(value / 10000)}万`
      : new Intl.NumberFormat('ja-JP', {maximumFractionDigits: 2}).format(value);
  el('text', {x: 65, y: 12, 'text-anchor': 'end'}, mode === 'margin' ? '粗利益率' : '円');
  for (let i = 0; i <= 4; i++) {
    const value = min + (max - min) * i / 4;
    el('line', {x1: 75, y1: y(value), x2: width - 8, y2: y(value), class: 'grid-line'});
    el('text', {x: 65, y: y(value) + 4, 'text-anchor': 'end'}, axis(value));
  }
  const step = (width - 84) / months.length;
  const groups = [];
  const select = key => {
    groups.forEach(group => group.setAttribute('aria-pressed', String(group.dataset.month === key)));
    onSelect(key);
  };
  months.forEach((month, i) => {
    const x = 78 + i * step, center = x + step / 2;
    const group = el('g', {class: 'month-hit', role: 'button', tabindex: 0, 'data-month': month.key,
      'aria-pressed': String(month.key === selectedMonth),
      'aria-label': `${month.key}、売上 ${yen(month.revenue)}、粗利益 ${profitText(month.profit)}、粗利益率 ${percent(month.margin)}`});
    groups.push(group);
    el('rect', {x, y: 19, width: step - 4, height: 208, rx: 4, class: 'selection'}, undefined, group);
    const values = mode === 'margin' ? [[month.margin, -10, 'margin-bar']] : [[month.revenue, -20, 'revenue-bar'], [month.profit, 3, 'profit-bar']];
    values.forEach(([value, offset, className]) => {
      if (value === null) {
        el('text', {x: center, y: y(0) - 8, 'text-anchor': 'middle'}, '—', group);
        return;
      }
      el('rect', {x: center + offset, y: Math.min(y(value), y(0)), width: mode === 'margin' ? 20 : 17,
        height: Math.abs(y(value) - y(0)), rx: 2, class: className}, undefined, group);
    });
    el('text', {x: center, y: 214, 'text-anchor': 'middle'}, month.key, group);
    // A transparent overlay makes the entire column a reliable touch target.
    el('rect', {x, y: 19, width: step - 4, height: 208, fill: 'transparent'}, undefined, group);
    group.addEventListener('click', () => select(month.key));
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); select(month.key);}
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); const next = Math.min(months.length - 1, Math.max(0, i + (event.key === 'ArrowRight' ? 1 : -1)));
        groups[next].focus(); select(months[next].key);
      }
    });
  });
  el('line', {x1: 75, y1: y(0), x2: width - 8, y2: y(0), class: 'baseline'});
  container.replaceChildren(svg);
}
