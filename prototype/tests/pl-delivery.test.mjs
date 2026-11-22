import test from 'node:test';
import assert from 'node:assert/strict';
import * as delivery from '../src/pl/delivery.js';

const source = {
  id:'tracker', name:'缺陷系统', projectId:'release',
  fields:{ externalId:'key', entityType:'kind', title:'summary', owner:'assigned.login' },
  entityMap:[['R','requirement'],['I','issue'],['T','task']],
  statusMap:[['open','待规划']], personMap:[['alice','a']]
};
const members = [{id:'a', name:'甲'}, {id:'b',name:'乙'}, {id:'c',name:'乙'}];
const row = (kind, key, extra={}) => ({kind,key,summary:'验证交付',status:'open',assigned:{login:'alice'},...extra});
const preview = (rows, options={}) => delivery.previewImport({rows,source,members,tasks:[],items:[],...options});
const applied = results => delivery.applyPreview([],results);

test('same remote ID across three entities, instances and repeat imports stays distinct', () => {
  const rows = ['R','I','T'].map(kind=>row(kind,'42'));
  const first = applied(preview(rows));
  assert.equal(first.items.length,2);
  assert.equal(first.tasks.length,1);
  const again = preview(rows,{items:first.items,tasks:first.tasks});
  assert.deepEqual(again.map(r=>r.action),['update','update','update']);
  assert.deepEqual(again.map(r=>r.record.id),[first.items[0].id,first.items[1].id,first.tasks[0].id]);
  assert.equal(preview(rows,{items:first.items,tasks:first.tasks,source:{...source,id:'other'}})[0].action,'create');
  assert.equal(first.tasks[0].week,null);
  assert.equal(first.tasks[0].sourceOwner,'a');
});

test('remote reassignment preserves local plan incl. 8 hours and raises review only on affected task', () => {
  const original = applied(preview([row('T','A')])).tasks[0];
  const local = {...original,owner:'b',ownerOverride:true,week:1,scheduledWeekStart:'2026-11-23',effort:8,planNote:'先补回归'};
  const remote = row('T','A',{assigned:{login:'c'},effort:50,summary:'更新标题'});
  const next = applied(preview([remote],{tasks:[local]})).tasks[0];
  assert.deepEqual([next.title,next.sourceOwner,next.owner,next.week,next.scheduledWeekStart,next.effort,next.planNote,next.needsPlanReview],
    ['更新标题','c','b',1,'2026-11-23',8,'先补回归',true]);
  const automatic = applied(preview([remote],{tasks:[original]})).tasks[0];
  assert.equal(automatic.owner,'c');
});

test('duplicate inputs, invalid dates/links and unknown status are excluded; ambiguous members can stay unassigned or map explicitly', () => {
  const rows = [row('I','2'),row('I','2'),row('T','3',{status:'triage'}),row('I','4',{url:'javascript:alert(1)'}),row('R','5',{due:'2026-02-30'}),row('T','6',{assigned:{login:'乙'}})];
  const results=preview(rows);
  assert.deepEqual(results.map(r=>r.action),['conflict','conflict','conflict','conflict','conflict','create']);
  assert.equal(results[5].unmatched,true);
  assert.equal(applied(results).tasks[0].owner,'');
  const mapped=preview(rows.slice(-1),{source:{...source,personMap:[['乙','b']]}});
  assert.equal(mapped[0].record.owner,'b');
  assert.equal(mapped[0].unmatched,false);
});

test('CSV handles quoted commas, escaped quotes, BOM and line breaks; malformed feeds never enter preview', () => {
  assert.deepEqual(delivery.parseFeed('\ufeffid,title\r\n1,"Hello, ""世界""\nnext"\r\n'),[{id:'1',title:'Hello, "世界"\nnext'}]);
  assert.deepEqual(delivery.parseFeed('{"result":{"work":[{"id":1}]}}','result.work'),[{id:1}]);
  for(const input of ['id,id\n1,2','id,title\n1','id,title\n1,"abc','{broken','[4]']) assert.throws(()=>delivery.parseFeed(input));
});
