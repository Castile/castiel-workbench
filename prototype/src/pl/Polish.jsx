import React,{useEffect,useRef,useState} from 'react';
import {useAgents} from '../state/Agents';
import {usePersistence} from '../state/Persistence';

export default function Polish({value = '',onApply,evidence = ''}) {
  const agents = useAgents();
  const storage = usePersistence();
  const api = window.castielDesktop;
  const [editor,setEditor] = useState(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const run = useRef(null);
  useEffect(()=>()=>{ if(run.current) api?.cancelPolish(run.current).catch(()=>{}); },[api]);
  const options = ['Claude','Codex'].filter(name => agents.catalog.agents[name]?.installed && storage.data.agentConfig?.[name]?.enabled !== false);
  function open() {
    const agent = options[0] || 'Claude';
    setError('');
    setEditor({agent,model:storage.data.agentConfig?.[agent]?.defaultModel || 'system',original:value, excerpt:value, evidence:'', suggestion:null});
  }
  const patch = changes => setEditor(current=>current && {...current,...changes});
  async function submit() {
    const id = crypto.randomUUID();
    run.current = id;
    setBusy(true);setError('');
    try {
      await storage.flush();
      const suggestion = await api.polish({requestId:id,agent:editor.agent,model:editor.model,text:editor.excerpt,evidence:editor.evidence});
      if (run.current === id) patch({suggestion});
    } catch(e) { if(run.current===id) setError(e.message); }
    finally { if(run.current===id) {run.current=null;setBusy(false);} }
  }
  function close() {
    if(run.current) api?.cancelPolish(run.current).catch(()=>{});
    run.current=null;setBusy(false);setEditor(null);setError('');
  }
  const selectionValid = editor?.excerpt.trim() && editor.original.includes(editor.excerpt) && editor.original.indexOf(editor.excerpt) === editor.original.lastIndexOf(editor.excerpt);
  if(!editor) return <button className="secondary" type="button" disabled={!value.trim()} onClick={open}>AI 润色</button>;
  return <section className="pl-polish section-block" aria-label="AI 润色">
    <h3>AI 润色</h3>
    <label className="w-field">发给模型的原文<textarea maxLength={18000} disabled={busy} value={editor.excerpt} onChange={e=>patch({excerpt:e.target.value,suggestion:null})}/></label>
    {!selectionValid && <small>请保留原文中可以唯一定位的连续段落。</small>}
    <label className="w-field">参考事实（可选）<textarea maxLength={18000} disabled={busy} value={editor.evidence} onChange={e=>patch({evidence:e.target.value,suggestion:null})}/></label>
    {typeof evidence==='string' && evidence.trim() && <button type="button" className="subtle-link" disabled={busy} onClick={()=>patch({evidence:evidence.slice(0,18000),suggestion:null})}>填入已选材料</button>}
    <div className="view-toolbar"><select aria-label="润色 Agent" disabled={busy} value={editor.agent} onChange={e=>patch({agent:e.target.value,model:storage.data.agentConfig?.[e.target.value]?.defaultModel||'system',suggestion:null})}>{(options.length?options:[editor.agent]).map(name=><option key={name}>{name}</option>)}</select>
    <select aria-label="润色模型" disabled={busy} value={editor.model} onChange={e=>patch({model:e.target.value,suggestion:null})}>{agents.models(editor.agent).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div>
    {editor.suggestion!==null && <label className="w-field">建议稿 · 可修改<textarea value={editor.suggestion} onChange={e=>patch({suggestion:e.target.value})}/></label>}
    {error && <p role="alert">{error}</p>}
    {!api && <p className="table-note">桌面应用可调用本机模型配置。</p>}
    <div className="view-toolbar"><button type="button" className="primary" disabled={!api || !options.length || busy || !selectionValid} onClick={submit}>{busy?'正在润色…':editor.suggestion===null?'确认发送以上内容':'重新润色'}</button>
    {editor.suggestion!==null && <button type="button" className="secondary" disabled={!editor.suggestion.trim()||busy} onClick={()=>{if(value!==editor.original){setError('原稿已改变，请关闭后重新选择段落');return;}onApply(value.replace(editor.excerpt,()=>editor.suggestion));close();}}>采纳建议稿</button>}
    <button type="button" className="secondary" onClick={close}>{busy?'取消请求':'保留原稿'}</button></div>
  </section>;
}
