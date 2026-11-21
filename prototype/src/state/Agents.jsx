import React, { createContext, useContext, useEffect, useState } from 'react';
import { modelCatalog } from '../agentData';
import { presentRecords, updateRecord } from './records';
import './agents-runtime.css';
import { RequestCard } from '../chat/RequestCard';
const Context = createContext(null);
export const runBusy = run => ['starting','running','waiting','stopping'].includes(run?.status);
export const runStatus = { starting:'正在连接',running:'执行中',waiting:'等待确认',stopping:'正在停止',completed:'本轮完成',blocked:'已阻塞',failed:'执行失败',interrupted:'已停止' };
export function applyRunToRecord(record,run){
  const messageId='run-'+run.id,existing=record.messages.findIndex(message=>message.runId===messageId);
  const message={who:run.agent,time:runBusy(run)?'正在输出…':'真实运行',text:run.text||'',runId:messageId,model:run.model||'本机默认',agent:run.agent,reasoning:run.reasoning||[],reasoningActive:Boolean(run.reasoningActive),runStatus:run.status};
  const messages=existing<0?[...record.messages,message]:record.messages.map((value,index)=>index===existing?message:value);
  return {...record,messages,status:runStatus[run.status]||'待开始',runtime:run};
}
export function AgentsProvider({ children }) {
  const native = window.castielDesktop;
  const [state, setState] = useState({ catalog:{checking:Boolean(native),agents:{}},runs:[],loaded:!native,error:'' });
  useEffect(() => {
    if (!native) return;
    let active=true,catalogUpdated=false;
    const off = native.onAgentEvent(event => {if(event.type==='catalog')catalogUpdated=true;setState(s => event.type==='catalog' ? {...s,catalog:event.catalog} : event.type==='run' ? {...s,runs:[...s.runs.filter(r=>r.sessionId!==event.run.sessionId),event.run]} : s)});
    native.agentState().then(snapshot=>{if(active)setState(s=>({...s,catalog:catalogUpdated?s.catalog:snapshot.catalog,runs:[...new Map([...snapshot.runs,...s.runs].map(r=>[r.sessionId,r])).values()],loaded:true}))}).catch(error=>{if(active)setState(s=>({...s,loaded:true,error:error.message}))});
    return ()=>{active=false;off()};
  }, []);
  const models = agent => native ? state.catalog.agents[agent]?.models || [['system','本机默认','启动时自动读取本机配置']] : modelCatalog[agent] || [['system','系统默认','由工具配置决定']];
  const ready = agent => !native || Boolean(state.catalog.agents[agent]?.ready);
  const refresh = async () => { try { const catalog=await native.detectAgents();setState(s=>({...s,catalog,error:''})); }catch(error){setState(s=>({...s,error:error.message}));} };
  return <Context.Provider value={{...state,native:Boolean(native),models,ready,refresh,start:args=>native.startAgent(args),stop:(id,requestId)=>native.stopAgent(id,requestId),answer:answer=>native.answerAgent(answer)}}>{children}</Context.Provider>;
}
export function useAgents(){return useContext(Context)}
export function useAgentRecords(records,setRecords){
  const agents=useAgents();
  useEffect(()=>{
    if(!agents.native||!agents.loaded)return;
    setRecords(current=>{
      let next=current;
      for(const row of presentRecords(current)){
        const run=agents.runs.find(r=>r.sessionId===row.id);
        if(run&&row.runtime?.id!==run.id&&row.runtime?.startedAt>=run.startedAt)continue;
        if(run&&(row.agent!==run.agent||(row.runtime?.id===run.id&&row.runtime.status==='handedOff')))continue;
        if(!run){if(runBusy(row.runtime))next=updateRecord(next,row.id,t=>applyRunToRecord(t,{...t.runtime,status:'interrupted',reasoningActive:false,error:'上次运行已中断；输出已保留，可继续发送。'}));continue;}
        const previous=row.runtime;
        if(previous && JSON.stringify(previous)===JSON.stringify(run))continue;
        next=updateRecord(next,row.id,t=>applyRunToRecord(t,run));
      }
      return next;
    });
  },[agents.runs,agents.loaded,agents.native,setRecords]);
}
export function LocalAgentStatus({agent,compact=false}){
  const agents=useAgents();if(!agents.native)return null;
  const tool=agents.catalog.agents[agent];
  return <div className={'local-agent-status '+(tool?.ready?'ready':'')+(compact?' compact':'')} role="status"><span className="local-status-dot"/><span>{agents.catalog.checking?'正在检测本机工具…':tool?.status||'尚未接入此工具'}{!compact&&tool?.ready&&' · '+tool.authLabel}</span><button onClick={agents.refresh} disabled={agents.catalog.checking}>重新检测</button>{!compact&&<small>{agents.error||tool?.message||tool?.provider||(!tool?.ready?'安装并登录本机命令行工具后自动加载':'')}</small>}</div>
}
export function LocalAgentDetails({agent}){
  const agents=useAgents();if(!agents.native)return null;const tool=agents.catalog.agents[agent];
  return <section className="local-agent-details"><LocalAgentStatus agent={agent}/>{tool?.installed&&<dl><dt>工具版本</dt><dd>{tool.version}</dd><dt>启动入口</dt><dd>{tool.executable}</dd><dt>配置来源</dt><dd>{tool.configPaths?.join('、')}</dd><dt>默认模型</dt><dd>{tool.configuredModel||'由工具决定'}</dd></dl>}<p>认证由本机工具管理，工作台不复制密钥。配置变更后可重新检测；已有会话保留原空间和选择。</p></section>
}
export function AgentRequest({run}){const agents=useAgents();return run?.request?<RequestCard key={run.request.token} run={run} onAnswer={agents.answer}/>:null}
