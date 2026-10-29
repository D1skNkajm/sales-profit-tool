import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseCSV,parseSalesCSV,toCSV,readSalesFile} from '../js/data.js';
import {aggregateSales} from '../js/aggregate.js';
const header='SKU,販売数量,販売単価,仕入原価,販売日\n';
test('sample totals, SKU and monthly aggregation',async()=>{
 const {rows,errors}=parseSalesCSV(await readFile(new URL('../sample.csv',import.meta.url),'utf8'));
 assert.deepEqual(errors,[]);assert.equal(rows.length,8);
 const r=aggregateSales(rows);
 assert.equal(r.total.revenue,342000);assert.equal(r.total.cogs,159400);assert.equal(r.total.profit,182600);assert.equal(r.total.quantity,165);
 assert.equal(r.total.margin,182600/342000*100);
 assert.equal(r.skus.find(s=>s.key==='BAG-001').revenue,172800);
 assert.equal(r.months.length,4);assert.equal(r.months[0].profit,34100);
});
test('zero revenue has uncomputable margin; losses and zero quantity',()=>{
 const r=aggregateSales([{sku:'A',quantity:2,price:0,cost:10,date:'2026-02-01'},{sku:'B',quantity:0,price:100,cost:50,date:'2026-01-01'}]);
 assert.equal(r.total.margin,null);assert.equal(r.total.profit,-20);assert.equal(r.skus[0].margin,null);assert.equal(r.months[0].key,'2026-01');
});
test('decimal currency',()=>{const r=aggregateSales([{sku:'A',quantity:2,price:10.5,cost:3.25,date:'2026-01-01'}]);assert.equal(r.total.profit,14.5);});
test('BOM, quoted commas, escaped quotes, CRLF and embedded newlines',()=>{
 assert.deepEqual(parseCSV('\uFEFFa,b\r\n"one, two","a""b\nx"\r\n'),[['a','b'],['one, two','a"b\nx']]);
});
test('reordered headers and extra columns',()=>{
 const r=parseSalesCSV('販売日,仕入原価,SKU,販売単価,販売数量,メモ\n2024-02-29,20,A,30,2,ok');assert.equal(r.rows[0].sku,'A');assert.deepEqual(r.errors,[]);
});
test('invalid data reports all bad rows and original row numbers',()=>{
 const r=parseSalesCSV(header+'A,1,100,50,2026-01-01\n\n,1,100,50,2026-01-01\nB,-1,100,50,2026-01-01\nC,1.5,100,50,2026-01-01\nD,1,,50,2026-01-01\nE,1,100,50,2026-02-30\nF,1,Infinity,50,2026-01-01\nG,1,100,50,2026-01-01,extra');
 assert.equal(r.rows.length,1);assert.deepEqual(r.errors.map(e=>e.row),[4,5,6,7,8,9,10]);
});
test('empty, missing or duplicate headers and malformed quotes are rejected',()=>{
 for(const csv of ['', 'SKU,販売数量\nA,2', 'SKU,SKU,販売数量,販売単価,仕入原価,販売日',header,header+'"oops',header+'"a"x,2,3,1,2026-01-01'])assert.throws(()=>parseSalesCSV(csv));
});
test('CSV export escapes quotes and spreadsheet formulas with BOM',()=>{
 const out=toCSV([['=SUM(A1)','a,b','a"b',-10,null]]);assert.ok(out.startsWith('\uFEFF'));assert.deepEqual(parseCSV(out),[["'=SUM(A1)",'a,b','a"b','-10','']]);
});
test('file size guard',async()=>{await assert.rejects(()=>readSalesFile({size:11*1024*1024}),/10MB/);});
test('unsafe row amounts and overflowing aggregates rejected',()=>{
 assert.equal(parseSalesCSV(header+'A,2,9007199254740991,0,2026-01-01').errors.length,1);
 assert.throws(()=>aggregateSales(Array(2).fill({sku:'A',quantity:1,price:Number.MAX_SAFE_INTEGER,cost:0,date:'2026-01-01'})),/範囲/);
});
