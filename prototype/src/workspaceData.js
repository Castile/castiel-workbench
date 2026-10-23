export const initialMembers = [
  {id:'li',name:'小李',role:'后端开发',skills:'支付、接口、数据库',capacity:40,absence:8,projects:['payments']},
  {id:'lin',name:'小林',role:'前端开发',skills:'交互、表单、可视化',capacity:40,absence:8,projects:['admin']},
  {id:'chen',name:'小陈',role:'测试工程师',skills:'回归、自动化测试',capacity:40,absence:12,projects:['payments']},
  {id:'me',name:'我',role:'团队 PL',skills:'需求、交付、跨项目协调',capacity:40,absence:12,projects:['payments','admin']},
];
export const initialProjects=[
  {id:'payments',name:'支付平台',goal:'提升支付回调稳定性，完善对账与回归验证。',milestone:'支付稳定性优化',due:'2026-10-30',color:'blue'},
  {id:'admin',name:'管理后台',goal:'交付新管理端表单，完成需求评审与联调。',milestone:'管理端体验优化',due:'2026-11-06',color:'violet'},
  {id:'personal',name:'个人收件箱',goal:'尚未归入项目的个人工作与日常待办。',milestone:'整理本周工作',due:'2026-10-30',color:'gray'},
];
const details={callback:{owner:'li',effort:20,projectId:'payments',priority:'高',due:'2026-10-23'},reconcile:{owner:'li',effort:14,projectId:'payments',priority:'中',due:'2026-10-21'},report:{owner:'me',effort:4,projectId:'payments',priority:'中',due:'2026-10-23'}};
export function enrichTasks(tasks){return tasks.map(t=>({...t,week:0,ruleVersion:'v1.2',...details[t.id]}));}
export function makeTask(title,extra={}){return {id:crypto.randomUUID(),title,status:'待规划',agent:'Codex',model:'system',date:'10-23',owner:'me',effort:null,week:0,projectId:'personal',priority:'中',due:'2026-10-23',ruleVersion:'v1.2',messages:[],context:['等待规划与执行。','按任务范围选择资料。','尚未记录排除路径。','明确验收目标并开始执行。'],...extra};}
export function extraTasks(){return [makeTask('日志补充',{id:'logs',owner:'li',effort:4,projectId:'payments',status:'已排队'}),makeTask('管理端表单',{id:'form',owner:'lin',effort:24,projectId:'admin',status:'执行中',agent:'Claude'}),makeTask('回归测试',{id:'test',owner:'chen',effort:20,projectId:'payments',status:'待规划'}),makeTask('下周需求评审',{id:'review',owner:'me',effort:18,projectId:'admin',status:'待规划',agent:'Gemini'})];}
export function loadFor(tasks,member,week=0,projectId='all'){
 const all=tasks.filter(t=>t.owner===member.id&&(t.week??0)===week&&t.status!=='已取消');
 const scoped=all.filter(t=>projectId==='all'||t.projectId===projectId);
 const sum=ts=>ts.reduce((n,t)=>n+(typeof t.effort==='number'?t.effort:0),0);
 const capacity=Math.max(0,member.capacity-member.absence),hours=sum(all);
 return {hours,scoped:sum(scoped),capacity,unestimated:all.filter(t=>t.effort==null).length,ratio:capacity>0?hours/capacity:null,excess:Math.max(0,hours-capacity),tasks:scoped};
}
export function parseDaily(text,projects,members,ruleVersion){
 return text.split(/[，,；;\n]+|然后|并且/).map(s=>s.trim()).filter(Boolean).map(title=>makeTask(title,{owner:members.find(m=>m.id!=='me'&&title.includes(m.name))?.id||'me',projectId:projects.find(p=>p.id!=='personal'&&title.includes(p.name))?.id||(title.includes('支付')?'payments':'personal'),agent:/周报|文档|调研|整理/.test(title)?'Gemini':'Codex',ruleVersion}));
}
export const statusTone=s=>s==='已完成'?'green':['已阻塞','待确认'].includes(s)?'orange':['执行中','验证中','待验收'].includes(s)?'blue':'gray';
