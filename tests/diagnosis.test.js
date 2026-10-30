import test from 'node:test';
import assert from 'node:assert/strict';
import {QUESTIONS, diagnose} from '../diagnosis/logic.js';
const base = {channel:'own', sku:'all', costs:'all', concern:'none'};
test('all 108 answer combinations have one to three concrete, unique recommendations', () => {
  let patterns = [{}];
  for (const q of QUESTIONS) patterns = patterns.flatMap(a => q.options.map(o => ({...a, [q.id]:o.value})));
  assert.equal(patterns.length,108);
  for (const answers of patterns) {
    const snapshot = {...answers}, result = diagnose(answers);
    assert.ok(result.points.length >= 1 && result.points.length <= 3);
    assert.equal(new Set(result.points.map(p=>p.id)).size,result.points.length);
    result.points.forEach(p => {assert.ok(p.title && p.reason && p.action); assert.equal('priority' in p,false);});
    assert.deepEqual(answers,snapshot);
    assert.equal(result.points.some(p=>p.id==='maintain'),answers.sku==='all' && answers.costs==='all' && answers.concern==='none');
  }
});
test('missing or invalid answers cannot produce a diagnosis', () => {
  for (const answers of [null, undefined, {}, {...base,channel:'unknown'}, {...base,sku:''}, {...base,costs:null}, {...base,concern:'other'}]) assert.throws(()=>diagnose(answers),/4問/);
});
test('each stated concern takes precedence even when both management areas are missing', () => {
  for (const [concern,id] of [['time','csv'],['accuracy','definition'],['action','analysis']]) {
    const result=diagnose({...base,sku:'none',costs:'none',concern});
    assert.equal(result.points.length,3);assert.equal(result.points[0].id,id);
  }
});
test('severity across answers changes the order of SKU and cost recommendations', () => {
  assert.deepEqual(diagnose({...base,sku:'none',costs:'partial'}).points.map(p=>p.id),['sku','costs']);
  assert.deepEqual(diagnose({...base,sku:'partial',costs:'none'}).points.map(p=>p.id),['costs','sku']);
});
test('partial and missing management get recommendations with answer-specific explanations', () => {
  for (const [field,id] of [['sku','sku'],['costs','costs']]) {
    const partial=diagnose({...base,[field]:'partial'}).points[0], missing=diagnose({...base,[field]:'none'}).points[0];
    assert.equal(partial.id,id);assert.equal(missing.id,id);assert.notEqual(partial.reason,missing.reason);
  }
});
test('few issues get maintenance guidance without invented deficiencies', () => {
  assert.deepEqual(diagnose(base).points.map(p=>p.id),['maintain']);
  assert.deepEqual(diagnose({...base,concern:'time'}).points.map(p=>p.id),['csv']);
});
test('all channel choices tailor preparation, including multi-channel SKU and duplication checks', () => {
  const outputs=QUESTIONS[0].options.map(o=>diagnose({...base,channel:o.value,concern:'time'}));
  assert.equal(new Set(outputs.map(r=>r.channelNote)).size,3);
  assert.match(outputs[2].channelNote,/二重計上/);
  outputs.forEach(r=>assert.ok(r.points[0].action.includes(r.channelNote)));
});
test('accuracy advice distinguishes gross profit from other costs', () => {
  const point=diagnose({...base,concern:'accuracy'}).points[0];
  assert.match(point.action,/粗利益/);assert.match(point.action,/送料・手数料・広告費/);
  assert.match(point.action,/税込・税抜/);
});
