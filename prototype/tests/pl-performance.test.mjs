import test from 'node:test';
import assert from 'node:assert/strict';
import {
  periodRange, dueFollowUps, evidenceChoices, annualMaterials, buildSelfDraft,
  confirmStage, amendGoal, closeFollowUp, defaultPeriod, needsContribution
} from '../src/pl/performance.js';

test('half years and annual periods use the local calendar', () => {
  assert.equal(defaultPeriod(new Date(2026, 5, 30, 23, 59)), 'H1');
  assert.equal(defaultPeriod(new Date(2026, 6, 1)), 'H2');
  assert.deepEqual(periodRange(2026, 'H2'), {start:'2026-07-01', end:'2026-12-31'});
  assert.deepEqual(periodRange(2026, 'Y'), {start:'2026-01-01', end:'2026-12-31'});
});

test('today includes overdue open 1:1 and black events, newest completed follow-up remains in history', () => {
  const c = {id:'c', topic:'设计反馈', memberId:'lin', followUpDate:'2026-06-11', result:'已结对验证'};
  const n = closeFollowUp(c, '2026-06-13', '2026-06-21');
  assert.equal(n.followUpDate, '2026-06-21');
  assert.deepEqual(n.history[0], {due:'2026-06-11', date:'2026-06-13', result:'已结对验证'});
  assert.equal(n.result, '');
  assert.throws(() => closeFollowUp(c, '2026-06-13', '2026-06-12'));
  assert.throws(() => closeFollowUp({...c, result:'  '}, '2026-06-13', ''));
  const p = closeFollowUp(c, '2026-06-13', '');
  const black = {id:'b', type:'black', memberIds:['lin'], title:'复核', followUpDate:'2026-06-12'};
  const rows = dueFollowUps([c,p,n], [black,{...black,id:'x',closed:true}], '2026-06-12');
  assert.deepEqual(rows.map(r=>[r.kind,r.id,r.overdue]), [['coaching','c',true],['event','b',false]]);
});

test('goal changes preserve original agreement and stage confirmations freeze all referenced evidence', () => {
  const g = {id:'g', title:'提效', measure:'耗时', expected:'20 分钟', evidence:[]};
  const changed = amendGoal(g, {title:'联调提效', measure:'耗时', expected:'30 分钟'}, '环境变更','2026-04-01');
  assert.equal(changed.amendments[0].previous.expected, '20 分钟');
  assert.equal(changed.amendments[0].reason, '环境变更');
  const submitted = confirmStage({id:'r',stage:0,start:'2026-01-01',end:'2026-06-30'}, [changed], 0, '2026-04-02');
  assert.equal(submitted.stage, 1);
  changed.title = '新内容';
  assert.equal(submitted.versions[0].goals[0].title, '联调提效');
});

test('self evidence is date-bounded, namespaced and requires PL attribution for team results', () => {
  const events = [{id:'x',memberIds:['lin','me'],title:'缺陷修复',date:'2026-08-06',facts:'小林修复缺陷'}, {id:'old',date:'2026-01-01',memberIds:['me']}];
  const tasks = [{id:'x',title:'发布',owner:'me',due:'2026-10-01'}];
  const options = evidenceChoices({goals:[],events,tasks,workItems:[],memberId:'me',self:true,...periodRange(2026,'H2')});
  assert.deepEqual(options.map(e=>e.key).sort(), ['event:x','task:x']);
  assert.equal(needsContribution(options[0]), true);
  assert.throws(()=>buildSelfDraft({evidence:options}));
  const selected = options.map(e=>({...e, contribution:e.team?'我协调回归窗口':''}));
  const draft = buildSelfDraft({evidence:selected, actions:'记录发布风险', improvement:'提前排期'});
  assert.match(draft, /我的动作[\s\S]*我协调回归窗口/);
  assert.match(draft, /交付结果[\s\S]*缺陷修复/);
  assert.match(draft, /下一步改进[\s\S]*提前排期/);
});

test('annual reuse combines the two halves, keeps PL edits, deduplicates by source ID and respects adjusted dates', () => {
  const a={key:'event:a',date:'2026-03-12',contribution:'已调整'}, b={key:'event:b',date:'2026-09-01'};
  const self=(period,evidence)=>({kind:'self',memberId:'me',year:2026,period,...periodRange(2026,period),evidence});
  const annual=self('Y',[a]);
  const halves=[self('H1',[{...a,contribution:'旧说明'}]),self('H2',[b]),self('H2',[b])];
  assert.deepEqual(annualMaterials(annual,halves), [a,b]);
  assert.deepEqual(annualMaterials({...annual,end:'2026-06-30'},halves), [a]);
});

test('editable review drafts, reference attribution, stage versions and coaching results survive reopening the desktop store', async t => {
  const {LocalStore} = await import('../desktop/store.mjs');
  const fs = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const directory=await fs.mkdtemp(join(tmpdir(),'castiel-reviews-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const goal={id:'g',memberId:'me',cycleId:'cycle',title:'如期交付'};
  const evidence=[{key:'event:x',title:'回归完成',date:'2026-06-20',label:'事迹',team:true,contribution:'我组织跨组排期'}];
  const self={id:'self',kind:'self',memberId:'me',year:2026,period:'H1',...periodRange(2026,'H1'),evidence,draft:'本人已改过的原稿'};
  const cycle=confirmStage({id:'cycle',kind:'cycle',memberId:'me',stage:0,...periodRange(2026,'H1')},[goal],0);
  const data={plGoals:[goal],plReviews:[cycle,self],plCoaching:[{id:'c',memberId:'me',summary:'沟通总结草稿',followUpDate:'2026-07-02'}]};
  const store=new LocalStore(directory);
  await store.load();
  await store.save(data,0);
  const recovered=await new LocalStore(directory).load();
  assert.deepEqual(recovered.data.plReviews,data.plReviews);
  assert.deepEqual(recovered.data.plGoals,data.plGoals);
  assert.deepEqual(recovered.data.plCoaching,data.plCoaching);
});
