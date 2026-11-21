import test from 'node:test';
import assert from 'node:assert/strict';
import {agentDefaults,getAgentModels,hasSession,initialSpaces,taskSpace,mergeDiscoveredAgents} from '../src/agentData.js';

test('separate agent defaults keep model and allowed spaces independent',()=>{
 const codex={defaultModel:'coding',defaultSpace:'personal',workspaceIds:['payments','personal']};
 const claude={defaultModel:'reasoning',defaultSpace:'admin',workspaceIds:['admin']};
 const first=agentDefaults(codex,initialSpaces),second=agentDefaults(claude,initialSpaces);
 assert.equal(first.model,'coding');assert.equal(first.workspaceId,'personal');
 assert.deepEqual(first.spaces.map(s=>s.id),['payments','personal']);
 assert.equal(second.model,'reasoning');assert.equal(second.workspaceId,'admin');
 assert.deepEqual(second.spaces.map(s=>s.id),['admin']);
});
test('adding a workspace does not expand an existing explicit agent selection',()=>{
 const result=agentDefaults({defaultSpace:'payments',workspaceIds:['payments']},[...initialSpaces,{id:'research'}]);
 assert.deepEqual(result.spaces.map(s=>s.id),['payments']);
});
test('missing default space falls back only inside allowed spaces and empty selection stays empty',()=>{
 assert.equal(agentDefaults({defaultSpace:'removed',workspaceIds:['personal']},initialSpaces).workspaceId,'personal');
 assert.equal(agentDefaults({defaultSpace:'payments',workspaceIds:[]},initialSpaces).workspaceId,'');
 assert.equal(getAgentModels('Custom tool')[0][0],'system');
});
test('session inventory excludes unstarted tasks and keeps workspace independent of project',()=>{
 assert.equal(hasSession({messages:[]}),false);
 assert.equal(hasSession({sessionKind:'agent',messages:[]}),true);
 assert.equal(hasSession({messages:[{text:'existing'}]}),true);
 assert.equal(taskSpace({workspaceId:'research',projectId:'payments'}),'research');
 assert.equal(taskSpace({projectId:'payments'}),'');
});
test('auto-discovery adds installed tools without overriding independent user settings',()=>{
 const original={Codex:{enabled:false,defaultModel:'my-model',workspaceIds:['personal']}};
 const catalog={agents:{Codex:{installed:true},Claude:{installed:true}}};
 const next=mergeDiscoveredAgents(original,catalog,initialSpaces);
 assert.equal(next.Codex,original.Codex);assert.equal(next.Claude.defaultModel,'system');assert.deepEqual(next.Claude.workspaceIds,['payments']);
 assert.equal(mergeDiscoveredAgents(next,catalog,initialSpaces),next);
 assert.equal(mergeDiscoveredAgents({},catalog,initialSpaces).Gemini,undefined);
});

test('retiring Gemini removes new-tool configuration without changing historical data or other Agent objects',async()=>{
 const {retireGemini}=await import('../src/agentData.js');
 const codex={enabled:false,defaultModel:'my-model'},claude={enabled:true};
 const config={Codex:codex,Claude:claude,Gemini:{enabled:true}};
 const next=retireGemini(config);
 assert.equal(next.Gemini,undefined);assert.equal(next.Codex,codex);assert.equal(next.Claude,claude);
 assert.equal(retireGemini(next),next);assert.ok(config.Gemini);
});
test('effort options resolve the effective model and discard unsupported or duplicated levels',async()=>{
 const {getReasoningEfforts}=await import('../src/agentData.js');
 const tool={configuredModel:'coding',reasoningEfforts:{coding:['low','high','high','bogus'],fast:['low']}};
 assert.deepEqual(getReasoningEfforts(tool,'system'),['low','high']);
 assert.deepEqual(getReasoningEfforts(tool,'fast'),['low']);assert.deepEqual(getReasoningEfforts(tool,'unknown'),[]);
 assert.deepEqual(getReasoningEfforts({reasoningEfforts:{'*':['low','medium','high']}},'custom'),['low','medium','high']);
});
test('new session snapshots retain differentiated settings without copying unrelated fields',async()=>{
 const {snapshotAgentSettings}=await import('../src/agentData.js');
 const config={instructions:'keep scope',executionMode:'仅规划',reasoningEffort:'high',approvalsReviewer:'auto_review',permissionMode:'manual',private:'do-not-copy'};
 assert.deepEqual(snapshotAgentSettings(config),{instructions:'keep scope',executionMode:'仅规划',reasoningEffort:'high',approvalsReviewer:'auto_review',permissionMode:'manual'});
 assert.equal(snapshotAgentSettings({}).reasoningEffort,'system');
});
