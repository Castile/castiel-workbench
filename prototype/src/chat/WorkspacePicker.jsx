import React,{useState} from 'react';
import {FolderSimple,FolderOpen,CheckCircle,Plus} from '@phosphor-icons/react';
import './workspace-picker.css';

export function WorkspacePicker({current,spaces,sessions,locked,native,onApply,onNewConversation}) {
  const [choice,setChoice]=useState({kind:'existing',id:current?.id}),[selecting,setSelecting]=useState(false),[error,setError]=useState('');
  async function chooseDirectory(){
    setSelecting(true);setError('');
    try{const directory=await window.castielDesktop.chooseDirectory();if(directory)setChoice({kind:'directory',directory})}catch(e){setError(e.message)}finally{setSelecting(false)}
  }
  async function act(handler){try{setError('');await handler(choice)}catch(e){setError(e.message)}}
  const options=spaces.some(s=>s.id===current?.id)?spaces:[...(current?[current]:[]),...spaces];
  return <div className="conversation-workspaces">
    <div className="current-workspace"><FolderSimple size={22}/><div><strong>当前对话 · {current?.name||'未指定空间'}</strong><code>{current?.path||'使用工作台的本地默认目录'}</code></div></div>
    <p className="muted">一个工作空间可以有多个独立对话，各自保留消息与上下文。</p>
    <div className="workspace-options" role="radiogroup" aria-label="选择对话工作空间" onKeyDown={event=>{if(!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft'].includes(event.key))return;const choices=[...event.currentTarget.querySelectorAll('button[role=radio]:not([disabled])')],index=choices.indexOf(document.activeElement);if(index<0)return;event.preventDefault();const next=choices[(index+(event.key==='ArrowDown'||event.key==='ArrowRight'?1:-1)+choices.length)%choices.length];next?.focus();next?.click()}}>{options.map(s=>{
      const selected=choice.kind==='existing'&&choice.id===s.id,count=sessions.filter(t=>t.workspaceId===s.id&&!t.sessionArchived).length;
      return <button type="button" role="radio" aria-checked={selected} className={'workspace-choice '+(selected?'selected':'')} key={s.id} disabled={selecting} onClick={()=>setChoice({kind:'existing',id:s.id})}><FolderSimple size={21}/><span><strong>{s.name}</strong><small>{s.path||'尚未绑定电脑目录'}</small></span><small>{count} 个对话</small>{selected&&<CheckCircle size={19} weight="fill"/>}</button>;
    })}{choice.kind==='directory'&&<div className="workspace-choice selected"><FolderOpen size={21}/><span><strong>{spaces.find(s=>s.path===choice.directory)?.name||choice.directory.split(/[\\/]/).filter(Boolean).at(-1)||choice.directory}</strong><small>{choice.directory}</small></span><CheckCircle size={19} weight="fill"/></div>}</div>
    <button type="button" className="secondary choose-conversation-directory" onClick={chooseDirectory} disabled={!native||selecting}><FolderOpen size={18}/>{selecting?'正在选择…':'选择电脑中的目录'}</button>
    {!native&&<p className="table-note">浏览器演示不访问本机目录；请在桌面应用中选择文件夹。</p>}
    {locked&&<p className="workspace-lock-note">当前对话正在执行或已归档，不能更换目录。你仍可在此空间新建独立对话。</p>}
    {error&&<p className="request-error" role="alert">{error}</p>}
    <p className="table-note">应用只更换当前对话的范围，其他对话保持原目录。选择目录不会自动发送消息或执行任务。</p>
    <div className="workspace-picker-actions"><button type="button" className="secondary" disabled={selecting} onClick={()=>act(onNewConversation)}><Plus size={16}/>在此空间新建对话</button><button type="button" className="primary" disabled={selecting||locked} onClick={()=>act(onApply)}>应用到当前对话</button></div>
  </div>;
}
