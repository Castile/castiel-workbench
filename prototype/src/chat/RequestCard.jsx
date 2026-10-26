import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ShieldCheck, ChatCircleDots, Eye, EyeSlash, Circle } from '@phosphor-icons/react';
import { Markdown } from './Markdown';

export function RequestCard({run,onAnswer}) {
  const request=run.request, questions=request?.questions||[], group=useId(), field=useRef();
  const [values,setValues]=useState({}),[step,setStep]=useState(0),[error,setError]=useState(''),[sending,setSending]=useState(false),[shown,setShown]=useState(false);
  useEffect(()=>{field.current?.focus({preventScroll:true})},[step]);
  if(!request)return null;
  const question=questions[step], value=values[question?.id]||{}, hasOptions=!question?.isSecret&&question?.options?.length>0;
  const answerFor=q=>{const v=values[q.id]||{};return v.mode==='option' ? v.choice+(v.note?.trim()?'\n\n'+v.note.trim():'') : v.text||''};
  const update=patch=>{setValues(v=>({...v,[question.id]:{...v[question.id],...patch}}));setError('')};
  function valid(q){const answer=answerFor(q);return answer.trim()&&answer.length<=4000}
  async function submit(decision){
    if(sending)return;
    if(request.kind==='questions'){
      const missing=questions.findIndex(q=>!valid(q));
      if(missing>=0){setStep(missing);setError('请选择或填写回答，每题最多 4000 字符。');return;}
    }
    setSending(true);setError('');
    try{await onAnswer({token:request.token,decision,answers:Object.fromEntries(questions.map(q=>[q.id,answerFor(q)]))})}catch(e){setError(e.message||'提交失败，请重试');setSending(false)}
  }
  function next(){if(!valid(question)){setError('请选择或填写回答，每题最多 4000 字符。');return}setStep(n=>n+1);setShown(false);setError('')}
  const pending=(run.requests?.length||1)-1;
  return <section className="request-card" aria-label={request.kind==='questions'?'Agent 等待补充信息':'Agent 等待本次授权'} aria-busy={sending}>
    <header className="request-heading"><span className="request-symbol">{request.kind==='questions'?<ChatCircleDots size={19}/>:<ShieldCheck size={19}/>}</span><div><strong>{request.kind==='questions'?'一起确认一下':'需要你的授权'}</strong><small>{request.kind==='questions'?'你的回答会交给当前 Agent，继续这轮工作':'只授权当前请求；仍沿用本机工具的权限规则'}</small></div><span className="request-count">{request.kind==='questions'?`${step+1} / ${questions.length}`:'等待确认'}</span></header>
    {request.reason&&<Markdown text={request.reason}/>}
    {request.kind==='questions'&&question?<>
      {questions.length>1&&<nav className="question-steps" aria-label="切换问题">{questions.map((q,i)=><button type="button" key={q.id} aria-label={`问题 ${i+1}${valid(q)?'，已回答':''}`} aria-current={i===step?'step':undefined} onClick={()=>{setStep(i);setShown(false);setError('')}} disabled={sending}>{valid(q)?<Check size={13}/>:i+1}<span>{q.header||`问题 ${i+1}`}</span></button>)}</nav>}
      <fieldset disabled={sending} className="question-field"><legend>{question.question}</legend>
        {hasOptions?<div className="answer-options">{question.options.map((option,i)=><label className={`answer-option ${value.mode==='option'&&value.choice===option.label?'selected':''}`} key={option.label}>
          <input ref={i===0?field:undefined} type="radio" name={`${group}-${question.id}`} value={option.label} checked={value.mode==='option'&&value.choice===option.label} onChange={()=>update({mode:'option',choice:option.label})}/><span><strong>{option.label}</strong>{option.description&&<small>{option.description}</small>}</span><span className="answer-radio" aria-hidden="true">{value.mode==='option'&&value.choice===option.label&&<span/>}</span>
        </label>)}<label className={`answer-option custom-option ${value.mode==='text'?'selected':''}`}><input type="radio" name={`${group}-${question.id}`} checked={value.mode==='text'} onChange={()=>update({mode:'text'})}/><span><strong>自行填写</strong><small>用自己的话说明想法</small></span><span className="answer-radio" aria-hidden="true">{value.mode==='text'&&<span/>}</span></label></div>:null}
        {(!hasOptions||value.mode==='text')&&<label className="answer-input-label"><span>{question.isSecret?'敏感信息':'你的回答'}</span>{question.isSecret?<div className="secret-answer"><input ref={field} autoComplete="off" type={shown?'text':'password'} value={value.text||''} onChange={e=>update({text:e.target.value})} maxLength={4000} aria-label={question.question} aria-invalid={Boolean(error)}/><button type="button" aria-label={shown?'隐藏敏感信息':'显示敏感信息'} onClick={()=>setShown(v=>!v)}>{shown?<EyeSlash size={18}/>:<Eye size={18}/>}</button></div>:<textarea ref={field} value={value.text||''} onChange={e=>update({text:e.target.value})} maxLength={4000} rows={3} placeholder="输入回答，支持换行…" aria-label={question.question} aria-invalid={Boolean(error)}/>}</label>}
        {hasOptions&&value.mode==='option'&&<details className="answer-note" open={value.note?true:undefined}><summary>补充说明（可选）</summary><textarea value={value.note||''} onChange={e=>update({note:e.target.value})} maxLength={3500} rows={2} aria-label="补充说明" placeholder="有额外要求？在这里告诉 Agent…"/></details>}
      </fieldset>
    </>:request.kind!=='questions'?<div className="permission-preview"><span>{request.kind==='command'?'即将执行的命令':'文件变更请求'}</span><pre tabIndex={0}>{request.command||'允许本次请求涉及的文件变更'}</pre><p>工作目录 <code>{request.cwd}</code></p></div>:<p>此请求没有提供可回答的问题，请停止本轮并重试。</p>}
    {error&&<p className="request-error" role="alert">{error}</p>}
    <footer className="request-actions"><span>{pending>0?`后面还有 ${pending} 项请求`:request.kind==='questions'?'确认后继续，输入不会自动发送':'请核对命令和工作目录'}</span><div>{request.kind==='questions'?(<>{step>0&&<button type="button" className="secondary" onClick={()=>{setStep(n=>n-1);setShown(false);setError('')}} disabled={sending}><ArrowLeft size={15}/>上一题</button>}{step<questions.length-1?<button type="button" className="primary" onClick={next} disabled={sending}>下一题<ArrowRight size={15}/></button>:<button type="button" className="primary" onClick={()=>submit('accept')} disabled={sending||!questions.length}>{sending?'正在提交…':'提交回答'}<ArrowRight size={15}/></button>}</>):<><button type="button" className="secondary" onClick={()=>submit('decline')} disabled={sending}>拒绝</button><button type="button" className="primary" onClick={()=>submit('accept')} disabled={sending}>{sending?'正在提交…':'仅允许本次'}</button></>}</div></footer>
  </section>;
}
