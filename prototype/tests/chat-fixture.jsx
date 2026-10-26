// Local component scenarios only. Not an app entry and never included in the desktop build.
import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Conversation,LatestButton,useChatScroll} from '../src/chat/Conversation';
import {RequestCard} from '../src/chat/RequestCard';
import '../src/styles.css';
import '../src/refinement.css';
const reply='## 先把问题缩小\n\n回调要做到 **可重复接收、只处理一次**。可以用 `eventId` 作为幂等键。\n\n```typescript\nasync function handleCallback(event: PaymentEvent) {\n  const saved = await events.insertIfAbsent(event.id);\n  if (!saved) return { status: "already_processed" };\n  await reconcile(event);\n  return { status: "ok" };\n}\n```\n\n| 场景 | 处理方式 | 验证 |\n| --- | --- | --- |\n| 重复回调 | 直接返回已有结果 | 同一事件调用两次 |\n| 并发到达 | 唯一键约束 | 并发请求测试 |\n\n- [x] 明确幂等边界\n- [ ] 补充事务失败的恢复测试\n\n> 这里只展示方案，是否执行需要你确认。\n\n[查看参考](https://example.com/docs)\n\n```unlisted-language\nliteral <script>must not execute</script>\n```';
const questions=[{id:'scope',header:'执行范围',question:'这次希望我推进到哪一步？',options:[{label:'实现并验证（推荐）',description:'完成最小修复，运行必要检查，再汇报结果。'},{label:'先给方案',description:'先整理修改点和风险，暂不改动文件。'},{label:'custom',description:'工具提供的原始选项值'}]},{id:'detail',header:'补充要求',question:'还有哪些边界情况需要关注？'}];
const questionRun={agent:'Codex',requests:[{},{}],request:{token:'questions',kind:'questions',questions}};
function Fixture(){
  const [scenario,setScenario]=useState('Markdown'),[theme,setTheme]=useState('light'),[result,setResult]=useState(''),[fail,setFail]=useState(false),[extra,setExtra]=useState('');
  const ref=useRef();document.documentElement.dataset.theme=theme;
  const run=scenario==='补充问题'?questionRun:scenario==='敏感输入'?{request:{token:'secret',kind:'questions',questions:[{id:'secret',question:'输入测试用临时口令',isSecret:true}]}}:{request:{token:'approval',kind:'command',command:'npm run test -- --runInBand',cwd:'/work/example',reason:'需要运行工作空间中的测试，以确认修改是否引入回归。'}};
  const messages=[{who:'我',time:'刚刚',text:'请检查回调幂等问题，给我一个可验证的修改方案。'},{who:'Codex',time:'方案示例',model:'本机默认',text:scenario==='长对话'?Array.from({length:12},(_,i)=>`### 检查 ${i+1}\n\n`+reply).join('\n\n')+extra:reply+extra}];
  const scroll=useChatScroll(ref,scenario,true,messages[1].text);
  return <div style={{height:'100dvh',display:'flex',flexDirection:'column',background:'var(--bg)',color:'var(--text)'}}><header style={{display:'flex',gap:10,flexWrap:'wrap',padding:16,borderBottom:'1px solid var(--border)'}}><strong>本地组件验证 · 无模型调用</strong>{['Markdown','补充问题','工具授权','敏感输入','长对话'].map(s=><button key={s} onClick={()=>{setScenario(s);setResult('')}}>{s}</button>)}<button onClick={()=>setTheme(v=>v==='light'?'dark':'light')}>切换深浅色</button><label><input type="checkbox" checked={fail} onChange={e=>setFail(e.target.checked)}/>模拟提交失败</label><button onClick={()=>setExtra(v=>v+'\n\n追加流式内容。')}>追加输出</button></header><div ref={ref} onScroll={scroll.onScroll} style={{padding:'28px 24px',overflow:'auto',flex:1,minHeight:0}}><Conversation messages={messages}>{['补充问题','工具授权','敏感输入'].includes(scenario)&&!result&&<RequestCard key={scenario} run={run} onAnswer={async answer=>{await new Promise(r=>setTimeout(r,300));if(fail)throw new Error('连接暂时中断，请重试');setResult(JSON.stringify(answer))}}/>}{result&&<output aria-label="提交结果">{result}</output>}</Conversation></div><footer style={{position:'relative',padding:18,textAlign:'center',borderTop:'1px solid var(--border)'}}>{!scroll.atBottom&&<LatestButton onClick={scroll.toLatest}/>}本页只验证真实组件，提交结果不会保存到工作台。</footer></div>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
