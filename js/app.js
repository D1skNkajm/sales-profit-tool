import {readSalesFile, parseSalesCSV, toCSV} from './data.js';
import {aggregateSales} from './aggregate.js';
import {sortSkus, pageSkus, SORT_LABELS, yen, percent, profitText} from './presentation.js';
import {renderChart} from './chart.js';
const $ = id => document.getElementById(id);
let current = null, requestId = 0;
let chartMode = 'amount', selectedMonth = '', sortDirection = 'desc', sortedSkus = [], skuPage = 0;
function error(message, errors = []) {
  const box = $('errors'); box.replaceChildren(); box.hidden = false;
  const title = document.createElement('strong'); title.textContent = message; box.append(title);
  if (errors.length) {
    const list = document.createElement('ul');
    errors.slice(0,100).forEach(e => {const li = document.createElement('li'); li.textContent = `${e.row}行目：${e.message}`; list.append(li);});
    box.append(list);
    if (errors.length > 100) box.append(document.createTextNode(`ほか${errors.length - 100}件。先頭100件を表示しています。`));
  }
  const note = document.createElement('p'); note.textContent = current ? '前回読み込んだデータを表示しています。' : 'データはまだ読み込まれていません。'; box.append(note);
  box.focus();
}
function tableBody(id, rows) {
  $(id).replaceChildren(...rows.map(values => {
    const tr = document.createElement('tr');
    values.forEach(value => {const td = document.createElement('td'); td.textContent = value; tr.append(td);});
    return tr;
  }));
}
function renderMonthDetail(key) {
  selectedMonth = key;
  $('month-select').value = key;
  const month = current.months.find(m => m.key === key);
  const heading = document.createElement('h3'); heading.textContent = `${key.replace('-', '年')}月`;
  const items = [['売上', yen(month.revenue)], ['売上原価', yen(month.cogs)], ['粗利益', profitText(month.profit)], ['粗利益率', percent(month.margin)]];
  $('month-detail').replaceChildren(heading, ...items.map(([label, value]) => {
    const dl = document.createElement('dl'), dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = label; dd.textContent = value;
    if (label === '粗利益' && month.profit < 0) dd.className = 'negative';
    dl.append(dt, dd); return dl;
  }));
}
function drawChart() {
  if (!current) return;
  $('amount-mode').setAttribute('aria-pressed', String(chartMode === 'amount'));
  $('margin-mode').setAttribute('aria-pressed', String(chartMode === 'margin'));
  $('legend').replaceChildren(...(chartMode === 'margin' ? [['revenue-key', '粗利益率']] : [['revenue-key', '売上'], ['profit-key', '粗利益']]).map(([className, label]) => {
    const span = document.createElement('span'); span.className = className; span.textContent = label; return span;
  }));
  renderChart($('chart'), current.months, chartMode, selectedMonth, renderMonthDetail);
}
function renderSkuPage() {
  const data = pageSkus(sortedSkus, skuPage); skuPage = data.page;
  tableBody('skus', data.rows.map(s => [s.key, s.quantity.toLocaleString('ja-JP'), yen(s.revenue), yen(s.cogs), profitText(s.profit), percent(s.margin)]));
  $('page-status').textContent = `${data.start + 1}〜${data.end}件 / ${sortedSkus.length.toLocaleString('ja-JP')}件`;
  $('prev-page').disabled = skuPage === 0;
  $('next-page').disabled = skuPage === data.pages - 1;
}
function updateSort() {
  if (!current) return;
  const key = $('sort-key').value;
  sortedSkus = sortSkus(current.skus, key, sortDirection); skuPage = 0;
  const desc = sortDirection === 'desc';
  $('sort-direction').textContent = desc ? '高い順 ↓' : '低い順 ↑';
  $('sort-direction').setAttribute('aria-label', `並べ替え方向：${desc ? '降順。昇順' : '昇順。降順'}に切り替える`);
  $('sort-status').textContent = `${SORT_LABELS[key]}の${desc ? '高い順' : '低い順'}${key === 'margin' ? '（計算不能は末尾）' : ''}・1ページ50件`;
  document.querySelectorAll('[data-sort]').forEach(th => {
    if (th.dataset.sort === key) th.setAttribute('aria-sort', desc ? 'descending' : 'ascending');
    else th.removeAttribute('aria-sort');
  });
  renderSkuPage();
}
function render(result, count, label, dates) {
  current = result;
  for (const key of ['revenue', 'cogs', 'profit']) $(key).textContent = yen(result.total[key]);
  $('profit').classList.toggle('negative', result.total.profit < 0);
  $('profit-note').replaceChildren();
  if (result.total.profit < 0) {
    const badge = document.createElement('span'); badge.className = 'loss-badge'; badge.textContent = '赤字';
    $('profit-note').append(badge, '原価が売上を上回っています');
  } else $('profit-note').textContent = '売上から原価を引いた利益';
  $('margin').textContent = percent(result.total.margin);
  $('status').textContent = `${label}：${count.toLocaleString('ja-JP')}件を読み込みました。期間 ${dates[0]} 〜 ${dates[dates.length - 1]} ／ 販売数量 ${result.total.quantity.toLocaleString('ja-JP')}点`;
  $('sku-count').textContent = `${result.skus.length.toLocaleString('ja-JP')} SKU`;
  $('chart-empty').hidden = true; $('chart-content').hidden = false;
  $('sku-empty').hidden = true; $('sku-content').hidden = false;
  for (const id of ['export', 'sort-key', 'sort-direction', 'amount-mode', 'margin-mode']) $(id).disabled = false;
  updateSort();
  tableBody('months', result.months.map(m => [m.key, yen(m.revenue), yen(m.cogs), profitText(m.profit), percent(m.margin)]));
  $('month-select').replaceChildren(...result.months.map(m => {
    const option = document.createElement('option'); option.value = m.key; option.textContent = m.key; return option;
  }));
  renderMonthDetail(result.months[result.months.length - 1].key);
  drawChart();
}
async function load(getData, label) {
  const id = ++requestId;
  $('file').disabled = true; $('sample').disabled = true;
  document.querySelector('.upload').setAttribute('aria-busy', 'true');
  $('sample').textContent = '読み込み中…';
  try {
    const {rows,errors} = await getData();
    if(id !== requestId) return;
    if(errors.length) {error(`${errors.length}行に問題があります。集計は更新していません。CSVを修正して再読み込みしてください。`,errors); return;}
    const result = aggregateSales(rows);
    render(result,rows.length,label,rows.map(r=>r.date).sort());
    $('errors').hidden=true;
  } catch(e) {if(id===requestId) error(e.message || 'CSVを読み込めませんでした。');}
  finally {if(id===requestId){$('file').disabled=false;$('sample').disabled=false;$('file').value='';$('sample').textContent='サンプルで試す';document.querySelector('.upload').setAttribute('aria-busy','false');}}
}
$('file').addEventListener('change',event=>{const file=event.target.files[0];if(file) load(()=>readSalesFile(file),file.name);});
$('sample').addEventListener('click',()=>load(async()=>{
  const response=await fetch('./sample.csv'); if(!response.ok) throw new Error('サンプルCSVを読み込めませんでした。');
  return parseSalesCSV(await response.text());
},'サンプルデータ'));
$('export').addEventListener('click',()=>{
  if(!current) return;
  const header=['集計区分','SKU／月','販売数量','売上','売上原価','粗利益','粗利益率(%)'];
  const row=(kind,key,s)=>[kind,key,s.quantity,s.revenue,s.cogs,s.profit,s.margin===null?'計算不能':s.margin];
  const csv=toCSV([header,row('全体','合計',current.total),...current.skus.map(s=>row('SKU',s.key,s)),...current.months.map(s=>row('月',s.key,s))]);
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='sales-profit-summary.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
});

$('amount-mode').addEventListener('click', () => {chartMode = 'amount'; drawChart();});
$('margin-mode').addEventListener('click', () => {chartMode = 'margin'; drawChart();});
$('month-select').addEventListener('change', () => {renderMonthDetail($('month-select').value); drawChart();});
$('sort-key').addEventListener('change', updateSort);
$('sort-direction').addEventListener('click', () => {sortDirection = sortDirection === 'desc' ? 'asc' : 'desc'; updateSort();});
for (const [id, delta] of [['prev-page', -1], ['next-page', 1]]) $(id).addEventListener('click', () => {
  skuPage += delta; renderSkuPage();
});
let chartWidth = 0;
const chartObserver = new ResizeObserver(entries => {
  const width = entries[0].contentRect.width;
  if (width > 0 && width !== chartWidth) {chartWidth = width; drawChart();}
});
chartObserver.observe($('chart'));

const themes=['auto','light','dark'];let theme='auto';
try{const saved=localStorage.getItem('sales-theme');if(themes.includes(saved))theme=saved;}catch{}
function applyTheme(){if(theme==='auto')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=theme;$('theme').textContent=`テーマ：${{auto:'自動',light:'ライト',dark:'ダーク'}[theme]}`;}
$('theme').addEventListener('click',()=>{theme=themes[(themes.indexOf(theme)+1)%3];try{localStorage.setItem('sales-theme',theme);}catch{}applyTheme();});applyTheme();
