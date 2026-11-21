import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentRuntime } from '../desktop/agents.mjs';
import { CodexRPC } from '../desktop/rpc.mjs';
import { LocalStore } from '../desktop/store.mjs';
import { claudeSummary, findCLI, modelName, redactError } from '../desktop/discovery.mjs';
import * as discovery from '../desktop/discovery.mjs';
import { rebindConversationWorkspace } from '../src/state/conversation-workspaces.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadRuntimeUI } from './agent-runtime-ui.mjs';

async function until(check) { const end=Date.now()+4000; while(!check()){if(Date.now()>end)throw new Error('fixture timeout');await new Promise(r=>setTimeout(r,10));} }
async function fixture(t, agent='Claude', mode='success') {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'castiel-agents-test-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const executable=path.join(directory,agent.toLowerCase());
  const code=`#!${process.execPath}
import readline from 'node:readline';
import fs from 'node:fs';
if(process.env.CASTIEL_FIXTURE_ARGS)fs.writeFileSync(process.env.CASTIEL_FIXTURE_ARGS,JSON.stringify(process.argv.slice(2)));
const log=value=>process.stdout.write(JSON.stringify(value)+'\\n');
if(process.argv.includes('--version')){console.log('test 1.0');process.exit(0)}
if(process.argv.includes('app-server')){
 readline.createInterface({input:process.stdin}).on('line',line=>{
  const m=JSON.parse(line);if(!m.method)return;
  if(m.id===undefined)return;
  let result={};
  if(m.method==='initialize')result={userAgent:'test'};
  if(m.method==='thread/start'||m.method==='thread/resume')result={thread:{id:'thread-fixture'},model:'local-test-model'};
  if(m.method==='turn/start')result={turn:{id:'turn-fixture'}};
  log({id:m.id,result});
  if(m.method==='turn/interrupt')log({method:'turn/completed',params:{threadId:'thread-fixture',turn:{id:'turn-fixture',status:'interrupted'}}});
 });
}else{
 let input='';process.stdin.on('data',d=>input+=d);process.stdin.on('end',()=>{
  log({type:'system',subtype:'init',session_id:'claude-fixture',model:'local-test-model'});
  if(process.env.CASTIEL_FIXTURE_MODE==='wait'){setInterval(()=>{},1000);return;}
  log({type:'stream_event',event:{type:'message_start',message:{id:'message'}}});
  if(process.env.CASTIEL_FIXTURE_MODE==='thinking'){
   log({type:'stream_event',event:{type:'content_block_start',index:0,content_block:{type:'thinking',thinking:''}}});
   log({type:'stream_event',event:{type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:'Public **summary**'}}});
   log({type:'stream_event',event:{type:'content_block_delta',index:0,delta:{type:'signature_delta',signature:'private-signature'}}});
   log({type:'stream_event',event:{type:'content_block_stop',index:0}});
   log({type:'assistant',message:{id:'message',content:[{type:'thinking',thinking:'Public **summary**',signature:'private-signature'},{type:'redacted_thinking',data:'private-data'}]}});
   log({type:'result',is_error:false});return;
  }
  log({type:'stream_event',event:{delta:{type:'text_delta',text:input}}});
  log({type:'assistant',message:{id:'message',content:[{type:'text',text:input}]}});
  log({type:'result',is_error:process.env.CASTIEL_FIXTURE_MODE==='error',result:input,permission_denials:process.env.CASTIEL_FIXTURE_MODE==='denied'?[{tool_name:'Edit'}]:[]});
 });
}
`;
  // Node uses .mjs classification for an extensionless executable in a module package.
  await fs.writeFile(path.join(directory,'package.json'),' {"type":"module"}');
  await fs.writeFile(executable,code,{mode:0o700});
  const store=new LocalStore(path.join(directory,'data'));await store.load();
  const session={id:'chat',taskId:null,title:'fixture',agent,model:'system',workspaceId:'s',workspaceSnapshot:{id:'s',name:'fixture',path:''},agentSettingsSnapshot:{instructions:'fixture rule'},messages:[{who:'我',text:'hello'}]};
  await store.save({records:{tasks:[],sessions:[session]},agentConfig:{[agent]:{enabled:true}},spaces:[{id:'s',name:'fixture',path:''}]},0);
  const events=[];const runtime=new AgentRuntime({store,emit:e=>events.push(e),home:directory});
  runtime.env={...process.env,CASTIEL_FIXTURE_MODE:mode};runtime.redactionEnv={};
  runtime.catalog={checking:false,agents:{[agent]:{ready:true,executable,configuredModel:'local-test-model',configuredReasoningEffort:'medium',configuredApprovalsReviewer:'user',reasoningEfforts:{'local-test-model':['low','medium','high'],'*':['low','medium','high']},capabilities:{effort:true,autoReview:true,reviewer:true,permissionModes:['manual','acceptEdits','auto','plan']},models:[['system','default','']]}}};
  t.after(()=>runtime.shutdown());return {directory,executable,store,runtime,events};
}

async function sessionSettings(f,settings){const doc=await f.store.read(f.store.file);doc.data.records.sessions[0].agentSettingsSnapshot={...doc.data.records.sessions[0].agentSettingsSnapshot,...settings};await f.store.save(doc.data,doc.revision);}

test('discovery returns configured models and auth presence without exposing credential values',()=>{
  const secret='secret-test-value-12345';
  const summary=claudeSummary({env:{ANTHROPIC_AUTH_TOKEN:secret,ANTHROPIC_BASE_URL:'https://private.example',ANTHROPIC_MODEL:'local-model',ANTHROPIC_DEFAULT_SONNET_MODEL:'sonnet-route'}},{},{});
  assert.equal(summary.authenticated,true);assert.equal(summary.configuredModel,'local-model');
  assert.ok(summary.models.some(m=>m[0]==='sonnet-route'));assert.ok(!JSON.stringify(summary).includes(secret));assert.ok(!JSON.stringify(summary).includes('private.example'));
  assert.equal(modelName('$(echo secret)'),'');assert.equal(modelName('model-v1[1m]'),'model-v1[1m]');
  assert.ok(!redactError('bad '+secret,{ANTHROPIC_AUTH_TOKEN:secret}).includes(secret));
});
test('CLI lookup supports GUI PATH install locations without evaluating a command string',async t=>{
  const f=await fixture(t);assert.equal(await findCLI('claude',{PATH:f.directory},f.directory),f.executable);
  assert.equal(await findCLI('nonexistent',{PATH:f.directory},f.directory),null);
});
test('Claude streams real subprocess output once, passes prompt through stdin, and records backend session',async t=>{
  const {runtime,directory}=await fixture(t);const prompt='literal $(touch '+path.join(directory,'must-not-exist')+')';
  await runtime.start({sessionId:'chat',prompt});await until(()=>runtime.runs.get('chat').status==='completed');
  const run=runtime.snapshot().runs[0];assert.equal(run.text,prompt);assert.equal(run.externalId,'claude-fixture');assert.equal(run.model,'local-test-model');
  await assert.rejects(fs.stat(path.join(directory,'must-not-exist')));assert.equal(run.child,undefined);assert.equal(run.texts,undefined);
  assert.equal((await fs.stat(run.cwd)).mode&0o777,0o700);
});
test('Claude errors and permission denials cannot be reported as a completed turn',async t=>{
  for(const [mode,status] of [['error','failed'],['denied','blocked']]){
    const {runtime}=await fixture(t,'Claude',mode);await runtime.start({sessionId:'chat',prompt:'hello'});await until(()=>runtime.runs.get('chat').status===status);
  }
});
test('stop terminates the owned Claude process and double-send is rejected',async t=>{
  const {runtime}=await fixture(t,'Claude','wait');await runtime.start({sessionId:'chat',prompt:'hello'});
  await until(()=>runtime.runs.get('chat').externalId);await assert.rejects(runtime.start({sessionId:'chat',prompt:'again'}),/正在执行/);
  await runtime.stop('chat');await until(()=>runtime.runs.get('chat').status==='interrupted');
});
test('invalid model and archived sessions are rejected before a process starts',async t=>{
  const {runtime,store}=await fixture(t);let doc=await store.read(store.file);doc.data.records.sessions[0].model='fake-demo-model';await store.save(doc.data,doc.revision);
  await assert.rejects(runtime.start({sessionId:'chat',prompt:'hello'}),/模型不在/);assert.equal(runtime.runs.size,0);
  doc=await store.read(store.file);doc.data.records.sessions[0].sessionArchived=true;await store.save(doc.data,doc.revision);
  await assert.rejects(runtime.start({sessionId:'chat',prompt:'hello'}),/归档/);
});
test('a stopped request cannot launch later after saving, and unbound workspace IDs cannot escape local data',async t=>{
  const {runtime,store}=await fixture(t);
  await runtime.stop('chat','pending-request');await assert.rejects(runtime.start({sessionId:'chat',prompt:'hello',requestId:'pending-request'}),/已停止/);assert.equal(runtime.runs.size,0);
  const doc=await store.read(store.file);doc.data.records.sessions[0].workspaceId='../../outside';await store.save(doc.data,doc.revision);
  await runtime.start({sessionId:'chat',prompt:'hello'});await until(()=>runtime.runs.get('chat').status==='completed');
  assert.ok(runtime.runs.get('chat').cwd.startsWith(await fs.realpath(path.join(store.directory,'workspaces'))+path.sep));
});
test('Codex RPC streams, resumes an explicit backend thread and interrupts without granting approvals',async t=>{
  const {runtime,executable,store}=await fixture(t,'Codex');
  const rpc=new CodexRPC(executable,runtime.env,{onMessage:m=>runtime.codexMessage(m)});runtime.rpc=rpc;await rpc.initialize();
  await runtime.start({sessionId:'chat',prompt:'hello'});await until(()=>runtime.runs.get('chat').turnId);
  runtime.codexMessage({method:'item/agentMessage/delta',params:{threadId:'thread-fixture',itemId:'msg',delta:'hello'}});
  runtime.codexMessage({id:500,method:'item/commandExecution/requestApproval',params:{threadId:'thread-fixture',command:'write output',cwd:'/fixture'}});
  assert.equal(runtime.runs.get('chat').status,'waiting');const token=runtime.runs.get('chat').request.token;
  assert.throws(()=>runtime.answer({token,decision:'acceptForSession'}),/无效/);
  runtime.answer({token,decision:'decline'});assert.equal(runtime.runs.get('chat').status,'running');
  runtime.codexMessage({method:'item/completed',params:{threadId:'thread-fixture',item:{id:'msg',type:'agentMessage',text:'hello'}}});
  runtime.codexMessage({method:'turn/completed',params:{threadId:'thread-fixture',turn:{status:'completed'}}});
  assert.equal(runtime.snapshot().runs[0].text,'hello');
  const doc=await store.read(store.file);doc.data.records.sessions[0].runtime=runtime.snapshot().runs[0];await store.save(doc.data,doc.revision);
  await runtime.start({sessionId:'chat',prompt:'continue'});await until(()=>runtime.runs.get('chat').turnId);
  assert.equal(runtime.runs.get('chat').externalId,'thread-fixture');await runtime.stop('chat');await until(()=>runtime.runs.get('chat').status==='interrupted');
});
test('global planning restriction and configured parallel limit apply to real process launches',async t=>{
  const {runtime,store,directory}=await fixture(t,'Claude','wait');
  const doc=await store.read(store.file);doc.data.preferences={local:false,concurrency:1};doc.data.records.sessions.push({...doc.data.records.sessions[0],id:'second'});await store.save(doc.data,doc.revision);
  const argsFile=path.join(directory,'arguments.json');runtime.env.CASTIEL_FIXTURE_ARGS=argsFile;
  const results=await Promise.allSettled([runtime.start({sessionId:'chat',prompt:'hello'}),runtime.start({sessionId:'second',prompt:'hello'})]);
  assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');assert.match(results[1].reason.message,/并行上限/);
  await until(()=>runtime.runs.get('chat').externalId);
  const args=JSON.parse(await fs.readFile(argsFile,'utf8'));assert.equal(args[args.indexOf('--permission-mode')+1],'plan');assert.equal(args.some(v=>v.includes('skip-permissions')),false);
  await runtime.stop('chat');await until(()=>runtime.runs.get('chat').status==='interrupted');
});
test('Codex rebuilds a missing local rollout from saved conversation, but never retries authentication failures',async t=>{
  for(const missing of [true,false]){
    const {runtime,store}=await fixture(t,'Codex');
    const doc=await store.read(store.file), session=doc.data.records.sessions[0];
    const cwd=await fs.realpath(await fs.mkdir(path.join(store.directory,'workspaces','s'),{recursive:true}).then(()=>path.join(store.directory,'workspaces','s')));
    session.runtime={agent:'Codex',cwd,externalId:'old-thread',status:'completed',requestedModel:'system',model:'local-test-model'};
    session.messages=[{who:'我',text:'Remember ORBIT'},{who:'Codex',text:'Remembered'},{who:'我',text:'continue'}];
    await store.save(doc.data,doc.revision);
    const calls=[];
    runtime.rpc={close(){},async request(method,params){calls.push({method,params});if(method==='thread/resume')throw new Error(missing?'no rollout found for thread':'authentication failed');return method==='thread/start'?{thread:{id:'replacement'},model:'local-test-model'}:{turn:{id:'turn'}};}};
    await runtime.start({sessionId:'chat',prompt:'continue'});
    await until(()=>missing?Boolean(runtime.runs.get('chat').turnId):runtime.runs.get('chat').status==='failed');
    if(missing){
      assert.deepEqual(calls.map(c=>c.method),['thread/resume','thread/start','turn/start']);
      assert.match(calls[2].params.input[0].text,/Remember ORBIT/);assert.match(calls[2].params.input[0].text,/continue/);
      assert.match(runtime.runs.get('chat').events.join(' '),/重新建立上下文/);
    }else{assert.equal(calls.length,1);assert.match(runtime.runs.get('chat').error,/authentication failed/);}
  }
});
test('parallel Codex requests remain answerable in order and stopping clears all requests',async t=>{
  const {runtime}=await fixture(t,'Codex');const sent=[];runtime.rpc={send:m=>sent.push(m),close(){},request:async()=>({})};
  const run={id:'run',sessionId:'chat',agent:'Codex',externalId:'thread',status:'running',events:[],texts:new Map()};runtime.runs.set('chat',run);
  runtime.codexMessage({id:1,method:'item/commandExecution/requestApproval',params:{threadId:'thread',command:'first'}});
  const first=run.request.token;
  runtime.codexMessage({id:2,method:'item/tool/requestUserInput',params:{threadId:'thread',questions:[{id:'q',question:'which?',options:[{label:'A'}]}]}});
  assert.equal(run.request.token,first);assert.equal(run.requests.length,2);
  assert.throws(()=>runtime.answer({token:first,decision:'acceptForSession'}),/无效/);
  runtime.answer({token:first,decision:'decline'});
  assert.equal(run.status,'waiting');assert.equal(run.request.kind,'questions');assert.equal(sent[0].id,1);
  assert.throws(()=>runtime.answer({token:run.request.token,answers:{q:'   '}}),/回答/);
  runtime.answer({token:run.request.token,answers:{q:'A\nAdditional detail'}});
  assert.equal(run.status,'running');assert.equal(run.request,undefined);assert.deepEqual(sent[1].result,{answers:{q:{answers:['A\nAdditional detail']}}});
  runtime.codexMessage({id:3,method:'item/fileChange/requestApproval',params:{threadId:'thread'}});
  await runtime.stop('chat');assert.equal(runtime.pending.size,0);assert.equal(run.request,undefined);assert.equal(run.requests,undefined);
});
test('changed conversation directory is used by the CLI without resuming its previous backend session',async t=>{
  const {runtime,store,directory}=await fixture(t);
  await runtime.start({sessionId:'chat',prompt:'first'});await until(()=>runtime.runs.get('chat').status==='completed');
  const doc=await store.read(store.file);doc.data.records.sessions[0].runtime=runtime.snapshot().runs[0];
  const target=path.join(directory,'chosen-folder');await fs.mkdir(target);
  doc.data.records=rebindConversationWorkspace(doc.data.records,'chat',{id:'chosen',name:'chosen',path:target});
  await store.save(doc.data,doc.revision);
  const argsFile=path.join(directory,'arguments.json');runtime.env.CASTIEL_FIXTURE_ARGS=argsFile;
  await runtime.start({sessionId:'chat',prompt:'second'});await until(()=>runtime.runs.get('chat').status==='completed');
  assert.equal(runtime.runs.get('chat').cwd,await fs.realpath(target));
  assert.equal(JSON.parse(await fs.readFile(argsFile,'utf8')).includes('--resume'),false);
});

test('Claude discovers effort and safe permission choices from the installed help text',()=>{
  const help='  --effort <level> Effort level\n    (low, medium, high, xhigh, max)\n  --permission-mode <mode> Permission mode\n    (choices: "acceptEdits", "auto", "bypassPermissions", "manual", "dontAsk", "plan")\n  --next <value> other';
  const info=claudeSummary({effortLevel:'high',permissions:{defaultMode:'acceptEdits'}},{},{},help);
  assert.deepEqual(info.reasoningEfforts,{'*':['low','medium','high','xhigh','max']});
  assert.equal(info.configuredReasoningEffort,'high');assert.equal(info.configuredPermissionMode,'acceptEdits');
  assert.deepEqual(info.capabilities,{effort:true,autoReview:false,permissionModes:['manual','acceptEdits','auto','plan']});
  const older=claudeSummary({},{},{},'  --model <model> Set model');
  assert.deepEqual(older.reasoningEfforts,{});assert.equal(older.capabilities.effort,false);assert.deepEqual(older.capabilities.permissionModes,[]);
  const unlisted=claudeSummary({},{},{},'  --effort <level> Controls high-level work\n  --permission-mode <mode> Automatic choices may vary');
  assert.deepEqual(unlisted.reasoningEfforts,{});assert.deepEqual(unlisted.capabilities.permissionModes,[]);
});

test('Codex catalog uses actual model effort lists and protocol reviewer support',()=>{
  assert.equal(typeof discovery.codexSummary,'function');
  const schema={properties:{effort:{},approvalsReviewer:{$ref:'#/definitions/ApprovalsReviewer'}},definitions:{ApprovalsReviewer:{enum:['user','auto_review','guardian_subagent']}}};
  const info=discovery.codexSummary({model:'model-a',model_reasoning_effort:'high',approvals_reviewer:'auto_review'},[{model:'model-a',defaultReasoningEffort:'low',supportedReasoningEfforts:[{reasoningEffort:'low'},{reasoningEffort:'high'}]},{model:'model-b',supportedReasoningEfforts:[]}],schema);
  assert.deepEqual(info.reasoningEfforts,{'model-a':['low','high'],'model-b':[]});
  assert.deepEqual(info.defaultReasoningEfforts,{'model-a':'low'});
  assert.equal(info.configuredReasoningEffort,'high');assert.equal(info.configuredApprovalsReviewer,'auto_review');assert.equal(info.capabilities.autoReview,true);
  const older=discovery.codexSummary({},[],{});assert.equal(older.capabilities.autoReview,false);assert.equal(older.capabilities.effort,false);
});

test('Codex sends per-session effort and reviewer on the actual turn without granting sandbox permissions',async t=>{
  const f=await fixture(t,'Codex');await sessionSettings(f,{reasoningEffort:'high',approvalsReviewer:'auto_review'});
  const calls=[];f.runtime.rpc={close(){},async request(method,params){calls.push({method,params});return method==='thread/start'?{thread:{id:'thread'},model:'local-test-model'}:{turn:{id:'turn'}};}};
  await f.runtime.start({sessionId:'chat',prompt:'hello'});await until(()=>f.runtime.runs.get('chat').turnId);
  assert.equal(calls[1].params.effort,'high');assert.equal(calls[1].params.approvalsReviewer,'auto_review');
  assert.equal(calls[1].params.approvalPolicy,undefined);assert.equal(calls[0].params.sandbox,undefined);
});

test('Codex system selection restores configured effort and reviewer for a resumed turn',async t=>{
  const f=await fixture(t,'Codex');await sessionSettings(f,{reasoningEffort:'system',approvalsReviewer:'system'});
  const calls=[];f.runtime.rpc={close(){},async request(method,params){calls.push({method,params});return method==='thread/start'?{thread:{id:'thread'},model:'local-test-model'}:{turn:{id:'turn'}};}};
  await f.runtime.start({sessionId:'chat',prompt:'hello'});await until(()=>f.runtime.runs.get('chat').turnId);
  assert.equal(calls[1].params.effort,'medium');assert.equal(calls[1].params.approvalsReviewer,'user');
});

test('unsupported effort and reviewer settings are rejected before launching a turn',async t=>{
  for(const [agent,settings,capabilities] of [['Codex',{reasoningEffort:'max'},null],['Codex',{approvalsReviewer:'auto_review'},{effort:true,autoReview:false}],['Codex',{approvalsReviewer:'never'},null],['Claude',{permissionMode:'bypassPermissions'},null],['Claude',{reasoningEffort:'high'},{effort:false,autoReview:false,permissionModes:['plan']}],['Claude',{permissionMode:'auto'},{effort:true,permissionModes:['plan']}]] ){
    const f=await fixture(t,agent);await sessionSettings(f,settings);if(capabilities)f.runtime.catalog.agents[agent].capabilities=capabilities;
    await assert.rejects(f.runtime.start({sessionId:'chat',prompt:'hello'}),/不支持|无效/);assert.equal(f.runtime.runs.size,0);
  }
});

test('Claude passes effort and native permission mode only when selected, with planning taking priority',async t=>{
  for(const [permissionMode,planning,expected] of [['manual',false,'manual'],['acceptEdits',false,'acceptEdits'],['auto',false,'auto'],['auto',true,'plan'],['system',false,null]]){
    const f=await fixture(t);await sessionSettings(f,{reasoningEffort:permissionMode==='system'?'system':'high',permissionMode,...(planning?{executionMode:'仅规划'}:{})});
    const argsFile=path.join(f.directory,'arguments.json');f.runtime.env.CASTIEL_FIXTURE_ARGS=argsFile;
    await f.runtime.start({sessionId:'chat',prompt:'hello'});await until(()=>f.runtime.runs.get('chat').status==='completed');
    const args=JSON.parse(await fs.readFile(argsFile,'utf8'));
    assert.equal(args.includes('--effort'),permissionMode!=='system');if(permissionMode!=='system')assert.equal(args[args.indexOf('--effort')+1],'high');
    assert.equal(args.includes('--permission-mode'),Boolean(expected));if(expected)assert.equal(args[args.indexOf('--permission-mode')+1],expected);
    assert.equal(args.some(v=>v.includes('skip-permissions')||v==='bypassPermissions'),false);
  }
});

test('Codex stores only public reasoning summaries separately from final answer and stops reasoning activity',async t=>{
  const f=await fixture(t,'Codex');const run={id:'run',sessionId:'chat',agent:'Codex',externalId:'thread',status:'running',text:'',events:[],texts:new Map(),reasoning:[],reasoningActive:false};f.runtime.runs.set('chat',run);
  const send=(method,params)=>f.runtime.codexMessage({method,params:{threadId:'thread',...params}});
  send('item/started',{item:{id:'thought',type:'reasoning'}});assert.equal(run.reasoningActive,true);
  send('item/reasoning/summaryTextDelta',{itemId:'thought',summaryIndex:0,delta:'Public '});send('item/reasoning/summaryTextDelta',{itemId:'thought',summaryIndex:0,delta:'summary'});
  send('item/reasoning/textDelta',{itemId:'thought',delta:'private raw reasoning'});
  send('item/completed',{item:{id:'thought',type:'reasoning',summary:['Public summary','Second summary'],content:['private content'],encryptedContent:'private encrypted'}});
  assert.deepEqual(run.reasoning,[{id:'thought:0',text:'Public summary'},{id:'thought:1',text:'Second summary'}]);assert.equal(run.reasoningActive,false);
  send('turn/completed',{turn:{status:'interrupted'}});const saved=f.runtime.snapshot().runs[0];assert.equal(saved.text,'');assert.equal(saved.reasoningActive,false);assert.equal(saved.status,'interrupted');assert.doesNotMatch(JSON.stringify(saved),/private/);
});

test('Claude thinking deltas and completed thinking blocks deduplicate without exposing signatures or final text',async t=>{
  const {runtime,events}=await fixture(t,'Claude','thinking');await runtime.start({sessionId:'chat',prompt:'hello'});await until(()=>runtime.runs.get('chat').status==='completed');
  const run=runtime.snapshot().runs[0];assert.deepEqual(run.reasoning,[{id:'message:0',text:'Public **summary**'}]);assert.equal(run.text,'');assert.equal(run.reasoningActive,false);assert.doesNotMatch(JSON.stringify(run),/private-signature|private-data/);
  assert.ok(events.some(e=>e.run?.reasoningActive));
});

test('summary-only runs remain message records across later turns and interruption',async t=>{
  const ui=await loadRuntimeUI(t);assert.equal(typeof ui.applyRunToRecord,'function');
  const first={id:'first',agent:'Codex',status:'completed',model:'model',text:'',reasoning:[{id:'summary',text:'Only public summary'}],reasoningActive:false};
  let record=ui.applyRunToRecord({messages:[{who:'我',text:'first'}]},first);
  assert.equal(record.messages.length,2);assert.deepEqual(record.messages[1].reasoning,first.reasoning);assert.equal(record.messages[1].text,'');
  const second={id:'second',agent:'Codex',status:'running',model:'model',text:'',reasoning:[{id:'another',text:'Partial summary'}],reasoningActive:true};
  record=ui.applyRunToRecord({...record,messages:[...record.messages,{who:'我',text:'second'}]},second);
  record=ui.applyRunToRecord(record,{...second,status:'interrupted',reasoningActive:false});
  assert.equal(record.messages.length,4);assert.equal(record.messages[1].reasoning[0].text,'Only public summary');assert.equal(record.messages[3].runStatus,'interrupted');assert.equal(record.messages[3].reasoningActive,false);
  assert.equal(record.messages[3].reasoning[0].text,'Partial summary');
});

test('conversation renders public summaries in collapsed Markdown and keeps final-copy text separate',async t=>{
  const {Conversation}=await loadRuntimeUI(t);
  const html=renderToStaticMarkup(React.createElement(Conversation,{messages:[{who:'Codex',text:'Final answer',runId:'run-first',reasoning:[{id:'r',text:'Public **summary**'}],reasoningActive:false,runStatus:'completed'}]}));
  assert.match(html,/<details[^>]*class="chat-reasoning"/);assert.doesNotMatch(html,/<details[^>]*open/);assert.match(html,/<strong>summary<\/strong>/);assert.match(html,/已思考/);assert.match(html,/Final answer/);
  const thinking=renderToStaticMarkup(React.createElement(Conversation,{messages:[{who:'Claude',text:'',runId:'run-active',reasoning:[],reasoningActive:true,runStatus:'running'}],run:{id:'active',status:'running',reasoningActive:true}}));
  assert.match(thinking,/思考中/);assert.match(thinking,/尚未提供公开摘要/);assert.doesNotMatch(thinking,/复制回复/);
  const stopped=renderToStaticMarkup(React.createElement(Conversation,{messages:[{who:'Claude',text:'',reasoning:[{id:'r',text:'Partial'}],reasoningActive:false,runStatus:'interrupted'}]}));
  assert.match(stopped,/已停止/);assert.match(stopped,/Partial/);
});

test('starting a turn is rejected while native capability settings are being changed',async t=>{
  const {runtime}=await fixture(t);runtime.capabilitiesBusy=true;
  await assert.rejects(runtime.start({sessionId:'chat',prompt:'hello'}),/正在更新/);assert.equal(runtime.runs.size,0);
});

test('a resumed Codex thread explicitly resets high effort and auto review to detected system defaults',async t=>{
  const f=await fixture(t,'Codex'),calls=[];await sessionSettings(f,{reasoningEffort:'high',approvalsReviewer:'auto_review'});
  f.runtime.catalog.agents.Codex.configuredReasoningEffort=null;f.runtime.catalog.agents.Codex.defaultReasoningEfforts={'local-test-model':'low'};
  f.runtime.rpc={close(){},async request(method,params){calls.push({method,params});return method.startsWith('thread/')?{thread:{id:'thread'},model:'local-test-model'}:{turn:{id:'turn-'+calls.length}};}};
  await f.runtime.start({sessionId:'chat',prompt:'first'});await until(()=>f.runtime.runs.get('chat').turnId);
  f.runtime.codexMessage({method:'turn/completed',params:{threadId:'thread',turn:{status:'completed'}}});
  const doc=await f.store.read(f.store.file);doc.data.records.sessions[0].runtime=f.runtime.snapshot().runs[0];await f.store.save(doc.data,doc.revision);
  await sessionSettings(f,{reasoningEffort:'system',approvalsReviewer:'system'});
  await f.runtime.start({sessionId:'chat',prompt:'second'});await until(()=>f.runtime.runs.get('chat').turnId);
  assert.deepEqual(calls.map(call=>call.method),['thread/start','turn/start','thread/resume','turn/start']);
  assert.equal(calls[1].params.effort,'high');assert.equal(calls[3].params.effort,'low');assert.equal(calls[3].params.approvalsReviewer,'user');
});

test('returning to system rebuilds Codex context when an overridden effort has no discoverable default',async t=>{
  const f=await fixture(t,'Codex'),calls=[];await sessionSettings(f,{reasoningEffort:'system'});
  const doc=await f.store.read(f.store.file),session=doc.data.records.sessions[0];
  const cwd=await fs.realpath(await fs.mkdir(path.join(f.store.directory,'workspaces','s'),{recursive:true}).then(()=>path.join(f.store.directory,'workspaces','s')));
  session.runtime={agent:'Codex',cwd,externalId:'old-thread',status:'completed',requestedModel:'system',model:'local-test-model',requestedReasoningEffort:'high',reasoningEffort:'high'};
  session.messages=[{who:'我',text:'Remember preserved history'},{who:'Codex',text:'Saved'},{who:'我',text:'next'}];await f.store.save(doc.data,doc.revision);
  f.runtime.catalog.agents.Codex.configuredReasoningEffort=null;f.runtime.catalog.agents.Codex.defaultReasoningEfforts={};
  f.runtime.rpc={close(){},async request(method,params){calls.push({method,params});return method==='thread/start'?{thread:{id:'replacement'},model:'local-test-model'}:{turn:{id:'turn'}};}};
  await f.runtime.start({sessionId:'chat',prompt:'next'});await until(()=>f.runtime.runs.get('chat').turnId||f.runtime.runs.get('chat').status==='failed');
  assert.equal(calls[0].method,'thread/start');assert.match(calls[1].params.input[0].text,/Remember preserved history/);assert.equal(calls[1].params.effort,undefined);
});
