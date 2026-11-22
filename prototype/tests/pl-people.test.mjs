import test from 'node:test';
import assert from 'node:assert/strict';
import { archivePreview, transferPatch, visibleMembers, publicPoster, posterLines, cleanEvent, validAvatar, validateAvatarFile } from '../src/pl/people.js';

const members = [
  {id:'a', name:'小林', role:'开发', skills:'前端、交互', avatar:'https://example.test/remote-photo'},
  {id:'b', name:'小林', role:'评审', skills:'测试', archived:true}
];

test('同名成员按 ID 保留，归档人员可按姓名、技能或角色单独找回', () => {
  assert.deepEqual(visibleMembers(members,'交互','active').map(m=>m.id), ['a']);
  assert.deepEqual(visibleMembers(members,'评审','archived').map(m=>m.id), ['b']);
  assert.equal(visibleMembers(members,'小林','all').length,2);
});

test('归档预览区分本地排期和源端责任，历史工作保持归属', () => {
  const tasks = [
    {id:'local',owner:'a'}, {id:'done',owner:'a',status:'已完成'},
    {id:'cancel',owner:'a',status:'已取消'}, {id:'external',sourceId:'src',owner:'a',sourceOwner:'b'},
    {id:'source-only',sourceId:'src',owner:'c',sourceOwner:'a'}, {id:'mine',owner:'c'}
  ];
  const items=[{id:'local-issue',owner:'a'},{id:'external-issue',sourceId:'src',owner:'a',sourceOwner:'a'}];
  const preview = archivePreview(tasks, 'a',items);
  assert.deepEqual(preview.transfer.map(t=>t.id), ['local','external','local-issue']);
  assert.deepEqual(preview.external.map(t=>t.id), ['source-only','external-issue']);
  assert.deepEqual(transferPatch(tasks[3],'c'), {owner:'c',ownerOverride:true});
  assert.deepEqual(transferPatch(tasks[0],'c'), {owner:'c'});
});

test('海报仅接收红事件的公开字段以及经选择的参与者姓名和本地缩略图', () => {
  const event = {type:'red', memberIds:['a','b'], title:'机密标题', facts:'私有证据', impact:'机密影响', evidenceURL:'https://private.test'};
  const draft = {title:'一起攻克难题', text:'谢谢大家', memberIds:['a','imposter'], privateNote:'不要导出'};
  assert.deepEqual(publicPoster(event,draft,members),{title:'一起攻克难题',text:'谢谢大家',people:[{name:'小林',avatar:''}]});
  assert.throws(()=>publicPoster({...event,type:'black'},draft,members),/红事件/);
  assert.throws(()=>publicPoster(event,{...draft,memberIds:[]},members),/至少选择一位/);
});

test('海报换行保留显式换行并按 Unicode 字符测量文本', () => {
  assert.deepEqual(posterLines('一起👏\n感谢',2,s=>Array.from(s).length),['一起','👏','感谢']);
});

test('黑事件结案必须记录结果，已结案记录保存日期，公开稿不可残留', () => {
  const event = {id:'e', date:'2026-11-01', memberIds:['a'], type:'black', facts:'漏检回归项', closed:true, praise:{poster:'old'}};
  assert.throws(()=>cleanEvent(event,'2026-11-20'),/纠正结果/);
  const clean=cleanEvent({...event,correction:'补充测试',closedAt:'2026-11-10'},'2026-11-20');
  assert.equal(clean.closedAt,'2026-11-10');
  assert.equal(clean.title,'漏检回归项');
  assert.equal(clean.praise,undefined);
});

test('头像限制文件格式、大小及最终本地缩略图；远端图片不会被加载', () => {
  assert.throws(()=>validateAvatarFile({type:'image/svg+xml',size:5}),/格式/);
  assert.throws(()=>validateAvatarFile({type:'image/jpeg',size:6*1024*1024}),/5 MB/);
  assert.equal(validAvatar('https://example.test/image.jpg'),false);
  assert.equal(validAvatar('data:image/jpeg;base64,/9j/2Q=='),true);
});
