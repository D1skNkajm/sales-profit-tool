import {readSalesFile, parseSalesCSV, toCSV} from './data.js';
import {aggregateSales} from './aggregate.js';
const $ = id => document.getElementById(id);
const yen = n => new Intl.NumberFormat('ja-JP', {style:'currency', currency:'JPY', maximumFractionDigits:2}).format(n);
const percent = n => n === null ? '計算不能' : `${n.toFixed(1)}%`;
let current = null, requestId = 0;
function error(message, errors = []) {
  const box = $('errors'); box.replaceChildren(); box.hidden = false;
  const title = document.createElement('strong'); title.textContent = message; box.append(title);
  if (errors.length) {
    const list = document.createElement('ul');
    errors.slice(0,100).forEach(e => {const li = document.createElement('li'); li.textContent = `${e.row}行目：${e.message}`; list.append(li);});
    box.append(list);
    if (errors.length > 100) box.append(document.createTextNode(`ほか${errors.length - 100}件。先頭100件を表示しています。`));
  }
}
function tableBody(id, rows) {
  $(id).replaceChildren(...rows.map(values => {
    const tr = document.createElement('tr');
    values.forEach(value => {const td = document.createElement('td'); td.textContent = value; tr.append(td);});
    return tr;
  }));
}
function chart(months) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns,'svg');
  const width = Math.max(680, months.length * 82), height = 240;
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`); svg.style.minWidth = `${width}px`;
  svg.setAttribute('role','img'); svg.setAttribute('aria-label','月別売上・粗利益グラフ。正確な数値は下の月別表をご確認ください。');
  const el = (tag, attrs, text) => {const node = document.createElementNS(ns,tag); for(const [k,v] of Object.entries(attrs)) node.setAttribute(k,v); if(text) node.textContent = text; svg.append(node); return node;};
  const min = Math.min(0,...months.map(m=>m.profit)), max = Math.max(1,...months.map(m=>m.revenue),...months.map(m=>m.profit));
  const y = value => 190 - (value-min)/(max-min)*164;
  for(let i=0;i<=4;i++) {const value=min+(max-min)*i/4; const pos=y(value); el('line',{x1:75,y1:pos,x2:width-12,y2:pos}); el('text',{x:65,y:pos+4,'text-anchor':'end'},`${Math.round(value/1000)}千円`);}
  el('line',{x1:75,y1:y(0),x2:width-12,y2:y(0)});
  const step=(width-90)/months.length;
  months.forEach((m,i)=>{
    const x=82+i*step+step/2;
    [[m.revenue,-19,'var(--accent)'],[m.profit,2,'#80b9ee']].forEach(([value,offset,fill])=>{
      const rect=el('rect',{x:x+offset,y:Math.min(y(value),y(0)),width:17,height:Math.max(0.5,Math.abs(y(value)-y(0))),rx:2,fill});
      const title=document.createElementNS(ns,'title');title.textContent=`${m.key} ${offset<0?'売上':'粗利益'} ${yen(value)}`;rect.append(title);
    });
    el('text',{x,y:219,'text-anchor':'middle'},m.key);
  });
  $('chart').replaceChildren(svg);
}
function render(result, count, label, dates) {
  current = result;
  for (const key of ['revenue','cogs','profit']) $(key).textContent = yen(result.total[key]);
  $('profit').classList.toggle('negative',result.total.profit<0);
  $('margin').textContent = percent(result.total.margin);
  $('status').textContent = `${label} · ${count}件 · ${dates[0]} 〜 ${dates[dates.length-1]} · 販売数量 ${result.total.quantity.toLocaleString('ja-JP')}点`;
  $('sku-count').textContent = `${result.skus.length} SKU`;
  tableBody('skus',result.skus.map(s=>[s.key,s.quantity.toLocaleString('ja-JP'),yen(s.revenue),yen(s.cogs),yen(s.profit),percent(s.margin)]));
  tableBody('months',result.months.map(m=>[m.key,yen(m.revenue),yen(m.profit)]));
  chart(result.months); $('export').disabled=false;
}
async function load(getData, label) {
  const id = ++requestId;
  $('file').disabled = true; $('sample').disabled = true;
  try {
    const {rows,errors} = await getData();
    if(id !== requestId) return;
    if(errors.length) {error(`${errors.length}行に問題があります。集計は更新していません。CSVを修正して再読み込みしてください。`,errors); return;}
    const result = aggregateSales(rows);
    render(result,rows.length,label,rows.map(r=>r.date).sort());
    $('errors').hidden=true;
  } catch(e) {if(id===requestId) error(e.message || 'CSVを読み込めませんでした。');}
  finally {if(id===requestId){$('file').disabled=false;$('sample').disabled=false;$('file').value='';}}
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
const themes=['auto','light','dark'];let theme='auto';
try{const saved=localStorage.getItem('sales-theme');if(themes.includes(saved))theme=saved;}catch{}
function applyTheme(){if(theme==='auto')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=theme;$('theme').textContent=`テーマ：${{auto:'自動',light:'ライト',dark:'ダーク'}[theme]}`;}
$('theme').addEventListener('click',()=>{theme=themes[(themes.indexOf(theme)+1)%3];try{localStorage.setItem('sales-theme',theme);}catch{}applyTheme();});applyTheme();
