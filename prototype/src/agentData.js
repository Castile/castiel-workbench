export const modelCatalog={
 Codex:[['system','系统默认','沿用 Codex 的模型配置'],['coding','编程模型（示例）','用于展示代码任务的模型选择'],['fast','快速模型（示例）','用于展示轻量任务的模型选择']],
 Claude:[['system','系统默认','沿用 Claude 的模型配置'],['reasoning','推理模型（示例）','用于展示复杂分析的模型选择'],['fast','快速模型（示例）','用于展示轻量任务的模型选择']],
 Gemini:[['system','系统默认','沿用 Gemini 的模型配置'],['long','长上下文模型（示例）','用于展示资料整理的模型选择'],['fast','快速模型（示例）','用于展示轻量任务的模型选择']]
};
export const initialSpaces=[{id:'payments',name:'支付工作空间',path:''},{id:'admin',name:'管理后台空间',path:''},{id:'personal',name:'个人空间',path:''}];
export const getAgentModels=name=>modelCatalog[name]||[['system','系统默认','由该工具配置决定']];
export function agentDefaults(config={},spaces=[]){const ids=config.workspaceIds||spaces.map(s=>s.id),available=spaces.filter(s=>ids.includes(s.id));return {model:config.defaultModel||'system',workspaceId:available.some(s=>s.id===config.defaultSpace)?config.defaultSpace:available[0]?.id||'',spaces:available};}
export const hasSession=t=>Boolean(t.sessionKind==='agent'||t.sessionId||t.messages?.length>0);
export const taskSpace=t=>t.workspaceId||'';
export function mergeDiscoveredAgents(config, catalog, spaces) {
 let next=config;const id=spaces[0]?.id;
 for(const name of ['Codex','Claude'])if(catalog.agents?.[name]?.installed&&!Object.hasOwn(config,name)&&id){if(next===config)next={...config};next[name]={enabled:true,workspaceIds:[id],defaultModel:'system',defaultSpace:id};}
 return next;
}
