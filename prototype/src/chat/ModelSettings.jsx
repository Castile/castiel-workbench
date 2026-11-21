import React, {useState} from 'react';
import {CheckCircle, SquaresFour} from '@phosphor-icons/react';
import {getReasoningEfforts} from '../agentData';
import './model-settings.css';
const effortLabel={none:'无',minimal:'最低',low:'低',medium:'中',high:'高',xhigh:'更高',max:'最高',ultra:'Ultra'};
export function ModelSettings({agent,tool,models,model='system',settings={},native,onApply}) {
 const [choice,setChoice]=useState({model,effort:settings.reasoningEffort||'system'});
 const levels=getReasoningEfforts(tool,choice.model),effort=levels.includes(choice.effort)?choice.effort:'system';
 function selectModel(id){setChoice(previous=>({model:id,effort:getReasoningEfforts(tool,id).includes(previous.effort)?previous.effort:'system'}))}
 return <form className="conversation-model-settings" onSubmit={e=>{e.preventDefault();onApply({model:choice.model,reasoningEffort:effort})}}>
  <div className="picker-agent"><SquaresFour size={20}/><strong>{agent}</strong><span>当前对话 · 下次发送生效</span></div>
  <div className="selection-list" role="radiogroup" aria-label="当前对话模型">{models.map(([id,label,description])=><label className={'selection-option '+(choice.model===id?'current':'')} key={id}>
   <input type="radio" name="conversation-model" value={id} checked={choice.model===id} onChange={()=>selectModel(id)}/><div><strong>{label}</strong><small>{description}</small></div>{choice.model===id&&<CheckCircle className="blue" size={20} weight="fill"/>}
  </label>)}</div>
  <label className="field">{agent==='Claude'?'思考投入（Effort）':'推理强度'}<select aria-label="当前对话推理强度" value={effort} onChange={e=>setChoice(c=>({...c,effort:e.target.value}))} disabled={!levels.length}><option value="system">沿用工具配置</option>{levels.map(level=><option value={level} key={level}>{effortLabel[level]||level} · {level}</option>)}</select></label>
  <p className="model-setting-note">{!native?'浏览器仅展示交互；实际能力由本机工具提供。':levels.length?agent==='Claude'?'使用本机 Claude Code 支持的 --effort 级别，模型与服务仍可能限制可用范围。':'级别来自本机模型目录；更高强度通常需要更多时间和用量。':'该模型尚未提供可确认的强度选项，沿用工具配置。'} 设置仅影响本对话的后续输入。</p>
  <button className="primary wide" type="submit">应用到下一次发送</button>
 </form>
}
