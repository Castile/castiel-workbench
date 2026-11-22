import React, { useEffect, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { todayISO } from '../workspaceData.js';
import { cleanEvent, thumbnail, validAvatar, transferPatch, archivePreview } from './people.js';

export function PeopleDialog({title, onClose, children, wide=false}) {
  const ref=useRef();
  useEffect(() => {
    const dialog=ref.current;
    dialog.showModal();
    return () => dialog.close();
  },[]);
  return <dialog ref={ref} className={'w-dialog people-dialog'+(wide?' wide-dialog':'')} aria-label={title} onCancel={e=>{e.preventDefault();onClose()}}>
    <header><h2>{title}</h2><button type="button" className="icon-button" aria-label="关闭窗口" onClick={onClose}><X size={21}/></button></header>
    {children}
  </dialog>;
}

export function Avatar({member, large=false}) {
  return <span className={'people-avatar'+(large?' large':'')} aria-hidden="true">{validAvatar(member.avatar)
    ? <img src={member.avatar} alt=""/> : Array.from(member.name || '人').slice(-2).join('')}</span>;
}

export function TextField({label, value, onChange, multi=false, ...rest}) {
  const Element=multi?'textarea':'input';
  return <label className="w-field"><span>{label}</span><Element {...rest} value={value ?? ''} onChange={e=>onChange(e.target.value)}/></label>;
}

export function Checks({label,options,selected,onChange}) {
  return <fieldset className="people-checks"><legend>{label}</legend>
    {options.length ? options.map(({id,label:name})=><label key={id}><input type="checkbox" checked={selected.includes(id)}
      onChange={e=>onChange(e.target.checked?[...selected,id]:selected.filter(value=>value!==id))}/>{name}</label>) : <small>暂无可选记录</small>}
  </fieldset>;
}
export const memberLabel = m=>[m.name,m.role,m.archived?'已归档':''].filter(Boolean).join(' · ');

export function MemberEditor({member, projects, onSave, onClose}) {
  const [draft,setDraft]=useState(()=>member || {id:crypto.randomUUID(),name:'',role:'',skills:'',responsibility:'',capacity:40,absence:0,projects:[]});
  const [reading,setReading]=useState(false),[error,setError]=useState('');
  const serial=useRef(0);
  const field=(key,value)=>setDraft(current=>({...current,[key]:value}));
  async function selectImage(file) {
    if(!file)return;
    const id=++serial.current;
    setReading(true);setError('');
    try {
      const avatar=await thumbnail(file);
      if(id===serial.current)field('avatar',avatar);
    } catch(e) {
      if(id===serial.current)setError(e.message || '无法读取这张图片。');
    } finally { if(id===serial.current)setReading(false); }
  }
  return <PeopleDialog title={member?'编辑成员':'添加成员'} onClose={onClose}><form onSubmit={e=>{
    e.preventDefault();
    if (!draft.name.trim()) {setError('请填写姓名。');return}
    onSave({...draft,name:draft.name.trim(),capacity:Number(draft.capacity),absence:Number(draft.absence)});
  }}>
    <div className="people-avatar-editor"><Avatar member={draft} large/><div>
      <label className="secondary people-file">选择本机头像<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>selectImage(e.target.files[0])}/></label>
      {draft.avatar&&<button type="button" className="subtle-link" onClick={()=>{serial.current++;setReading(false);field('avatar','')}}>移除头像</button>}
      <small>{reading?'正在处理…':'JPG、PNG、WebP，最多 5 MB，居中裁为方形。'}</small>
    </div></div>
    <div className="form-grid"><TextField label="姓名" required maxLength={80} value={draft.name} onChange={v=>field('name',v)}/>
      <TextField label="角色" value={draft.role} onChange={v=>field('role',v)}/></div>
    <TextField label="技能" value={draft.skills} onChange={v=>field('skills',v)} placeholder="例如 支付、接口、数据库"/>
    <TextField label="职责" multi value={draft.responsibility} onChange={v=>field('responsibility',v)}/>
    <label className="w-field">在岗状态<select value={draft.workState || '在岗'} onChange={e=>field('workState',e.target.value)}>{['在岗','休假','借调'].map(x=><option key={x}>{x}</option>)}</select></label>
    <div className="form-grid"><TextField label="每周容量（小时）" type="number" min="0" max="168" step="0.25" required value={draft.capacity} onChange={v=>field('capacity',v)}/>
      <TextField label="每周不可用（小时）" type="number" min="0" max="168" step="0.25" required value={draft.absence} onChange={v=>field('absence',v)}/></div>
    <Checks label="参与项目" options={projects.map(p=>({id:p.id,label:p.name}))} selected={draft.projects || []} onChange={v=>field('projects',v)}/>
    {error&&<p role="alert">{error}</p>}
    <footer className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={reading}>保存成员</button></footer>
  </form></PeopleDialog>;
}

export function SourceLink({value,children,notify}) {
  let url;
  try { url=new URL(value); } catch { return null }
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;
  return <a href={url.href} target="_blank" rel="noreferrer" onClick={e=>{
    if(window.castielDesktop){e.preventDefault();window.castielDesktop.openExternal(url.href).catch(error=>notify?.(error.message))}
  }}>{children}</a>;
}

export function ArchiveEditor({member,members,tasks,items,onConfirm,onClose,notify}) {
  const [target,setTarget]=useState('');
  const choices=members.filter(m=>m.id!==member.id&&!m.archived);
  const {transfer,external}=archivePreview(tasks,member.id,items);
  return <PeopleDialog title={'归档 '+member.name} onClose={onClose}><p>历史事迹、绩效记录和已完成工作将保留在成员档案。</p>
    <h3>本地工作转交预览（{transfer.length}）</h3>
    {transfer.map(t=><div className="people-line" key={t.id}><strong>{t.title}</strong><small>{member.name} → {choices.find(x=>x.id===target)?.name||'待选'} · {t.effort==null?'未估算':t.effort+' h'}</small></div>)}
    {transfer.length>0&&<label className="w-field">接手成员<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">选择接手成员</option>{choices.map(m=><option key={m.id} value={m.id}>{memberLabel(m)}</option>)}</select></label>}
    {external.length>0&&<><h3>需在源系统改派（{external.length}）</h3>{external.map(t=><div key={t.id} className="people-line"><span>{t.title}</span><SourceLink value={t.url} notify={notify}>打开原记录</SourceLink></div>)}</>}
    <footer className="dialog-actions"><button className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={!!transfer.length&&!target} onClick={()=>onConfirm(transfer.map(t=>[t.id,transferPatch(t,target)]))}>{transfer.length?'确认转交并归档':'确认归档'}</button></footer>
  </PeopleDialog>;
}

export function EventEditor({event, memberId, members, work, goals, onSave,onClose}) {
  const [draft,setDraft]=useState(()=> event || {id:crypto.randomUUID(),title:'',type:'red',date:todayISO(),facts:'',memberIds:memberId?[memberId]:[],contributions:{},goalIds:[],workIds:[]});
  const [error,setError]=useState('');
  const field=(k,v)=>setDraft(current=>({...current,[k]:v}));
  const input=(k,label,multi=false,props={})=><TextField label={label} multi={multi} value={draft[k]} onChange={v=>field(k,v)} {...props}/>;
  const people=members.filter(m=>!m.archived||draft.memberIds.includes(m.id));
  const relatedGoals=goals.filter(g=>draft.memberIds.includes(g.memberId)||(draft.goalIds||[]).includes(g.id));
  return <PeopleDialog title={event?'编辑事迹与跟进':'记事迹'} onClose={onClose} wide>
    <form onSubmit={e=>{e.preventDefault();try{onSave(cleanEvent(draft,todayISO()))}catch(ex){setError(ex.message)}}}>
      <div className="form-grid"><label className="w-field">事件属性<select value={draft.type} onChange={e=>field('type',e.target.value)} disabled={!!event}><option value="red">红事件 · 值得推广</option><option value="black">黑事件 · 偏差改进</option></select></label>
        {input('date','发生日期',false,{type:'date',required:true})}</div>
      <Checks label="参与成员" options={people.map(m=>({id:m.id,label:memberLabel(m)}))} selected={draft.memberIds} onChange={v=>field('memberIds',v)}/>
      {input('title','事迹标题',false,{placeholder:'选填，默认取事实首行'})}
      {input('facts','事实经过',true,{required:true,placeholder:'记录何时发生了什么'})}
      {draft.type==='red'&&<details className="people-expand" open><summary>可用于团队表扬的内容（选填）</summary>
        <TextField label="海报公开标题" value={draft.praise?.publicTitle} onChange={v=>field('praise',{...draft.praise,publicTitle:v})} placeholder="例如 把兼容性问题挡在发布前"/>
        <TextField label="可公开的贡献与影响" multi value={draft.praise?.publicText} onChange={v=>field('praise',{...draft.praise,publicText:v})} placeholder="供团队群文案和海报使用"/>
      </details>}
      <details className="people-expand" open={event?true:undefined}><summary>角色分工、成果与关联</summary>
        {draft.memberIds.map(id=><TextField key={id} label={(members.find(m=>m.id===id)?.name || '历史成员')+'的贡献'} value={draft.contributions?.[id]} onChange={v=>field('contributions',{...draft.contributions,[id]:v})}/>)}
        {input('outcome','交付结果',true)}
        {input('impact','实际影响',true)}
        {input('evidenceURL','佐证链接',false,{type:'url',pattern:'https?://.+'})}
        <Checks label="关联目标" options={relatedGoals.map(g=>({id:g.id,label:g.title}))} selected={draft.goalIds||[]} onChange={v=>field('goalIds',v)}/>
        <Checks label="关联工作项" options={work.map(t=>({id:t.id,label:t.title}))} selected={draft.workIds||[]} onChange={v=>field('workIds',v)}/>
      </details>
      {draft.type==='black'&&<>{input('memberExplanation','成员说明',true)}{input('plExplanation','PL 观察与说明',true)}{input('agreement','双方改进约定',true)}</>}
      {input('followUpDate',draft.type==='black'?'复核日期':'下次跟进',false,{type:'date'})}
      {(draft.type==='black'||draft.followUpDate||draft.closed||draft.correction)&&<>{input('correction','纠正结果 / 跟进结果',true)}
        <label className="people-toggle"><input type="checkbox" checked={Boolean(draft.closed)} onChange={e=>field('closed',e.target.checked)}/>标记已结案</label>
        {draft.closed&&input('closedAt','结案日期',false,{type:'date',value:draft.closedAt||todayISO()})}</>}
      {error&&<p role="alert">{error}</p>}
      <footer className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary">保存事迹</button></footer>
    </form>
  </PeopleDialog>;
}
