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
