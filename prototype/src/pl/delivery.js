import { makeTask } from '../workspaceData.js';

export const types = { requirement:'需求', issue:'问题单', task:'任务' };
export const statuses = ['待规划','已排队','执行中','已阻塞','待确认','已暂停','验证中','待验收','已完成','已取消'];
export const fieldNames = {externalId:'远端 ID',entityType:'类型',title:'标题',owner:'负责人',status:'状态',due:'截止日',url:'详情链接',criteria:'验收条件',severity:'严重程度',effort:'估算工时'};
export const defaultFields = { externalId:'id', entityType:'type', title:'title', owner:'owner', status:'status', due:'due', url:'url', criteria:'criteria', severity:'severity', effort:'effort' };
export const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_ROWS = 2000;

function lookup(row, path) {
  if (!path) return undefined;
  if (Object.hasOwn(row,path)) return row[path];
  return path.split('.').reduce((value,key) => value && typeof value==='object' && Object.hasOwn(value,key) ? value[key] : undefined,row);
}

function csvRows(text) {
  let row=[],field='',quoted=false,closed=false;
  const lines=[];
  function finishRow() {
    row.push(field);
    if(row.some(cell=>cell.trim())) lines.push(row);
    if(lines.length>MAX_ROWS+1) throw new Error('每次最多导入 2000 条工作项');
    row=[];field='';closed=false;
  }
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(quoted) {
      if(ch!=='"') field+=ch;
      else if(text[i+1]==='"') {field+='"';i++;}
      else {quoted=false;closed=true;}
    } else if(ch===',') {row.push(field);field='';closed=false;}
    else if(ch==='\n'||ch==='\r') {if(ch==='\r'&&text[i+1]==='\n')i++;finishRow();}
    else if(ch==='"'&&!field&&!closed) quoted=true;
    else if(ch==='"'||closed) throw new Error('CSV 引号格式有误');
    else field+=ch;
  }
  if(quoted) throw new Error('CSV 引号尚未闭合');
  finishRow();
  const headers=(lines.shift()||[]).map(value=>value.trim());
  if(headers.length>100 || headers.some(value=>!value) || new Set(headers).size!==headers.length) throw new Error('CSV 表头重复、为空或超过 100 列');
  return lines.map((cells,index)=>{
    if(cells.length!==headers.length) throw new Error('CSV 第 '+(index+2)+' 行列数与表头不符');
    return Object.fromEntries(headers.map((header,i)=>[header,cells[i]]));
  });
}

export function parseFeed(input,path='') {
  const text=(typeof input==='string'?input:JSON.stringify(input))?.trim();
  if(!text) throw new Error('请输入 CSV 或 JSON 数据');
  if(new TextEncoder().encode(text).length>MAX_IMPORT_BYTES) throw new Error('每次导入最多 1 MB');
  let rows;
  if(/^[{\[]/.test(text) || typeof input!=='string') {
    let data;
    try { data=typeof input==='string'?JSON.parse(text):input; } catch { throw new Error('JSON 格式有误，请检查括号和引号'); }
    rows=path && data && typeof data==='object'?lookup(data,path):data;
  } else rows=csvRows(text);
  if(!Array.isArray(rows) || rows.some(row=>!row||typeof row!=='object'||Array.isArray(row))) throw new Error('需要工作项对象数组，请检查 JSON 列表路径');
  if(!rows.length || rows.length>MAX_ROWS) throw new Error('每次导入需要 1 至 2000 条工作项');
  return rows;
}

export function safeItemUrl(value) {
  try { const url=new URL(value); return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:''; } catch { return ''; }
}

function indexByKey(records) {
  const index=new Map();
  for(const record of records) {
    if(!record.sourceId||!record.externalId) continue;
    const key=JSON.stringify([record.sourceId,record.entityType,record.externalId]);
    index.set(key,index.has(key)?null:record);
  }
  return index;
}

function mappedOwner(raw,people,mapping) {
  if(!raw) return '';
  if(mapping.has(raw)) return people.find(person=>person.id===mapping.get(raw))?.id || '';
  const byId=people.find(person=>person.id===raw);
  if(byId) return byId.id;
  const matches=people.filter(person=>person.name===raw);
  return matches.length===1?matches[0].id:'';
}

function validDate(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date=new Date(value+'T00:00:00Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}

export function previewImport({rows,source,members,tasks,items}) {
  const fields={...defaultFields,...source.fields};
  const entityMap=new Map([...Object.entries(types).flatMap(([key,label])=>[[key,key],[label,key]]),...(source.entityMap||[])]);
  const statusMap=new Map([...statuses.map(value=>[value,value]),...(source.statusMap||[])]);
  const personMap=new Map(source.personMap||[]);
  const people=members.filter(person=>!person.archived);
  const existing=indexByKey([...items,...tasks]);
  const seen=new Set(), duplicates=new Set();
  const prepared=rows.map(row=>{
    const invalid=[];
    const values=Object.fromEntries(Object.entries(fields).map(([name,path])=>{
      const value=lookup(row,path);
      if(value!=null && !['string','number'].includes(typeof value)) invalid.push(fieldNames[name]);
      return [name,value==null?'':String(value).trim()];
    }));
    const entityType=entityMap.get(values.entityType)||(!values.entityType?source.defaultType:'');
    const key=JSON.stringify([source.id,entityType,values.externalId]);
    if(seen.has(key)) duplicates.add(key);
    seen.add(key);
    return {values,entityType,key,invalid};
  });
  return prepared.map(({values:v,entityType,key,invalid})=>{
    const {externalId,title}=v;
    const current=existing.get(key);
    const status=v.status?statusMap.get(v.status):'待规划';
    const sourceOwner=mappedOwner(v.owner,people,personMap);
    const unmatched=!!v.owner&&!sourceOwner;
    const reasons=[];
    if(!externalId || !title) reasons.push('缺少远端 ID 或标题');
    if(!Object.hasOwn(types,entityType)) reasons.push('类型尚未映射');
    if(duplicates.has(key)||current===null) reasons.push('标识重复');
    if(!statuses.includes(status)) reasons.push('状态尚未映射');
    if(v.due&&!validDate(v.due)) reasons.push('日期须为有效的 YYYY-MM-DD');
    if(v.url&&!safeItemUrl(v.url)) reasons.push('详情链接无效');
    if(entityType==='task'&&v.effort && (!Number.isFinite(Number(v.effort))||Number(v.effort)<0)) reasons.push('工时无效');
    if(invalid.length) reasons.push(invalid.join('、')+'需要映射到文本或数字');
    if(reasons.length) return {action:'conflict',title,externalId,entityType,reasons,unmatched};

    const base=current || (entityType==='task'?makeTask(title,{week:null,effort:v.effort===''?null:Number(v.effort)}):{id:crypto.randomUUID()});
    const record={...base,title,externalId,entityType,status,due:v.due,url:v.url,rawStatus:v.status,
      projectId:source.projectId,sourceId:source.id,sourceOwner,rawOwner:v.owner,
      owner:base.ownerOverride?base.owner:sourceOwner};
    if(entityType==='task') {
      delete record.messages;
      const changedOwner=current && (current.rawOwner!==v.owner||current.sourceOwner!==sourceOwner);
      if(changedOwner&&(current.ownerOverride||current.week!=null||current.scheduledWeekStart)) record.needsPlanReview=true;
    }
    if(entityType==='requirement') record.criteria=v.criteria;
    if(entityType==='issue') record.severity=v.severity;
    return {action:current?'update':'create',title,externalId,entityType,record,unmatched,reasons};
  });
}

export function applyPreview(items,preview) {
  const nextItems=new Map(items.map(item=>[item.id,item]));
  const tasks=[];
  for(const {record} of preview) {
    if(!record) continue;
    if(record.entityType==='task') tasks.push(record);
    else nextItems.set(record.id,record);
  }
  return {items:[...nextItems.values()],tasks};
}
