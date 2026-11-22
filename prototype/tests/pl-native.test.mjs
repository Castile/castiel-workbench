import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CompanySources, sourceEndpoint } from '../desktop/company-sources.mjs';
import { codexText, polishInput } from '../desktop/polish.mjs';
import { LocalStore } from '../desktop/store.mjs';
import { weekStart, plannedWeek, loadFor } from '../src/workspaceData.js';

test('only the configured source URL receives its bound bearer; secrets stay outside workbench backups',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'castiel-pl-test-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const store=new LocalStore(directory);
  const data={plSources:[{id:'source',name:'Fixtures',url:'https://fixture.invalid/issues'}]};
  await store.save(data,0);
  const calls=[];
  const sources=new CompanySources(store,{
    isEncryptionAvailable:()=>true,
    encryptString:s=>Buffer.from(s),
    decryptString:b=>b.toString()
  },async (url,opts)=>{
    calls.push({url,opts});
    return Response.json([{id:'ISSUE-1'}]);
  });
  await sources.setToken({sourceId:'source',token:'fixture-token'});
  assert.deepEqual(await sources.read({sourceId:'source',url:'https://wrong.invalid'}),[{id:'ISSUE-1'}]);
  assert.equal(calls[0].url,data.plSources[0].url);
  assert.equal(calls[0].opts.method,'GET');
  assert.equal(calls[0].opts.redirect,'error');
  assert.equal(calls[0].opts.headers.Authorization,'Bearer fixture-token');
  assert.ok(!JSON.stringify(await store.load()).includes('fixture-token'));
  data.plSources[0].url='https://changed.invalid/issues';
  await store.save(data,1);
  await assert.rejects(sources.read({sourceId:'source'}),/地址已改变/);
  await sources.setToken({sourceId:'source',token:''});
  await sources.read({sourceId:'source'});
  assert.equal(calls[1].opts.headers.Authorization,undefined);
});
test('invalid source URL and oversized feeds cannot be applied',async()=>{
  for (const url of ['file:///tmp/items','http://name.invalid','https://user:p@name.invalid','https://name.invalid/?access_token=demo']) assert.throws(()=>sourceEndpoint(url));
  const store={file:'test',directory:os.tmpdir(),read:async()=>({data:{plSources:[{id:'fixture',url:'https://fixture.invalid/'}]}})};
  const sources=new CompanySources(store,null,async()=>new Response('a'.repeat(1024*1024+1)));
  await assert.rejects(sources.read({sourceId:'fixture'}),/大小限制/);
});
test('model call only contains chosen text, references, no tools and no chat history',async()=>{
  const config={model_provider:'fixture',model_providers:{fixture:{base_url:'https://model.invalid/v1',env_key:'FIXTURE_TOKEN'}}};
  const input=polishInput({text:'我的工作',evidence:'工单一'});
  assert.throws(()=>polishInput({text:'',evidence:''}));
  const result=await codexText(config,{FIXTURE_TOKEN:'test'},'example',input,undefined,async(url,options)=>{
    assert.equal(url.href,'https://model.invalid/v1/responses');
    assert.equal(options.redirect,'error');
    const payload=JSON.parse(options.body);
    assert.deepEqual(payload.tools,[]);
    assert.equal(payload.tool_choice,'none');
    assert.equal(payload.store,false);
    assert.equal(payload.input,'文稿\n我的工作\n\n参考材料\n工单一');
    return Response.json({output:[{type:'message',content:[{type:'output_text',text:'润色建议'}]}]});
  });
  assert.equal(result,'润色建议');
});
test('new schedules use stable Monday dates, unscheduled items count zero, archived records survive backup',async t=>{
  const sunday=new Date(2026,10,22), monday=new Date(2026,10,23);
  assert.equal(weekStart(1,sunday),'2026-11-23');
  assert.equal(plannedWeek({scheduledWeekStart:'2026-11-23'},sunday),1);
  assert.equal(plannedWeek({scheduledWeekStart:'2026-11-23'},monday),0);
  const tasks=[{id:'1',sourceOwner:'a',owner:'b',week:0,effort:8},{id:'2',owner:'b',week:null,effort:9}];
  assert.equal(loadFor(tasks,{id:'b',capacity:40,absence:0}).hours,8);
  assert.equal(loadFor(tasks,{id:'a',capacity:40,absence:0}).hours,0);
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'castiel-pl-restore-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const store=new LocalStore(directory);
  await store.save({members:[{id:'me'}]},0);
  const old=(await store.load()).data;
  const data={...old,members:[...old.members,{id:'b',archived:true}],plEvents:[{id:'e',type:'red',memberIds:['b'],date:'2026-11-22',facts:'Reviewed'}],plItems:[{id:'r'}],plSources:[],plReviews:[],plGoals:[],plCoaching:[]};
  await store.save(data,1);
  const backup=path.join(directory,'fixture-backup.json');
  await store.exportTo(backup);
  await store.save(old,2);
  await store.importFrom(backup,3);
  assert.deepEqual((await new LocalStore(directory).load()).data,data);
});
