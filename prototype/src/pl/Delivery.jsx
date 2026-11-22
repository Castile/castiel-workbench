import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowSquareOut, CaretRight, Check, ClipboardText, FolderSimple, Plus, Plugs, X } from '@phosphor-icons/react';
import { makeTask, plannedWeek, weekStart } from '../workspaceData.js';
import { usePersistence } from '../state/Persistence.jsx';
import { encodeDocument } from '../state/document.js';
import { applyPreview, defaultFields, fieldNames, MAX_IMPORT_BYTES, parseFeed, previewImport, safeItemUrl, statuses, types } from './delivery.js';
import './delivery.css';

function Field({label, children}) {
  return <label className="w-field"><span>{label}</span>{children}</label>;
}

function Dialog({title, close, children}) {
  const ref=useRef(null), heading=useId();
  useEffect(()=>{
    const element=ref.current;
    element.showModal();
    return ()=>element.close();
  },[]);
  return <dialog className="delivery-dialog" ref={ref} aria-labelledby={heading} onCancel={close}>
    <header><h2 id={heading}>{title}</h2><button className="icon-button" type="button" aria-label="关闭窗口" onClick={close}><X size={20}/></button></header>
    {children}
  </dialog>;
}

function SourceLink({url,notify}) {
  const href=safeItemUrl(url);
  if(!href) return null;
  const open=async event=>{
    if(!window.castielDesktop) return;
    event.preventDefault();
    try {await window.castielDesktop.openExternal(href);} catch {notify('无法打开详情链接');}
  };
  return <a className="delivery-link" href={href} target="_blank" rel="noopener noreferrer" onClick={open}>打开原始记录 <ArrowSquareOut size={14}/></a>;
}

const memberName=(id,members)=>members.find(member=>member.id===id)?.name || '待分配';
function weekLabel(week) {
  if(week===null) return '未排期';
  return ({0:'本周',1:'下周','-1':'上周'})[week] || weekStart(week)+' 当周';
}

function ProjectForm({project, save, close}) {
  const [draft,setDraft]=useState(project||{name:'',goal:'',milestone:'',due:''});
  const change=(key,value)=>setDraft(previous=>({...previous,[key]:value}));
  return <Dialog title={project?'编辑项目':'新建项目'} close={close}><form onSubmit={event=>{
    event.preventDefault();
    if(draft.name.trim()) save({...draft,id:project?.id||crypto.randomUUID(),color:project?.color||'blue',name:draft.name.trim()});
  }}>
    <Field label="项目名称"><input required maxLength={80} value={draft.name} onChange={e=>change('name',e.target.value)}/></Field>
    <Field label="项目目标"><textarea maxLength={3000} value={draft.goal} onChange={e=>change('goal',e.target.value)}/></Field>
    <div className="delivery-grid"><Field label="里程碑"><input value={draft.milestone} maxLength={160} onChange={e=>change('milestone',e.target.value)}/></Field>
    <Field label="目标日期"><input type="date" value={draft.due} onChange={e=>change('due',e.target.value)}/></Field></div>
    <div className="delivery-actions"><button type="button" className="secondary" onClick={close}>取消</button><button className="primary" disabled={!draft.name.trim()}>保存项目</button></div>
  </form></Dialog>;
}

function ItemForm({entry, rows, members, projectId, type, sourceName, save, close, notify}) {
  const initial=entry || {title:'',entityType:type,status:'待规划',owner:'',due:'',projectId,week:null,effort:null};
  const [draft,setDraft]=useState({...initial}), [error,setError]=useState('');
  const [selectedWeek,setWeek]=useState(entry?plannedWeek(entry):null);
  const change=(key,value)=>setDraft(previous=>({...previous,[key]:value}));
  const entityType=draft.entityType;
  const external=Boolean(draft.sourceId);
  const peers=rows.filter(row=>row.id!==entry?.id && row.projectId===projectId);
  const incoming=peers.filter(row=>row.relatedIds?.includes(entry?.id));
  const activeMembers=members.filter(member=>!member.archived||member.id===draft.owner);
  const effectiveOwner=external&&!draft.ownerOverride?draft.sourceOwner:draft.owner;
  const entity=types[entityType];
  const weeks=[...new Set([-1,0,1,2,3,4,...(selectedWeek!==null?[selectedWeek]:[])])].sort((a,b)=>a-b);
  const relatedIds=draft.relatedIds||[];
  function submit(event) {
    event.preventDefault();
    if(!draft.title.trim()) return;
    if(draft.url&&!safeItemUrl(draft.url)) {setError('请输入包含 http 或 https 的有效详情链接');return;}
    const data={...draft,title:draft.title.trim(),owner:effectiveOwner||''};
    if(entityType==='task') {
      data.week=selectedWeek;
      data.scheduledWeekStart=selectedWeek===null?'':weekStart(selectedWeek);
      data.effort=draft.effort===''||draft.effort==null?null:Number(draft.effort);
      data.needsPlanReview=false;
    }
    save(data);
  }
  return <Dialog title={entry?(external?'工作项与本地安排':'编辑'+entity):'新建工作项'} close={close}>
    <form onSubmit={submit}>
      {external?<section className="delivery-source-detail">
        <small>{sourceName} · {draft.externalId} · {entity}</small><h3>{draft.title}</h3>
        <p>源系统负责人　{draft.rawOwner||'未指定'}{draft.sourceOwner?'（'+memberName(draft.sourceOwner,members)+'）':''}</p>
        <p>原始状态　{draft.rawStatus||'未提供'}　·　截止日　{draft.due||'未设置'}</p>
        {draft.criteria&&<p>验收条件　{draft.criteria}</p>}{draft.severity&&<p>严重程度　{draft.severity}</p>}
        <SourceLink url={draft.url} notify={notify}/>
      </section>:<>
        {!entry&&<Field label="工作项类型"><select value={entityType} onChange={e=>change('entityType',e.target.value)}>{Object.entries(types).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></Field>}
        <Field label="标题"><input required maxLength={200} value={draft.title} onChange={e=>change('title',e.target.value)}/></Field>
        <div className="delivery-grid"><Field label="状态"><select value={draft.status} onChange={e=>change('status',e.target.value)}>{[...new Set([...statuses,draft.status])].map(value=><option key={value}>{value}</option>)}</select></Field>
        <Field label="截止日期"><input type="date" value={draft.due||''} onChange={e=>change('due',e.target.value)}/></Field></div>
        {entityType==='requirement'&&<Field label="验收条件"><textarea value={draft.criteria||''} onChange={e=>change('criteria',e.target.value)}/></Field>}
        {entityType==='issue'&&<Field label="严重程度"><select value={draft.severity||''} onChange={e=>change('severity',e.target.value)}><option value="">待评估</option>{['低','中','高','紧急'].map(value=><option key={value}>{value}</option>)}</select></Field>}
        <Field label="详情链接"><input type="url" placeholder="https://" value={draft.url||''} onChange={e=>change('url',e.target.value)}/></Field>
      </>}
      {(!external||entityType==='task')&&<Field label={entityType==='task'?'计划执行人':'负责人'}><select value={external&&!draft.ownerOverride?'@source':draft.owner||''} onChange={e=>{
        const follow=e.target.value==='@source';
        setDraft(previous=>({...previous,owner:follow?previous.sourceOwner:e.target.value,ownerOverride:external&&!follow}));
      }}>
        {external&&<option value="@source">跟随源系统 · {memberName(draft.sourceOwner,members)}</option>}
        <option value="">待分配</option>{activeMembers.map(member=><option key={member.id} value={member.id}>{member.name} · {member.role||member.id}</option>)}
      </select></Field>}
      {entityType==='task'&&<div className="delivery-grid"><Field label="计划周"><select value={selectedWeek??''} onChange={e=>setWeek(e.target.value===''?null:Number(e.target.value))}><option value="">未排期</option>{weeks.map(value=><option key={value} value={value}>{weekLabel(value)}</option>)}</select></Field>
      <Field label="计划投入（小时）"><input type="number" min="0" step="any" placeholder="未估算" value={draft.effort??''} onChange={e=>change('effort',e.target.value)}/></Field></div>}
      <Field label="本地备注"><textarea value={draft.planNote||''} maxLength={5000} onChange={e=>change('planNote',e.target.value)}/></Field>
      <details className="delivery-details"><summary>关联工作项 · {new Set([...relatedIds,...incoming.map(row=>row.id)]).size}</summary>
        {peers.length?peers.map(row=><label key={row.id} className="delivery-choice"><input type="checkbox" checked={relatedIds.includes(row.id)||incoming.includes(row)} disabled={incoming.includes(row)} onChange={e=>change('relatedIds',e.target.checked?[...relatedIds,row.id]:relatedIds.filter(id=>id!==row.id))}/><span>{types[row.entityType]} · {row.title}</span>{incoming.includes(row)&&<small>对方关联</small>}</label>):<p>项目中暂无其他工作项。</p>}
      </details>
      {draft.needsPlanReview&&<p className="delivery-warning">源系统负责人有变更，请核对本地排期后保存。</p>}
      {error&&<p className="delivery-warning" role="alert">{error}</p>}
      <div className="delivery-actions"><button type="button" className="secondary" onClick={close}>取消</button><button className="primary" disabled={!draft.title.trim()}>{external?'保存本地安排':'保存工作项'}</button></div>
    </form>
  </Dialog>;
}

export function Delivery({members,projects,setProjects,tasks,onCreateTasks,onUpdateTask,items,setItems,sources,notify}) {
  const [projectId,setProjectId]=useState(projects[0]?.id||'');
  const [filter,setFilter]=useState('all'),[dialog,setDialog]=useState(null);
  const project=projects.find(p=>p.id===projectId)||projects[0];
  const rows=useMemo(()=>[...items,...tasks.map(task=>({...task,entityType:'task'}))],[tasks,items]);
  const scoped=rows.filter(row=>row.projectId===project?.id);
  const visible=scoped.filter(row=>filter==='all'||row.entityType===filter);
  const close=()=>setDialog(null);
  function saveItem(data) {
    if(data.entityType==='task') {
      if(data.id) onUpdateTask(data.id,data);
      else onCreateTasks([makeTask(data.title,data)]);
    } else setItems(current=>data.id?current.map(item=>item.id===data.id?data:item):[...current,{...data,id:crypto.randomUUID()}]);
    close();notify('已保存工作项');
  }
  return <div className="delivery-page">
    <div className="delivery-bar"><Field label="交付项目"><select value={project?.id||''} onChange={e=>setProjectId(e.target.value)}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
    <button className="secondary" onClick={()=>setDialog({kind:'project'})}><Plus size={16}/>新建项目</button></div>
    {project&&<section className="delivery-panel">
      <header className="delivery-project-header"><span className="delivery-icon"><FolderSimple size={25}/></span><div><h2>{project.name}</h2>{project.goal&&<p>{project.goal}</p>}</div><button className="secondary" onClick={()=>setDialog({kind:'project',project})}>编辑项目</button></header>
      {(project.milestone||project.due)&&<div className="delivery-milestone"><span>里程碑</span><strong>{project.milestone||'待命名'}</strong>{project.due&&<time>{project.due}</time>}</div>}
      <div className="delivery-list-head"><div className="delivery-filters" aria-label="筛选工作项">{Object.entries({all:'全部',...types}).map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label} <small>{key==='all'?scoped.length:scoped.filter(row=>row.entityType===key).length}</small></button>)}</div>
      <button className="primary" onClick={()=>setDialog({kind:'item'})}><Plus size={16}/>新建工作项</button></div>
      {visible.length?<div className="delivery-rows">{visible.map(row=><button className="delivery-row" key={row.id} onClick={()=>setDialog({kind:'item',row})}>
        <span className="delivery-main"><small>{types[row.entityType]} · {sources.find(s=>s.id===row.sourceId)?.name || (row.sourceId?'外部系统':'本地')}{row.externalId?' · '+row.externalId:''}</small><strong>{row.title}</strong>{row.needsPlanReview&&<small className="delivery-warning">负责人变更，需复核排期</small>}</span>
        <span className="delivery-owner">{row.sourceId&&<small>源系统　{row.rawOwner||'待分配'}</small>}{row.entityType==='task'?'执行人　':'负责人　'}{memberName(row.owner,members)}{row.entityType==='task'&&<small>{weekLabel(plannedWeek(row))} · {row.effort==null?'未估算':row.effort+' h'}</small>}</span>
        <span className="delivery-row-status">{row.status}<small>{row.due||'未设截止日'}</small></span><CaretRight size={16}/>
      </button>)}</div>:<div className="delivery-empty"><ClipboardText size={28}/><p>这个项目还没有{filter==='all'?'工作项':types[filter]}。</p></div>}
    </section>}
    {dialog?.kind==='project'&&<ProjectForm project={dialog.project} close={close} save={saved=>{
      setProjects(current=>dialog.project?current.map(p=>p.id===saved.id?saved:p):[...current,saved]);setProjectId(saved.id);close();notify('已保存项目');
    }}/>}
    {dialog?.kind==='item'&&<ItemForm entry={dialog.row} rows={rows} members={members} projectId={project.id} type={filter==='all'?'requirement':filter} sourceName={sources.find(s=>s.id===dialog.row?.sourceId)?.name||'外部系统'} close={close} save={saveItem} notify={notify}/>}
  </div>;
}

function MappingRows({label, entries, options, update}) {
  function setPair(index,column,value) {
    update(entries.map((pair,i)=>i===index?pair.map((part,j)=>j===column?value:part):pair));
  }
  return <div className="delivery-mapping"><strong>{label}</strong>
    {entries.map(([from,to],i)=><div className="delivery-map-row" key={i}>
      <input aria-label={label+' · 原值 '+(i+1)} maxLength={200} placeholder="源系统标识" value={from} onChange={e=>setPair(i,0,e.target.value)}/>
      <select aria-label={label+' · 本地值 '+(i+1)} value={to} onChange={e=>setPair(i,1,e.target.value)}>{options.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
      <button type="button" className="icon-button" aria-label={'删除'+label+'第'+(i+1)+'行'} onClick={()=>update(entries.filter((_,j)=>j!==i))}><X size={16}/></button>
    </div>)}
    <button type="button" className="delivery-link" onClick={()=>update([...entries,['',options[0][0]]])}><Plus size={15}/>添加{label}</button>
  </div>;
}

function SourceForm({source,projects,members,save,close}) {
  const [draft,setDraft]=useState(()=>({name:'',url:'',projectId:projects[0]?.id||'',defaultType:'task',listPath:'',
    ...source,fields:{...defaultFields,...source?.fields},entityMap:source?.entityMap||[],statusMap:source?.statusMap||[],personMap:source?.personMap||[]}));
  const [error,setError]=useState('');
  const change=(key,value)=>setDraft(previous=>({...previous,[key]:value}));
  function submit(event) {
    event.preventDefault();
    try {
      let url='';
      if(draft.url.trim()) {
        const parsed=new URL(draft.url.trim());
        if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash||[...parsed.searchParams.keys()].some(key=>/token|secret|password|passwd|credential|api[_-]?key|authorization|signature/i.test(key))) throw new Error('请输入 HTTPS 接口地址，请在独立凭据栏设置认证');
        url=parsed.href;
      }
      const next={...draft,url,name:draft.name.trim(),id:source?.id||crypto.randomUUID()};
      for(const key of ['entityMap','statusMap','personMap']) {
        const entries=draft[key].map(([from,to])=>[from.trim(),to]);
        if(entries.some(([from])=>!from)||new Set(entries.map(([from])=>from)).size!==entries.length) throw new Error('请补全映射原值，每个原值只能对应一项');
        next[key]=entries;
      }
      if(!next.name||!next.projectId||!next.fields.title.trim()||!next.fields.externalId.trim()) throw new Error('请填写名称、目标项目、远端 ID 和标题字段');
      save(next);
    } catch(e) { setError(e instanceof TypeError?'请输入有效的 HTTPS 接口地址':e.message); }
  }
  const personOptions=[['','待分配'],...members.filter(member=>!member.archived).map(member=>[member.id,member.name+' · '+(member.role||'成员')+' · '+member.id])];
  return <Dialog title={source?'配置数据源':'添加数据源'} close={close}><form onSubmit={submit}>
    <div className="delivery-grid"><Field label="系统实例名称"><input required maxLength={80} value={draft.name} onChange={e=>change('name',e.target.value)} placeholder="例如：研发工单"/></Field>
    <Field label="导入到项目"><select required value={draft.projectId} onChange={e=>change('projectId',e.target.value)}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field></div>
    <Field label="只读 API 地址（可选）"><input type="url" placeholder="https://tracker.example.com/api/items" value={draft.url} onChange={e=>change('url',e.target.value)}/></Field>
    <div className="delivery-grid"><Field label="JSON 列表路径"><input placeholder="根数组可留空，如 data.items" maxLength={200} value={draft.listPath} onChange={e=>change('listPath',e.target.value.trim())}/></Field>
    <Field label="无类型字段时导入为"><select value={draft.defaultType} onChange={e=>change('defaultType',e.target.value)}>{Object.entries(types).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></Field></div>
    <details className="delivery-details"><summary>字段映射</summary><div className="delivery-grid">
      {Object.entries(fieldNames).map(([key,label])=><Field key={key} label={label+'字段'}><input required={key==='externalId'||key==='title'} maxLength={200} value={draft.fields[key]} onChange={e=>change('fields',{...draft.fields,[key]:e.target.value.trim()})}/></Field>)}
    </div></details>
    <details className="delivery-details"><summary>实体、状态与人员映射</summary>
      <MappingRows label="类型映射" entries={draft.entityMap} options={Object.entries(types)} update={v=>change('entityMap',v)}/>
      <MappingRows label="状态映射" entries={draft.statusMap} options={statuses.map(value=>[value,value])} update={v=>change('statusMap',v)}/>
      <MappingRows label="人员映射" entries={draft.personMap} options={personOptions} update={v=>change('personMap',v)}/>
      <p>人员可按成员 ID 或唯一姓名匹配。重名时添加源系统标识与本地成员的映射。</p>
    </details>
    {error&&<p className="delivery-warning" role="alert">{error}</p>}
    <div className="delivery-actions"><button type="button" className="secondary" onClick={close}>取消</button><button className="primary">保存配置</button></div>
  </form></Dialog>;
}

function CredentialForm({source,storage,close,notify}) {
  const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function update(value) {
    setBusy(true);setError('');
    try {await storage.flush();await window.castielDesktop.setSourceToken({sourceId:source.id,token:value});setToken('');notify(value?'已保存此接口的本机凭据':'已清除此接口的本机凭据');close();}
    catch(e){setError(e.message);}
    finally{setBusy(false);}
  }
  return <Dialog title={'接口凭据 · '+source.name} close={close}><form onSubmit={e=>{e.preventDefault();if(token.trim())update(token.trim());}}>
    <Field label="Bearer Token"><input autoComplete="off" type="password" value={token} maxLength={8192} onChange={e=>setToken(e.target.value)}/></Field>
    <p>凭据由桌面端使用系统加密能力保存，仅在读取该接口时使用。</p>
    {error&&<p className="delivery-warning" role="alert">{error}</p>}
    <div className="delivery-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>update('')}>清除凭据</button><button className="primary" disabled={busy||!token.trim()}>保存凭据</button></div>
  </form></Dialog>;
}

function ImportForm({source,projects,members,tasks,items,sources,setSources,onApplyImport,storage,notify,close,configure}) {
  const [input,setInput]=useState(''),[rows,setRows]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[page,setPage]=useState(0);
  const results=useMemo(()=>previewImport({rows,source,members,tasks,items}),[rows,source,members,tasks,items]);
  const eligible=results.filter(r=>r.record);
  const count=action=>results.filter(row=>row.action===action).length;
  const active=useRef(true);
  useEffect(()=>{active.current=true;return ()=>{active.current=false;};},[]);
  const report=message=>{setError(message);setSources(current=>current.map(s=>s.id===source.id?{...s,lastError:message}:s));};
  async function read(getInput) {
    setRows([]);setPage(0);setError('');setBusy(true);
    try {
      const batch=parseFeed(await getInput(),source.listPath);
      if(active.current)setRows(batch);
    } catch(e) {if(active.current)report(e.message);}
    finally{if(active.current)setBusy(false);}
  }
  function apply() {
    const changes=applyPreview(items,results);
    const fullTasks=new Map(tasks.map(task=>[task.id,task]));
    changes.tasks.forEach(task=>fullTasks.set(task.id,task));
    const nextSource={...source,lastSuccess:new Date().toISOString(),lastError:count('conflict')?'本次跳过 '+count('conflict')+' 条冲突记录':''};
    const nextSources=sources.map(s=>s.id===source.id?nextSource:s);
    try {
      encodeDocument({...storage.data,records:{...storage.data.records,tasks:[...fullTasks.values()],sessions:storage.data.records?.sessions||[]},plItems:changes.items,plSources:nextSources});
      onApplyImport(changes);
      setSources(current=>current.map(s=>s.id===source.id?nextSource:s));
      notify('已导入 '+eligible.length+' 条工作项');close();
    } catch(e) {report(e.message);}
  }
  return <Dialog title={'导入预览 · '+source.name} close={close}>
    <div className="delivery-import-target"><span>目标项目　<strong>{projects.find(p=>p.id===source.projectId)?.name||'项目缺失'}</strong></span><button className="delivery-link" onClick={configure}>调整映射</button></div>
    <Field label="粘贴 CSV 或 JSON"><textarea className="delivery-feed" value={input} disabled={busy} onChange={e=>{setInput(e.target.value);setRows([]);setError('');}} placeholder={'id,type,title,status,owner\n42,task,验证支付回调,待规划,'}/></Field>
    <div className="delivery-buttons">
      <button className="secondary" disabled={busy||!input.trim()} onClick={()=>read(()=>input)}>预览文本</button>
      <label className={'secondary delivery-file'+(busy?' disabled':'')}>读取本机文件<input aria-label="读取 CSV 或 JSON 文件" type="file" accept=".csv,.json,application/json,text/csv" disabled={busy} onChange={e=>{
        const file=e.target.files?.[0];e.target.value='';
        if(file) read(()=>{if(file.size>MAX_IMPORT_BYTES)throw new Error('每次导入最多 1 MB');return file.text();});
      }}/></label>
      {source.url&&<button className="secondary" disabled={busy||!storage.api?.fetchSource} onClick={()=>read(async()=>{await storage.flush();return storage.api.fetchSource({sourceId:source.id});})}>读取 API</button>}
    </div>
    <p className="delivery-help">每批最多 2,000 条、1 MB。{source.url&&!storage.api?.fetchSource?'请在桌面版读取 API。':''}</p>
    {busy&&<p role="status">正在读取数据…</p>}{error&&<p className="delivery-warning" role="alert">{error}</p>}
    {results.length>0&&<section className="delivery-preview"><h3>预览结果</h3><p>新增 {count('create')}　更新 {count('update')}　人员未匹配 {results.filter(r=>r.unmatched).length}　冲突 {count('conflict')}</p>
      <div className="delivery-preview-list">{results.slice(page*15,(page+1)*15).map((r,i)=><div key={i}>
        <span className={r.action==='conflict'?'delivery-warning':''}>{({create:'新增',update:'更新',conflict:'跳过'})[r.action]}</span>
        <div><strong>{r.title||'缺少标题'}</strong><small>{types[r.entityType]||'未知类型'} · {r.externalId||'缺少 ID'}</small>
        {r.reasons.length>0&&<small className="delivery-warning">{r.reasons.join('、')}</small>}
        {r.unmatched&&<small>人员「{r.record?.rawOwner||'未匹配'}」待分配</small>}{r.record?.needsPlanReview&&<small>源系统负责人变更，需复核本地排期</small>}</div>
      </div>)}</div>
      {results.length>15&&<div className="delivery-paging"><button className="secondary" disabled={!page} onClick={()=>setPage(page-1)}>上一页</button><span>{page+1} / {Math.ceil(results.length/15)}</span><button className="secondary" disabled={(page+1)*15>=results.length} onClick={()=>setPage(page+1)}>下一页</button></div>}
      <div className="delivery-actions"><button className="primary" disabled={!eligible.length||!projects.some(p=>p.id===source.projectId)} onClick={apply}><Check size={16}/>确认导入 {eligible.length} 条</button></div>
    </section>}
  </Dialog>;
}

function exportMapping(source) {
  const {name,fields,entityMap,statusMap,personMap,defaultType,listPath}=source;
  const blob=new Blob([JSON.stringify({name,fields,entityMap,statusMap,personMap,defaultType,listPath},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='工作项映射.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function Connections(props) {
  const {sources,setSources,members,projects,notify}=props;
  const storage=usePersistence();
  const [editing,setEditing]=useState(null),[action,setAction]=useState(null);
  const selected=sources.find(s=>s.id===action?.id);
  const editSource=sources.find(s=>s.id===editing?.id);
  function saveSource(saved) {
    const next=editSource?sources.map(s=>s.id===saved.id?saved:s):[...sources,saved];
    encodeDocument({...storage.data,plSources:next});
    setSources(next);setEditing(null);notify('已保存数据源配置');
  }
  return <div className="delivery-page"><div className="delivery-bar"><div><h2>系统接入</h2><p>从本地文件或只读 API 导入项目工作项。</p></div>
    <button className="primary" onClick={()=>setEditing({})}><Plus size={16}/>添加数据源</button></div>
    {sources.length?sources.map(source=><section className="delivery-panel delivery-connection" key={source.id}>
      <header><span className="delivery-icon"><Plugs size={22}/></span><div><h3>{source.name}</h3><small>{projects.find(p=>p.id===source.projectId)?.name||'项目缺失'} · {source.url?'文件 / 只读 API':'文件导入'}</small></div></header>
      <p>上次成功导入　{source.lastSuccess?new Date(source.lastSuccess).toLocaleString():'暂无记录'}</p>
      {source.lastError&&<p className="delivery-warning">上次错误　{source.lastError}</p>}
      <div className="delivery-buttons"><button className="primary" onClick={()=>setAction({id:source.id,type:'import'})}>导入预览</button><button className="secondary" onClick={()=>setEditing({id:source.id})}>配置映射</button>
      {source.url&&<button className="secondary" disabled={!storage.api?.setSourceToken} onClick={()=>setAction({id:source.id,type:'token'})}>接口凭据</button>}
      <button className="delivery-link" onClick={()=>exportMapping(source)}>导出映射</button></div>
    </section>):<div className="delivery-panel delivery-empty"><Plugs size={30}/><p>添加公司系统实例后，可以配置字段映射并预览工作项。</p></div>}
    {action?.type==='import'&&selected&&<ImportForm key={selected.id+' '+selected.url+' '+selected.listPath} {...props} source={selected} storage={storage} close={()=>setAction(null)} configure={()=>setEditing({id:selected.id})}/>}
    {action?.type==='token'&&selected&&<CredentialForm source={selected} storage={storage} notify={notify} close={()=>setAction(null)}/>}
    {editing&&<SourceForm source={editSource} projects={projects} members={members} save={saveSource} close={()=>setEditing(null)}/>}
  </div>;
}
