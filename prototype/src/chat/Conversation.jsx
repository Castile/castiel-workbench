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
    return <article className={`chat-message ${own?'chat-user':'chat-assistant'}`} aria-label={`${own?'你':message.who}的消息`} key={message.runId||i}>
      {!own&&<div className="chat-agent-heading"><AgentIcon name={message.who} size={25}/><strong>{message.who}</strong>{message.model&&<span>{message.model}</span>}{streaming&&<span className="reply-streaming">正在回复<span/></span>}</div>}
      <div className="chat-message-content">{own?<div className="user-bubble">{message.text}</div>:<Markdown text={message.text}/>}</div>
      {message.attachment&&<div className="chat-attachment"><Paperclip size={14}/>{message.attachment}<small>仅文件名</small></div>}
      <div className="chat-message-actions"><CopyButton text={message.text} label={own?'复制提问':'复制回复'}/>{!streaming&&<time>{message.time}</time>}</div>
    </article>;
  })}</div>{children}</div>;
}
export function LatestButton({onClick}){return <button className="latest-message" onClick={onClick}><ArrowDown size={15}/>回到最新</button>}
