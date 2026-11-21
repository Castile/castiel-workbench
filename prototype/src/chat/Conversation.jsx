import React, { useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, Paperclip, Info } from '@phosphor-icons/react';
import { AgentIcon } from './AgentIcon';
import { Markdown, CopyButton } from './Markdown';
import './chat.css';

export function useChatScroll(scroll,sessionId,active,activity) {
  const pinned=useRef(true),[atBottom,setAtBottom]=useState(true);
  const toLatest=()=>{pinned.current=true;setAtBottom(true);const el=scroll.current;if(el)el.scrollTop=el.scrollHeight};
  useLayoutEffect(()=>{pinned.current=true;setAtBottom(true);if(active)toLatest()},[sessionId,active]);
  useLayoutEffect(()=>{if(active&&pinned.current)toLatest()},[activity,active]);
  useLayoutEffect(()=>{
    const el=scroll.current;if(!el||!active)return;
    const observe=()=>{if(pinned.current)el.scrollTop=el.scrollHeight};
    const resize=new ResizeObserver(observe);if(el.firstElementChild)resize.observe(el.firstElementChild);
    return()=>resize.disconnect();
  },[sessionId,active]);
  const onScroll=()=>{const el=scroll.current;if(!el)return;const near=el.scrollHeight-el.scrollTop-el.clientHeight<100;pinned.current=near;setAtBottom(near)};
  return {onScroll,atBottom,toLatest};
}
export function Conversation({messages,run,children}) {
  return <div className="conversation-flow"><div className="chat-messages" role="log" aria-label="对话记录" aria-live="off">{messages.map((message,i)=>{
    const own=message.who==='我',system=message.who==='系统';
    if(system)return <div className="chat-system" key={message.runId||i}><Info size={14}/><span>{message.text}</span></div>;
    const streaming=run&&['starting','running','waiting','stopping'].includes(run.status)&&message.runId==='run-'+run.id;
    const status=streaming?run.status:message.runStatus,reasoning=message.reasoning||[],thinking=streaming?Boolean(run.reasoningActive):Boolean(message.reasoningActive);
    const thoughtLabel=status==='interrupted'?'已停止':status==='failed'||status==='blocked'?'思考未完成':thinking?'思考中':'已思考';
    const activity=thinking?'工具正在思考，尚未提供公开摘要。':status==='starting'?'正在连接本机工具…':status==='waiting'?'等待你的确认，工具尚未返回回复内容。':status==='stopping'?'正在停止本轮执行…':status==='running'?'工具正在执行，尚未返回回复内容。':status==='interrupted'?'本轮已停止。':status==='failed'||status==='blocked'?'本轮执行未完成。':reasoning.length?'本轮没有返回最终回复，公开思考摘要已保留。':'工具未返回可展示的回复内容。';
    return <article className={`chat-message ${own?'chat-user':'chat-assistant'}`} aria-label={`${own?'你':message.who}的消息`} key={message.runId||i}>
      {!own&&<div className="chat-agent-heading"><AgentIcon name={message.who} size={25}/><strong>{message.who}</strong>{message.model&&<span>{message.model}</span>}{streaming&&<span className="reply-streaming">正在回复<span/></span>}</div>}
      {!own&&(reasoning.length>0||thinking)&&<details className="chat-reasoning"><summary><span className={'reasoning-state'+(thinking?' active':'')}/><span>{thoughtLabel}</span><small>公开思考摘要</small></summary><div className="chat-reasoning-content">{reasoning.length?reasoning.map(part=><div className="chat-reasoning-part" key={part.id}><Markdown text={part.text}/></div>):<p className="chat-activity">工具尚未提供公开摘要。</p>}</div></details>}
      <div className="chat-message-content">{own?<div className="user-bubble">{message.text}</div>:message.text?<Markdown text={message.text}/>:<p className="chat-activity" role={streaming?'status':undefined}>{activity}</p>}</div>
      {message.attachment&&<div className="chat-attachment"><Paperclip size={14}/>{message.attachment}<small>仅文件名</small></div>}
      <div className="chat-message-actions">{message.text&&<CopyButton text={message.text} label={own?'复制提问':'复制回复'}/>}{!streaming&&<time>{message.time}</time>}</div>
    </article>;
  })}</div>{children}</div>;
}
export function LatestButton({onClick}){return <button className="latest-message" onClick={onClick}><ArrowDown size={15}/>回到最新</button>}
