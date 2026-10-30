import test from 'node:test';
import assert from 'node:assert/strict';
import {sortSkus, pageSkus, chartDomain, percent, profitText} from '../js/presentation.js';

const rows = [
  {key:'B', revenue:100, profit:-20, margin:-20, quantity:2},
  {key:'C', revenue:0, profit:0, margin:null, quantity:0},
  {key:'A', revenue:300, profit:180, margin:60, quantity:1},
];
for (const [key, descending, ascending] of [
  ['revenue', ['A','B','C'], ['C','B','A']],
  ['profit', ['A','C','B'], ['B','C','A']],
  ['margin', ['A','B','C'], ['B','A','C']],
  ['quantity', ['B','A','C'], ['C','A','B']],
]) {
  test(`${key}: both sort directions, without changing source data`, () => {
    assert.deepEqual(sortSkus(rows, key, 'desc').map(r=>r.key), descending);
    assert.deepEqual(sortSkus(rows, key, 'asc').map(r=>r.key), ascending);
    assert.deepEqual(rows.map(r=>r.key), ['B','C','A']);
  });
}
test('sort ties use SKU order; multiple null margins stay last', () => {
  const data = [{key:'Z',margin:null},{key:'B',margin:0},{key:'A',margin:0},{key:'Y',margin:null}];
  for (const direction of ['asc','desc']) assert.deepEqual(sortSkus(data,'margin',direction).map(r=>r.key),['A','B','Y','Z']);
});
test('reject unknown sort conditions', () => {
  assert.throws(()=>sortSkus(rows,'__proto__'));
  assert.throws(()=>sortSkus(rows,'revenue','unknown'));
});
test('pagination bounds DOM rows to 50 and preserves the last partial page', () => {
  const many = Array.from({length:123},(_,i)=>({key:String(i)}));
  const first = pageSkus(many,0), last = pageSkus(many,99);
  assert.equal(first.rows.length,50);assert.equal(first.start,0);assert.equal(first.end,50);
  assert.equal(last.rows.length,23);assert.equal(last.page,2);assert.equal(last.start,100);assert.equal(last.end,123);
  assert.equal(pageSkus(many,-1).page,0);assert.equal(many.length,123);
  assert.equal(pageSkus([]).rows.length,0);
});
test('amount chart includes zero and negative profit, ignores rate', () => {
  assert.deepEqual(chartDomain(rows,'amount'),{min:-20,max:300});
});
test('rate chart uses actual rates, keeps null uncomputable and supports negatives', () => {
  assert.deepEqual(chartDomain(rows,'margin'),{min:-20,max:60});
  assert.deepEqual(chartDomain([{margin:null}],'margin'),{min:0,max:1});
  assert.deepEqual(chartDomain([{margin:0}],'margin'),{min:0,max:1});
  assert.deepEqual(chartDomain([{margin:-150}],'margin'),{min:-150,max:0});
});
test('negative profits have a textual indicator; uncomputable rates remain explicit', () => {
  assert.match(profitText(-10),/赤字/);assert.doesNotMatch(profitText(10),/赤字/);
  assert.equal(percent(null),'計算不能');assert.equal(percent(0),'0.0%');
});
