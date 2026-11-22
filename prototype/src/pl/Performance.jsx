import React, {useEffect, useRef, useState} from 'react';
import {ArrowRight, CalendarCheck, CaretRight, ChatsCircle, CheckCircle, FileText, Plus} from '@phosphor-icons/react';
import {todayISO} from '../workspaceData.js';
import {amendGoal, annualMaterials, buildSelfDraft, closeFollowUp, confirmStage, defaultPeriod, dueFollowUps,
  evidenceChoices, needsContribution, periodRange, periods, stages} from './performance.js';
import './performance.css';

function update(setRecords, id, changes) {
  setRecords(records=>records.map(record=>record.id === id ? {...record,...changes} : record));
}

function Button({children, primary, ...props}) {
  return <button type="button" className={primary?'primary':'secondary'} {...props}>{children}</button>;
}

function Field({label, value, onChange, type='text', multiline, ...props}) {
  const input = {'aria-label':label,value:value ?? '', onChange:e=>onChange(e.target.value), ...props};
  return <label className="perf-field"><span>{label}</span>{multiline ? <textarea rows={3} {...input}/> : <input type={type} {...input}/>}</label>;
}

function Select({label, value, onChange, children}) {
  return <label className="perf-field"><span>{label}</span><select aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>{children}</select></label>;
}

function Evidence({options, selected=[], onChange, self=false, start, end}) {
  const values = new Map(selected.map(row=>[row.key,row]));
  const choices = new Map([...selected,...options].map(row=>[row.key,row]));
  return <details className="perf-evidence"><summary>引用材料 <span>{selected.length} 项</span></summary>
    {!choices.size && <p className="perf-hint">当前周期内还没有可引用的事迹或工作项。</p>}
    {[...choices.values()].map(option=>{
      const item = values.get(option.key) || option;
      const outside = item.date && (item.date < start || item.date > end);
      return <div className="perf-source" key={item.key}>
        <label><input type="checkbox" checked={values.has(item.key)}
          onChange={e=>onChange(e.target.checked ? [...selected,option] : selected.filter(x=>x.key!==item.key))}/>
          <span><strong>{item.title}</strong><small>{[item.label,item.date,outside?'已超出当前周期':''].filter(Boolean).join(' · ')}</small></span></label>
        {self && item.team && values.has(item.key) && <Field label="我在这项团队成果中的贡献" value={item.contribution}
          onChange={contribution=>onChange(selected.map(row=>row.key===item.key?{...row,contribution}:row))}/>}
      </div>;
    })}
  </details>;
}

function Dates({record, patch}) {
  return <div className="perf-grid">
    <Field label="周期开始日期" type="date" value={record.start} max={record.end} onChange={start=>patch({start})}/>
    <Field label="周期结束日期" type="date" value={record.end} min={record.start} onChange={end=>patch({end})}/>
  </div>;
}

function RecordPicker({records, selected, onSelect, label, display}) {
  if (!records.length) return null;
  return <Select label={label} value={selected || ''} onChange={onSelect}>
    {!selected && <option value="">选择记录</option>}
    {records.map(record=><option key={record.id} value={record.id}>{display(record)}</option>)}
  </Select>;
}

function Coaching({members, memberId, coaching, setCoaching, Polish, selectedId, setSelectedId}) {
  const records = coaching.filter(c=>c.memberId===memberId).slice().reverse();
  const record = records.find(c=>c.id===selectedId) || records[0];
  const [error,setError] = useState('');
  const patch = changes=>update(setCoaching,record.id,changes);
  function create() {
    const newRecord = {id:crypto.randomUUID(),memberId,date:todayISO(),topic:'',owner:memberId,completed:false};
    setCoaching(rows=>[...rows,newRecord]);
    setSelectedId(newRecord.id);
    setError('');
  }
  function finish() {
    try {patch(closeFollowUp(record,todayISO(),record.nextDate || ''));setError('');}
    catch (e) {setError(e.message);}
  }
  return <div className="perf-stack">
    <div className="perf-toolbar"><RecordPicker records={records} selected={record?.id} label="沟通记录"
      display={c=>c.date+' · '+(c.topic || '未命名沟通')} onSelect={id=>{setSelectedId(id);setError('');}}/>
      <Button onClick={create}><Plus size={16}/>新建 1:1</Button></div>
    {!record ? <p className="perf-empty">还没有 1:1 记录。</p> : <>
      <div className="perf-grid"><Field label="沟通议题" value={record.topic} onChange={topic=>patch({topic})}/>
        <Field label="沟通日期" type="date" value={record.date} onChange={date=>patch({date})}/></div>
      <div className="perf-grid"><Field multiline label="成员反馈" value={record.feedback} onChange={feedback=>patch({feedback})}/>
        <Field multiline label="PL 观察" value={record.observation} onChange={observation=>patch({observation})}/></div>
      <Field multiline label="双方约定" value={record.agreement} onChange={agreement=>patch({agreement})}/>
      <div className="perf-grid"><Select label="跟进负责人" value={record.owner || memberId} onChange={owner=>patch({owner})}>
        {members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Select>
        <Field label="下次跟进日期" type="date" value={record.followUpDate}
          onChange={followUpDate=>patch({followUpDate,completed:false})}/></div>
      <Field multiline label="沟通总结草稿" value={record.summary} onChange={summary=>patch({summary})}/>
      {Polish && <Polish key={record.id} value={record.summary || ''} onApply={summary=>patch({summary})}
        evidence={[record.topic,record.feedback,record.observation,record.agreement].filter(Boolean).join('\n')}/>}
      {record.history?.length>0 && <details className="perf-evidence"><summary>已完成的跟进 <span>{record.history.length} 次</span></summary>
        {record.history.map((h,i)=><p key={i}>{h.date} · {h.result}{h.due && <small>（原约 {h.due}）</small>}</p>)}</details>}
      {record.followUpDate && !record.completed && <div className="perf-inset perf-stack"><h4>本次跟进</h4>
        <Field label="跟进结果" multiline value={record.result} onChange={result=>patch({result})}/>
        <Field label="再约一次（可选）" type="date" value={record.nextDate} onChange={nextDate=>patch({nextDate})}/>
        <Button disabled={!record.result?.trim()} onClick={finish}><CheckCircle size={16}/>完成本次跟进</Button></div>}
      {error && <p role="alert" className="orange">{error}</p>}
    </>}
  </div>;
}

const agreementFields = [['title','目标'],['measure','衡量标准'],['expected','预期结果']];
const confirmationOptions = ['待双方确认','成员已确认','PL 已确认','双方已确认'];
function Agreement({record, patch}) {
  return <>{agreementFields.map(([key,label])=><Field key={key} label={label} value={record[key]} onChange={v=>patch({[key]:v})}/>)}
    <Select label="双方确认情况" value={record.agreed || confirmationOptions[0]} onChange={agreed=>patch({agreed})}>
      {confirmationOptions.map(s=><option key={s}>{s}</option>)}</Select></>;
}

function GoalStage({goal, stage, patch, options, start, end}) {
  const draft = goal.adjustment;
  if (stage===0) return <Agreement record={goal} patch={patch}/>;
  if (stage===1) return <>
    <p className="perf-hint">衡量标准 · {goal.measure || '待补充'}　预期结果 · {goal.expected || '待补充'}　{goal.agreed}</p>
    <Field label="实际进展" multiline value={goal.progress} onChange={progress=>patch({progress})}/>
    <div className="perf-grid"><Field label="当前障碍" value={goal.obstacle} onChange={obstacle=>patch({obstacle})}/>
      <Field label="需要的支持" value={goal.support} onChange={support=>patch({support})}/></div>
    <Evidence options={options} selected={goal.midEvidence} onChange={midEvidence=>patch({midEvidence})} start={start} end={end}/>
    {(goal.amendments || []).map((a,i)=><details className="perf-evidence" key={i}><summary>{a.date} · 调整前的约定</summary>
      <p>{Object.values(a.previous).join(' · ')}</p><p>调整原因 · {a.reason}</p></details>)}
    {draft ? <div className="perf-inset perf-stack">{agreementFields.map(([key,label])=><Field key={key} label={'调整后的'+label} value={draft[key]}
      onChange={v=>patch({adjustment:{...draft,[key]:v}})}/>)}
      <Field label="调整原因" value={draft.reason} onChange={reason=>patch({adjustment:{...draft,reason}})}/>
      <div className="perf-actions"><Button onClick={()=>patch({adjustment:null})}>取消调整</Button>
        <Button disabled={!draft.title?.trim() || !draft.reason?.trim()} onClick={()=>{
          const {reason,...fields}=draft;patch(amendGoal(goal,fields,reason));
        }}>记录调整</Button></div></div> :
      <Button onClick={()=>patch({adjustment:Object.fromEntries(agreementFields.map(([key])=>[key,goal[key] || '']))})}>调整目标</Button>}
    {goal.amendments?.length>0 && <Select label="调整后双方确认情况" value={goal.agreed} onChange={agreed=>patch({agreed})}>
      {confirmationOptions.map(s=><option key={s}>{s}</option>)}</Select>}
  </>;
  return <>
    {goal.progress && <p className="perf-hint">中期进展 · {goal.progress}</p>}
    <Field label="PL 评价草稿" multiline value={goal.judgement} onChange={judgement=>patch({judgement})}/>
    <Evidence options={options} selected={goal.evaluationEvidence} onChange={evaluationEvidence=>patch({evaluationEvidence})} start={start} end={end}/>
    <Field label="补充评价证据" value={goal.additionalEvidence} onChange={additionalEvidence=>patch({additionalEvidence})}/>
    <Field label="成员意见" multiline value={goal.memberOpinion} onChange={memberOpinion=>patch({memberOpinion})}/>
  </>;
}

function ConfirmationHistory({versions=[],expanded=false}) {
  if (!versions.length) return null;
  return <details className="perf-evidence" open={expanded || undefined}><summary>已确认版本 <span>{versions.length} 份</span></summary>
    {versions.map((v,i)=><details key={i} open={expanded || undefined}><summary>{v.date} · {stages[v.stage]} · 第 {i+1} 版</summary>
      <p>{v.review.start} 至 {v.review.end}</p>
      {v.stage===3 ? <p>{[v.review.meetingDate,v.review.outcome,v.review.feedback,v.review.disagreements,v.review.nextActions].filter(Boolean).join(' · ')}</p> :
      v.goals.map(g=><div key={g.id} className="perf-version"><strong>{g.title}</strong>
        <p>{[g.measure,g.expected,g.agreed,g.progress,g.obstacle,g.support,g.judgement,g.additionalEvidence,g.memberOpinion].filter(Boolean).join(' · ')}</p>
        {[...(g.midEvidence || []),...(g.evaluationEvidence || [])].map((e,j)=><small key={j}>{e.label} · {e.title}　</small>)}</div>)}</details>)}
  </details>;
}

function Cycle({memberId, goals, setGoals, reviews, setReviews, ...data}) {
  const cycles = reviews.filter(r=>r.memberId===memberId && r.kind==='cycle').slice().reverse();
  const [selected,setSelected]=useState('');
  const [stageView,setStageView]=useState(null);
  const [error,setError]=useState('');
  const cycle=cycles.find(c=>c.id===selected) || cycles[0];
  const stage=stageView ?? cycle?.stage ?? 0;
  const cycleGoals=cycle?goals.filter(g=>g.memberId===memberId && g.cycleId===cycle.id):[];
  const options=cycle ? evidenceChoices({...data,memberId,start:cycle.start,end:cycle.end}) : [];
  const patch=changes=>update(setReviews,cycle.id,changes);
  function create() {
    const year=new Date().getFullYear(), period=defaultPeriod();
    const record={id:crypto.randomUUID(),kind:'cycle',memberId,title:year+' 年'+periods[period],year,period,...periodRange(year,period),stage:0};
    setReviews(rows=>[...rows,record]);setSelected(record.id);setStageView(null);setError('');
  }
  function confirm() {
    let message='';
    if (!cycle.start || !cycle.end || cycle.start>cycle.end) message='请检查周期的起止日期';
    else if (!cycleGoals.length) message='请先添加目标';
    else if (stage===0 && cycleGoals.some(g=>!g.title?.trim() || !g.measure?.trim() || !g.expected?.trim())) message='请补齐每项目标、衡量标准和预期结果';
    else if (stage===1 && cycleGoals.some(g=>g.adjustment || !g.progress?.trim())) message='请完成目标调整并填写各项目标的实际进展';
    else if (stage===2 && cycleGoals.some(g=>!g.judgement?.trim() || (!g.evaluationEvidence?.length && !g.additionalEvidence?.trim()))) message='请为每项目标填写 PL 评价，并引用或补充评价证据';
    else if (stage===3 && (!cycle.meetingDate || !cycle.outcome?.trim())) message='请填写沟通日期和已传达的结果';
    setError(message);
    if (message) return;
    patch({...confirmStage(cycle,cycleGoals,stage),completed:stage===3});setStageView(null);
  }
  const archivedStage=cycle && (stage<cycle.stage || cycle.completed);
  const snapshot=archivedStage ? (cycle.versions || []).findLast(v=>v.stage===stage) : null;
  return <div className="perf-stack">
    <div className="perf-toolbar"><RecordPicker label="绩效周期" records={cycles} selected={cycle?.id} onSelect={id=>{setSelected(id);setStageView(null);setError('');}}
      display={r=>(r.title || '绩效周期')+' · '+(r.completed?'已完成':stages[r.stage])}/>
      <Button onClick={create}><Plus size={16}/>新建周期</Button></div>
    {!cycle ? <p className="perf-empty">还没有绩效周期。新建后可添加目标和衡量标准。</p> : <>
      <div className="perf-stages">{stages.map((s,i)=><button key={s} type="button" disabled={i>cycle.stage} aria-pressed={i===stage}
        onClick={()=>{setStageView(i);setError('');}}>{i+1} · {s}</button>)}</div>
      {archivedStage && snapshot ? <ConfirmationHistory key={snapshot.stage} versions={[snapshot]} expanded/> : <>
        {stage===0 && <>
          <Field label="周期名称" value={cycle.title} onChange={title=>patch({title})}/><Dates record={cycle} patch={patch}/>
        </>}
        {stage<3 && cycleGoals.map((g,i)=><section key={g.id} className="perf-goal perf-stack">
          <h4>{stage===0?'目标 '+(i+1):g.title}</h4>
          <GoalStage goal={g} stage={stage} patch={changes=>update(setGoals,g.id,changes)} options={options} start={cycle.start} end={cycle.end}/>
        </section>)}
        {stage===0 && <Button onClick={()=>setGoals(rows=>[...rows,{id:crypto.randomUUID(),memberId,cycleId:cycle.id,title:'',agreed:confirmationOptions[0]}])}>
          <Plus size={16}/>添加目标</Button>}
        {stage===3 && <><Field label="结果沟通日期" type="date" value={cycle.meetingDate} onChange={meetingDate=>patch({meetingDate})}/>
          {[['outcome','已传达的结果'],['feedback','成员反馈'],['disagreements','待解决分歧'],['nextActions','后续行动']].map(([key,label])=>
            <Field key={key} label={label} multiline value={cycle[key]} onChange={v=>patch({[key]:v})}/>)}</>}
        <div className="perf-actions"><Button primary onClick={confirm}><CheckCircle size={17}/>确认{stages[stage]}</Button></div>
      </>}
      {error && <p role="alert" className="orange">{error}</p>}
      {(!archivedStage || cycle.versions?.length>1) && <ConfirmationHistory versions={cycle.versions}/>}
    </>}
  </div>;
}

const selfSections=[['actions','我的动作'],['results','交付结果'],['impact','对团队的影响'],['improvement','下一步改进']];

function SelfReview({reviews,setReviews,events,goals,tasks,workItems,Polish,requestedId}) {
  const initial=reviews.find(r=>r.id===requestedId && r.kind==='self' && r.memberId==='me');
  const [year,setYear]=useState(String(initial?.year || new Date().getFullYear()));
  const [period,setPeriod]=useState(initial?.period || defaultPeriod());
  const [preview,setPreview]=useState(false);
  const [notice,setNotice]=useState('');
  const record=reviews.find(r=>r.kind==='self' && r.memberId==='me' && r.year===Number(year) && r.period===period);
  const patch=changes=>update(setReviews,record.id,changes);
  const datesValid=record?.start && record?.end && record.start<=record.end;
  const selected=record?.evidence || [];
  const invalidEvidence=selected.some(e=>needsContribution(e) || (e.date && (e.date<record.start || e.date>record.end)));
  const permitted=datesValid && !invalidEvidence;
  const cycleMap = new Map(reviews.filter(r=>r.kind==='cycle').map(r=>[r.id,r]));
  const datedGoals=goals.map(g=>({...g,start:cycleMap.get(g.cycleId)?.start,end:cycleMap.get(g.cycleId)?.end}));
  const options=record ? evidenceChoices({memberId:'me',self:true,goals:datedGoals,events,tasks,workItems,start:record.start,end:record.end}) : [];
  function selectPeriod(value) {setPeriod(value);setPreview(false);setNotice('');}
  function selectYear(value) {setYear(value);setPreview(false);setNotice('');}
  function create() {
    const entry={id:crypto.randomUUID(),kind:'self',memberId:'me',year:Number(year),period,...periodRange(year,period),evidence:[],draft:''};
    setReviews(rows=>rows.some(r=>r.kind==='self' && r.memberId==='me' && r.year===entry.year && r.period===period)?rows:[...rows,entry]);
    setNotice('');
  }
  function reuseHalfYears() {
    const evidence=annualMaterials(record,reviews);
    setNotice('已加入 '+(evidence.length-selected.length)+' 项半年材料');
    patch({evidence});
  }
  function confirm() {
    if (!permitted || !record.draft?.trim()) return;
    const {versions,...snapshot}=record;
    patch({versions:[...(versions || []),{date:todayISO(),...structuredClone(snapshot)}]});
    setNotice('已保留本次确认版本');
  }
  const past=reviews.filter(r=>r.kind==='self' && r.memberId==='me').slice().sort((a,b)=>b.year-a.year || b.start.localeCompare(a.start));
  return <div className="perf-stack">
    <div className="perf-grid"><Field label="自评年度" value={year} type="number" min="1000" max="9999" onChange={selectYear}/>
      <Select label="自评周期" value={period} onChange={selectPeriod}>
        {Object.entries(periods).map(([key,label])=><option key={key} value={key}>{label}</option>)}</Select></div>
    {past.length>0 && <details className="perf-evidence"><summary>历次自评 <span>{past.length} 份</span></summary>
      {past.map(r=><button type="button" className="perf-link" key={r.id} onClick={()=>{selectYear(String(r.year));selectPeriod(r.period);}}>
        {r.year} 年{periods[r.period]} · {r.start} 至 {r.end}<CaretRight size={15}/></button>)}</details>}
    {!record ? <div className="perf-actions"><Button primary disabled={!/^[1-9]\d{3}$/.test(year)} onClick={create}>开始这期自评</Button></div> : <>
      <Dates record={record} patch={patch}/>
      {period==='Y' && <Button onClick={reuseHalfYears}>复用本年上下半年材料</Button>}
      <Evidence self options={options} start={record.start} end={record.end} selected={selected} onChange={evidence=>patch({evidence})}/>
      <div className="perf-grid">{selfSections.map(([key,label])=><Field multiline key={key} label={label} value={record[key]}
        onChange={value=>patch({[key]:value})}/>)}</div>
      {!datesValid && <p className="orange">请检查自评周期的起止日期。</p>}
      {invalidEvidence && <p className="orange">请补齐团队成果中自己的贡献，并移除超出所选周期的材料。</p>}
      <div className="perf-actions"><Button disabled={!permitted || (!selected.length && !selfSections.some(([key])=>record[key]?.trim()))}
        onClick={()=>setPreview(!preview)}>用所选材料整理草稿</Button></div>
      {preview && permitted && <div className="perf-stack perf-inset"><h4>材料整理预览</h4><pre>{buildSelfDraft(record)}</pre>
        <div className="perf-actions"><Button onClick={()=>setPreview(false)}>返回编辑</Button>
          <Button primary onClick={()=>{patch({draft:buildSelfDraft(record)});setPreview(false);}}>采用为当前草稿</Button></div></div>}
      <Field multiline rows={8} label="自评草稿" value={record.draft} onChange={draft=>patch({draft})}/>
      {Polish && <Polish key={record.id} value={record.draft || ''} onApply={draft=>patch({draft})}
        evidence={selected.map(e=>[e.title,e.detail,e.contribution].filter(Boolean).join(' · ')).join('\n')}/>}
      <div className="perf-actions"><Button primary onClick={confirm} disabled={!permitted || !record.draft?.trim()}><CheckCircle size={16}/>保存确认版</Button></div>
      {record.versions?.length>0 && <details className="perf-evidence"><summary>自评确认版本 <span>{record.versions.length} 份</span></summary>
        {record.versions.map((v,i)=><details key={i}><summary>{v.date} · 第 {i+1} 版</summary><pre>{v.draft}</pre>
          {(v.evidence || []).map(e=><p key={e.key}>{e.label} · {e.title}{e.contribution && ' · '+e.contribution}</p>)}</details>)}</details>}
    </>}
    {notice && <p className="perf-hint" role="status">{notice}</p>}
  </div>;
}

function MemberPerformance(props) {
  const {memberId,openRequest}=props;
  const section=useRef(null);
  const relevant=openRequest?.memberId===memberId && ['coaching','review'].includes(openRequest.kind);
  const [tab,setTab]=useState(relevant && openRequest.kind==='review' && memberId==='me'?'self':relevant?'coaching':'cycle');
  const [selectedId,setSelectedId]=useState(relevant?openRequest.id:null);
  useEffect(()=>{
    if (!relevant) return;
    setSelectedId(openRequest.id || null);
    setTab(openRequest.kind==='review' && memberId==='me'?'self':'coaching');
    section.current?.scrollIntoView({block:'start'});
  },[openRequest?.key,openRequest?.kind,openRequest?.id,memberId,relevant]);
  const tabs=[['cycle','绩效周期'],['coaching','1:1 沟通']];
  if (memberId==='me') tabs.push(['self','我的绩效自评']);
  return <section className="perf-panel" ref={section} aria-label="沟通与绩效">
    <div className="perf-heading"><h2>沟通与绩效</h2></div>
    <div className="perf-tabs">{tabs.map(([key,label])=><button key={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</div>
    {tab==='cycle' && <Cycle {...props}/>}
    {tab==='coaching' && <Coaching {...props} selectedId={selectedId} setSelectedId={setSelectedId}/>}
    {tab==='self' && <SelfReview key={openRequest?.key || memberId} {...props} requestedId={openRequest?.id}/>}
  </section>;
}

export function Performance(props) {
  return <MemberPerformance key={props.memberId} {...props}/>;
}

export function TodayPeople({members=[],events=[],coaching=[],tasks=[],onOpen,onOpenTask}) {
  const [today,setToday]=useState(todayISO);
  const [selected,setSelected]=useState('');
  useEffect(()=>{
    const refresh=()=>setToday(todayISO());
    const handle=setInterval(refresh,30000);
    window.addEventListener('focus',refresh);
    return ()=>{clearInterval(handle);window.removeEventListener('focus',refresh);};
  },[]);
  const active=members.filter(m=>!m.archived);
  const target=active.find(m=>m.id===selected) || active.find(m=>m.id!=='me') || active[0];
  const followUps=dueFollowUps(coaching,events,today);
  const dueTasks=tasks.filter(t=>t.due===today && !['已完成','已取消','已关闭'].includes(t.status));
  return <section className="perf-today section-block" aria-label="团队跟进">
    <div className="perf-heading"><h2>团队跟进</h2><button type="button" className="perf-link" onClick={()=>onOpen({kind:'review',memberId:'me'})}>
      <FileText size={17}/>我的绩效自评<ArrowRight size={15}/></button></div>
    <div className="perf-quick"><CalendarCheck size={23}/><div><strong>{followUps.length} 项待跟进</strong>
      <p>{followUps.filter(f=>f.overdue).length} 项逾期 · {dueTasks.length} 项项目任务今日到期</p></div>
      <div className="perf-actions"><select aria-label="快速记事成员" value={target?.id || ''} onChange={e=>setSelected(e.target.value)}>
        {active.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <Button disabled={!target} onClick={()=>onOpen({kind:'event',memberId:target.id})}><Plus size={16}/>记事迹</Button></div></div>
    {followUps.map(item=><button type="button" key={item.kind+item.id} className="perf-due" onClick={()=>onOpen({kind:item.kind,id:item.id,memberId:item.memberId})}>
      <ChatsCircle size={19}/><span><strong>{item.title}</strong><small>{members.find(m=>m.id===item.memberId)?.name} · {item.kind==='coaching'?'1:1 跟进':'黑事件复核'}</small></span>
      <time className={item.overdue?'orange':''}>{item.overdue?'逾期 · '+item.date:'今日到期'}</time><CaretRight size={15}/></button>)}
    {dueTasks.map(t=><button type="button" key={t.id} disabled={!onOpenTask} className="perf-due" onClick={()=>onOpenTask(t.id)}>
      <CalendarCheck size={19}/><span><strong>{t.title}</strong><small>{members.find(m=>m.id===t.owner)?.name || '待分配'} · 项目任务</small></span>
      <time>今日到期</time><CaretRight size={15}/></button>)}
  </section>;
}
