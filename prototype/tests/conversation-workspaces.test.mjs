import test from 'node:test';
import assert from 'node:assert/strict';
import * as workspaces from '../src/state/conversation-workspaces.js';
import { addRecords, presentRecords, pendingRun } from '../src/state/records.js';

const space={id:'folder',name:'研发目录',path:'/work/research'};
test('one folder hosts multiple empty independent conversations without creating tasks or sharing messages',()=>{
  const first=workspaces.createWorkspaceConversation({workspace:space,agent:'Codex',settings:{instructions:'中文',executionMode:'仅规划'}});
  const second=workspaces.createWorkspaceConversation({workspace:space,agent:'Codex'});
  assert.notEqual(first.id,second.id);assert.equal(first.workspaceId,second.workspaceId);assert.equal(first.projectId,null);
  assert.deepEqual(first.messages,[]);assert.notEqual(first.messages,second.messages);assert.notEqual(first.workspaceSnapshot,space);
  const records=addRecords({tasks:[],sessions:[]},[first,second]);assert.equal(records.tasks.length,0);assert.equal(presentRecords(records).length,2);
  assert.equal(first.agentSettingsSnapshot.executionMode,'仅规划');assert.equal(first.agentSettingsSnapshot.instructions,'中文');
});
test('directory reuse preserves workspace identity and Agent defaults, while a new directory is enabled only for the choosing Agent',()=>{
  const config={Codex:{enabled:true,workspaceIds:['folder'],defaultSpace:'folder',defaultModel:'fixed'},Claude:{enabled:false,workspaceIds:['folder']},Legacy:{enabled:true}};
  const original={spaces:[space],agentConfig:config};
  const reused=workspaces.registerDirectoryWorkspace(original,'Codex','/work/research');
  assert.equal(reused.workspace.id,'folder');assert.equal(reused.spaces.length,1);assert.equal(reused.agentConfig,config);
  const added=workspaces.registerDirectoryWorkspace(original,'Codex','/work/second');
  assert.equal(added.workspace.name,'second');assert.equal(added.spaces.length,2);
  assert.deepEqual(added.agentConfig.Codex.workspaceIds,['folder',added.workspace.id]);assert.equal(added.agentConfig.Codex.defaultSpace,'folder');assert.equal(added.agentConfig.Codex.defaultModel,'fixed');
  assert.equal(added.agentConfig.Claude,config.Claude);assert.deepEqual(added.agentConfig.Legacy.workspaceIds,['folder']);assert.equal(original.spaces.length,1);
  assert.throws(()=>workspaces.registerDirectoryWorkspace(original,'Codex','relative/path'));
});
test('rebinding only the selected conversation keeps history and sibling scope but invalidates its backend thread',()=>{
  let records=addRecords({tasks:[],sessions:[]},[workspaces.createWorkspaceConversation({workspace:space,agent:'Codex'}),workspaces.createWorkspaceConversation({workspace:space,agent:'Codex'})]);
  const first=records.sessions[0];first.messages=[{who:'我',text:'keep history'}];first.runtime={id:'old-run',agent:'Codex',cwd:'/work/research',externalId:'old-backend',status:'completed'};
  const sibling=structuredClone(records.sessions[1]);const nextSpace={id:'other',name:'其他目录',path:'/work/other'};
  const next=workspaces.rebindConversationWorkspace(records,first.id,nextSpace);
  assert.equal(next.sessions[0].workspaceId,'other');assert.equal(next.sessions[0].messages[0].text,'keep history');assert.equal(next.sessions[0].runtime.status,'handedOff');
  assert.equal(pendingRun(presentRecords(next)[0],'new-run').externalId,undefined);assert.deepEqual(next.sessions[1],sibling);
  assert.equal(records.sessions[0].workspaceId,'folder');
});
test('running or archived conversations cannot be rebound and unchanged selections are no-ops',()=>{
  const first=workspaces.createWorkspaceConversation({workspace:space,agent:'Codex'});const records=addRecords({tasks:[],sessions:[]},[first]);
  assert.equal(workspaces.rebindConversationWorkspace(records,first.id,space),records);
  first.runtime={status:'running'};const busy=addRecords({tasks:[],sessions:[]},[first]);
  assert.throws(()=>workspaces.rebindConversationWorkspace(busy,first.id,{...space,path:'/other'}),/停止/);
  const archived=addRecords({tasks:[],sessions:[]},[{...first,runtime:undefined,sessionArchived:true}]);
  assert.throws(()=>workspaces.rebindConversationWorkspace(archived,first.id,{...space,path:'/other'}),/归档/);
});

test('new sibling conversations snapshot Agent-specific controls independently from later default edits',()=>{
 const settings={reasoningEffort:'high',approvalsReviewer:'auto_review',permissionMode:'system',instructions:'中文回答'};
 const row=workspaces.createWorkspaceConversation({workspace:{id:'work',name:'本机空间',path:'/tmp/work'},agent:'Codex',settings});
 settings.reasoningEffort='low';
 assert.equal(row.agentSettingsSnapshot.reasoningEffort,'high');
 assert.equal(row.agentSettingsSnapshot.approvalsReviewer,'auto_review');
 assert.equal(row.agentSettingsSnapshot.instructions,'中文回答');
});
