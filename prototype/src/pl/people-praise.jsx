import React, { useEffect, useState } from 'react';
import { Checks, PeopleDialog, TextField, memberLabel } from './people-forms.jsx';
import { drawPoster, publicPoster } from './people.js';

export function initialPraise(event,members) {
  const participants=members.filter(m=>event.memberIds.includes(m.id));
  const names=participants.map(m=>m.name).join('、');
  const you=participants.length===1?'你':'你们';
  const details=participants.map(m=>event.contributions?.[m.id] && m.name+'，'+event.contributions[m.id]).filter(Boolean).join('\n');
  return {
    personal: [names+'，谢谢'+you+'在「'+event.title+'」中的付出。',details,event.outcome].filter(Boolean).join('\n\n'),
    publicText:'感谢大家在这次协作中的投入与支持。',
    publicTitle:'感谢你们的付出',
    memberIds:participants.map(m=>m.id),
    ...event.praise
  };
}

export function PraiseEditor({event,members,praise,mode,setMode,onUpdate,onClose,Polish,notify}) {
  const [image,setImage]=useState(null);
  const [error,setError]=useState('');
  const visiblePeople=members.filter(m=>event.memberIds.includes(m.id));
  const publicDraft={title:praise.publicTitle,text:praise.publicText,memberIds:praise.memberIds};
  // Retain only the exact image that corresponds to the currently visible inputs.
  const imageKey=JSON.stringify([publicDraft,visiblePeople.map(m=>[m.id,m.name,m.avatar])]);
  const showImage=mode==='poster' && image?.key===imageKey;
  useEffect(()=>{
    let cancelled=false;
    if(mode!=='poster')return;
    async function render() {
      try {
        const data=await drawPoster(publicPoster(event,publicDraft,members));
        if(!cancelled){setImage({key:imageKey,data});setError('')}
      } catch(e){if(!cancelled){setImage(null);setError(e.message)}}
    }
    render();
    return ()=>{cancelled=true};
  },[imageKey,mode]);
  const personal=mode==='personal';
  const key=personal?'personal':'publicText';
  const copy=async()=>{
    try {
      if(window.castielDesktop)await window.castielDesktop.writeClipboard(praise[key]);
      else await navigator.clipboard.writeText(praise[key]);
      notify?.('文案已复制');
    } catch(e){setError(e.message || '复制失败，请选择文案后复制。')}
  };
  return <PeopleDialog title={mode==='poster'?'表扬海报':'写激励'} onClose={onClose} wide>
    <div className="people-modes" aria-label="激励用途">{[['personal','给本人的感谢'],['group','团队群表扬'],['poster','海报预览']].map(([id,name])=><button type="button" key={id} aria-pressed={mode===id} onClick={()=>{setMode(id);setError('')}}>{name}</button>)}</div>
    {mode==='poster'&&<>
      <TextField label="公开标题" value={praise.publicTitle} onChange={v=>onUpdate({publicTitle:v})}/>
      <button type="button" className="subtle-link" onClick={()=>onUpdate({publicTitle:event.title})}>采用事迹标题作为公开标题</button>
      <Checks label="海报显示成员"  options={visiblePeople.map(m=>({id:m.id,label:memberLabel(m)}))} selected={praise.memberIds} onChange={v=>onUpdate({memberIds:v})}/>
    </>}
    {!personal&&(!praise.publicText||praise.publicText==='感谢大家在这次协作中的投入与支持。')&&<p className="table-note">请补充适合团队公开的具体贡献与影响。</p>}
    <TextField label={personal?'私人感谢稿':'公开表扬文案'} multi value={praise[key]} onChange={v=>onUpdate({[key]:v})}/>
    {Polish&&<Polish value={praise[key]} onApply={v=>onUpdate({[key]:v})} evidence={[event.title,event.facts,event.outcome,event.impact].filter(Boolean).join('\n')}/>}
    {mode==='poster'&&<div className="people-poster">{showImage?<img src={image.data} alt="将导出的表扬海报"/>:!error&&<p>正在排版…</p>}</div>}
    {error&&<p role="alert">{error}</p>}
    <footer className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>完成</button>
      {mode==='poster' ? showImage&&<a className="primary" download="团队表扬海报.png" href={image.data}>导出 PNG</a> : <button type="button" className="primary" onClick={copy}>复制文案</button>}
    </footer>
  </PeopleDialog>;
}
