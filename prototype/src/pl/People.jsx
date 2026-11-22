import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CaretRight, MagnifyingGlass, Plus, PencilSimple, NotePencil } from '@phosphor-icons/react';
import { ArchiveEditor, Avatar, EventEditor, MemberEditor, PeopleDialog, SourceLink } from './people-forms.jsx';
import { PraiseEditor, initialPraise } from './people-praise.jsx';
import { visibleMembers } from './people.js';
import './people.css';

function EventDetail({event,members,goals,work,notify,onClose,onEdit,onPraise}) {
  const names=event.memberIds.map(id=>members.find(m=>m.id===id)?.name || '历史成员');
  const fields=[
    ['事实经过',event.facts],
    ...event.memberIds.map((id,i)=>[names[i]+'的贡献',event.contributions?.[id]]),
    ['交付结果',event.outcome],['实际影响',event.impact],
    ['成员说明',event.memberExplanation],['PL 观察与说明',event.plExplanation],['双方改进约定',event.agreement],
    ['关联目标',(event.goalIds||[]).map(id=>goals.find(g=>g.id===id)?.title).filter(Boolean).join('、')],
    ['关联工作项',(event.workIds||[]).map(id=>work.find(t=>t.id===id)?.title).filter(Boolean).join('、')],
    [event.type==='black'?'复核日期':'下次跟进',event.followUpDate],
    ['纠正结果 / 跟进结果',event.correction],['结案日期',event.closedAt]
  ];
  return <PeopleDialog title={event.title} onClose={onClose} wide>
    <div className="people-meta"><EventKind type={event.type}/><time>{event.date}</time><span>{names.join('、')}</span>{event.closed&&<span>已结案</span>}</div>
    <dl className="people-detail">{fields.filter(([,value])=>value).map(([label,value],index)=><div key={index}><dt>{label}</dt><dd>{value}</dd></div>)}
      {event.evidenceURL&&<div><dt>佐证链接</dt><dd><SourceLink value={event.evidenceURL} notify={notify}>{event.evidenceURL}</SourceLink></dd></div>}</dl>
    <footer className="dialog-actions"><button className="secondary" onClick={onEdit}>编辑与跟进</button>
      {event.type==='red'&&<><button className="secondary" onClick={()=>onPraise('personal')}>写激励</button><button className="primary" onClick={()=>onPraise('poster')}>生成海报</button></>}
    </footer>
  </PeopleDialog>;
}
function EventKind({type}) {
  return <span className={'people-kind '+(type==='red'?'red':'black')}>{type==='red'?'红事件':'黑事件'}</span>;
}

export default function People({members,setMembers,projects,tasks,items=[],setItems,onUpdateTask,events,setEvents,memberId,setMemberId,notify,Polish,openRequest,goals=[],children}) {
  const [scope,setScope]=useState('active'),[query,setQuery]=useState(''),[eventQuery,setEventQuery]=useState(''),[dialog,setDialog]=useState(null);
  const handled=useRef(null);
  const member=members.find(m=>m.id===memberId), work=[...tasks,...items];
  const event=events.find(e=>e.id===dialog?.id);
  useEffect(()=>{
    if(openRequest?.kind!=='event'||handled.current===openRequest.key)return;
    handled.current=openRequest.key;
    const existing=events.find(x=>x.id===openRequest.id);
    const target=members.find(m=>m.id===(openRequest.memberId || existing?.memberIds?.[0]));
    if(target)setMemberId(target.id);
    setDialog(existing?{type:'editEvent',id:existing.id}:{type:'newEvent',memberId:target?.id||null});
  },[openRequest,events,members,setMemberId]);
  const close=()=>setDialog(null);
  function openMember(id) {setMemberId(id);setEventQuery('')}
  function saveMember(value) {
    setMembers(list=>list.some(m=>m.id===value.id)?list.map(m=>m.id===value.id?value:m):[...list,value]);
    openMember(value.id);close();
  }
  function saveEvent(value) {
    setEvents(list=>list.some(e=>e.id===value.id)?list.map(e=>e.id===value.id?{...e,...value}:e):[...list,value]);
    if(!value.memberIds.includes(memberId))openMember(value.memberIds[0]);
    setDialog({type:'detail',id:value.id});
  }
  function updatePraise(patch) {
    setEvents(list=>list.map(e=>e.id===event.id && e.type==='red'?{...e,praise:{...initialPraise(e,members),...patch}}:e));
  }
  function startPraise(mode) {
    updatePraise({});
    setDialog({type:'praise',id:event.id,mode});
  }
  const roster=visibleMembers(members,query,scope);
  const timeline=events.filter(e=>e.memberIds?.includes(memberId)).sort((a,b)=>b.date.localeCompare(a.date));
  const filteredTimeline=timeline.filter(e=>[e.title,e.facts,e.type==='red'?'红事件':'黑事件',e.date].join(' ').toLocaleLowerCase().includes(eventQuery.trim().toLocaleLowerCase()));
  const followUp=timeline.filter(e=>e.followUpDate&&!e.closed).sort((a,b)=>a.followUpDate.localeCompare(b.followUpDate))[0];
  const assignments=work.filter(t=>t.owner===memberId||t.sourceOwner===memberId);
  return <div className="people-view">
    {!member?<><div className="people-header"><div><h2>成员名册</h2><p>{members.filter(m=>!m.archived).length} 位在册成员</p></div>
      <button className="primary" onClick={()=>setDialog({type:'newMember'})}><Plus size={17}/>添加成员</button></div>
      <div className="people-toolbar"><label className="people-search"><MagnifyingGlass size={18}/><input aria-label="搜索成员" placeholder="搜索姓名、角色或技能" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <select aria-label="成员范围" value={scope} onChange={e=>setScope(e.target.value)}><option value="active">在册成员</option><option value="archived">已归档</option><option value="all">全部成员</option></select>
      </div>
      <div className="people-grid">{roster.map(m=><button className="people-card" key={m.id} onClick={()=>openMember(m.id)}>
        <div className="people-card-head"><Avatar member={m}/><div><strong>{m.name}</strong><small>{m.role||'角色待填写'}</small></div><CaretRight size={16}/></div>
        <span className="people-skills">{m.skills||'暂无技能记录'}</span>
        <span className="people-card-foot"><span>{m.archived?'已归档':m.workState||'在岗'}</span><span>可用 {Math.max(0,(m.capacity||0)-(m.absence||0))} h / 周</span></span>
      </button>)}</div>
      {!roster.length&&<p className="people-empty">{query?'没有匹配的成员。':scope==='archived'?'暂无已归档成员。':'暂无成员。'}</p>}
    </>:<>
      <button className="back-link" onClick={()=>openMember(null)}><ArrowLeft size={16}/>成员名册</button>
      <section className="people-profile"><div className="people-identity"><Avatar member={member} large/><div><h2>{member.name}</h2><p>{[member.role,member.archived?'已归档':member.workState||'在岗'].filter(Boolean).join(' · ')}</p></div></div>
        <div className="people-actions"><button className="secondary" onClick={()=>setDialog({type:'editMember'})}><PencilSimple size={16}/>编辑资料</button>
          {!member.archived&&<button className="primary" onClick={()=>setDialog({type:'newEvent',memberId})}><NotePencil size={17}/>记事迹</button>}</div>
        <dl className="people-facts"><div><dt>职责</dt><dd>{member.responsibility||'待填写'}</dd></div><div><dt>技能</dt><dd>{member.skills||'待填写'}</dd></div>
          <div><dt>参与项目</dt><dd>{(member.projects||[]).map(id=>projects.find(p=>p.id===id)?.name).filter(Boolean).join('、')||'暂未登记'}</dd></div><div><dt>可用容量</dt><dd>{Math.max(0,(member.capacity||0)-(member.absence||0))} h / 周</dd></div></dl>
        {member.id!=='me'&&<button className="subtle-link people-archive" onClick={()=>{
          if(member.archived){setMembers(list=>list.map(m=>m.id===memberId?{...m,archived:false}:m));notify?.('已恢复在册')}
          else setDialog({type:'archive'});
        }}>{member.archived?'恢复在册':'归档成员'}</button>}
      </section>
      <section className="people-section"><div className="people-header"><h2>事迹时间线</h2>{timeline.length>0&&<label className="people-search"><MagnifyingGlass size={16}/><input aria-label="搜索事迹" placeholder="搜索事迹、日期" value={eventQuery} onChange={e=>setEventQuery(e.target.value)}/></label>}</div>
        {followUp&&<button className="people-follow" onClick={()=>setDialog({type:'editEvent',id:followUp.id})}>待跟进 · {followUp.followUpDate} · {followUp.title}<CaretRight size={15}/></button>}
        {filteredTimeline.map(e=><button className="people-event" key={e.id} onClick={()=>setDialog({type:'detail',id:e.id})}>
          <EventKind type={e.type}/><span><strong>{e.title}</strong><small>{e.date}{e.closed?' · 已结案':''}</small></span><CaretRight size={16}/></button>)}
        {!filteredTimeline.length&&<p className="people-empty">{eventQuery?'没有匹配的事迹。':'暂无事迹记录。'}</p>}
      </section>
      {typeof children==='function'?children(member):children}
      <section className="people-section"><h2>承担的工作</h2>
        {assignments.length?assignments.map(t=><div key={t.id} className="people-line"><strong>{t.title}</strong><small>{[projects.find(p=>p.id===t.projectId)?.name,t.status,t.sourceId?(t.owner===memberId?'本地执行人':'源系统负责人'):'',t.effort==null?'':t.effort+' h'].filter(Boolean).join(' · ')}</small><SourceLink value={t.url} notify={notify}>打开原记录</SourceLink></div>):<p className="people-empty">暂无承担的工作项。</p>}
      </section>
    </>}
    {['newMember','editMember'].includes(dialog?.type)&&<MemberEditor key={dialog.type} member={dialog.type==='editMember'?member:null} projects={projects} onSave={saveMember} onClose={close}/>}
    {dialog?.type==='archive'&&member&&<ArchiveEditor member={member} members={members} tasks={tasks} items={items} notify={notify} onClose={close} onConfirm={changes=>{
      const updates=new Map(changes);
      if(items.some(item=>updates.has(item.id)))setItems(list=>list.map(item=>updates.has(item.id)?{...item,...updates.get(item.id)}:item));
      tasks.filter(task=>updates.has(task.id)).forEach(task=>onUpdateTask(task.id,updates.get(task.id)));
      setMembers(list=>list.map(m=>m.id===memberId?{...m,archived:true}:m));close();notify?.('成员已归档');
    }}/>}
    {['newEvent','editEvent'].includes(dialog?.type)&&<EventEditor key={dialog.id||'new'} event={event} memberId={dialog.memberId} members={members} work={work} goals={goals} onSave={saveEvent} onClose={close}/>}
    {dialog?.type==='detail'&&event&&<EventDetail event={event} members={members} goals={goals} work={work} onClose={close} notify={notify}
      onEdit={()=>setDialog({type:'editEvent',id:event.id})} onPraise={startPraise}/>}
    {dialog?.type==='praise'&&event?.type==='red'&&<PraiseEditor event={event} members={members} praise={initialPraise(event,members)} mode={dialog.mode}
      setMode={mode=>setDialog({...dialog,mode})} onUpdate={updatePraise} onClose={close} Polish={Polish} notify={notify}/>}
  </div>;
}
