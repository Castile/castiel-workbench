import { agentDefaults } from '../agentData.js';
import { presentRecords, updateRecord } from './records.js';

const busy = runtime => ['starting','running','waiting','stopping'].includes(runtime?.status);
export function createWorkspaceConversation({workspace,agent,model='system',settings={},ruleVersion='v1.2'}) {
  if(!workspace?.id || !agent)throw new Error('请先选择 Agent 和工作空间');
  return {id:crypto.randomUUID(),title:'新对话',sessionKind:'agent',projectId:null,agent,model,
    workspaceId:workspace.id,workspaceSnapshot:{id:workspace.id,name:workspace.name,path:workspace.path},
    agentSettingsSnapshot:{instructions:settings.instructions||'',executionMode:settings.executionMode||'自动执行'},
    ruleVersion,status:'等待输入',date:new Date().toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'}),messages:[],
    context:['等待输入',`工作空间：${workspace.name}`,'尚未执行工具或验证','输入消息后开始本次对话']};
}
export function registerDirectoryWorkspace({spaces,agentConfig},agent,directory) {
  if(typeof directory!=='string'||!directory||!(/^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(directory)))throw new Error('请选择本机的绝对目录路径');
  if(!Object.hasOwn(agentConfig,agent))throw new Error('Agent 设置不存在');
  let workspace=spaces.find(s=>s.path===directory),nextSpaces=spaces;
  if(!workspace){workspace={id:crypto.randomUUID(),name:directory.split(/[\\/]/).filter(Boolean).at(-1)||directory,path:directory};nextSpaces=[...spaces,workspace];}
  const available=agentDefaults(agentConfig[agent],spaces).spaces.map(s=>s.id);
  let nextConfig=agentConfig;
  if(!available.includes(workspace.id)){
    // Freeze legacy implicit lists before adding a directory; do not expand other Agents.
    nextConfig=Object.fromEntries(Object.entries(agentConfig).map(([name,config])=>[name,config.workspaceIds?config:{...config,workspaceIds:spaces.map(s=>s.id)}]));
    nextConfig[agent]={...nextConfig[agent],workspaceIds:[...available,workspace.id]};
  }
  return {workspace,spaces:nextSpaces,agentConfig:nextConfig};
}
export function rebindConversationWorkspace(records,id,workspace) {
  const row=presentRecords(records).find(r=>r.id===id);
  if(!row)throw new Error('对话不存在');
  if(row.sessionArchived)throw new Error('请先恢复已归档的对话');
  if(busy(row.runtime))throw new Error('请先停止当前执行，再更换工作空间');
  if(!workspace?.id||typeof workspace.path!=='string')throw new Error('工作空间无效');
  if(row.workspaceId===workspace.id&&row.workspaceSnapshot?.path===workspace.path)return records;
  return updateRecord(records,id,t=>({...t,workspaceId:workspace.id,workspaceSnapshot:{id:workspace.id,name:workspace.name,path:workspace.path},
    status:'等待输入',runtime:t.runtime?{id:t.runtime.id,agent:t.agent,startedAt:t.runtime.startedAt,status:'handedOff'}:undefined,
    messages:[...t.messages,{who:'系统',time:'刚刚',text:`工作空间已设为「${workspace.name}」${workspace.path?'（'+workspace.path+'）':''}。后续输入使用此目录；已有对话记录保留，工具会话将在下次发送时重新建立。`}],
    context:[t.context?.[0]||'等待输入',`工作空间：${workspace.name}`,t.context?.[2]||'',t.context?.[3]||'']}));
}
