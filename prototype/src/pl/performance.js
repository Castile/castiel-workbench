import { todayISO } from '../workspaceData.js';

export const stages = ['目标制定', '中期审视', '绩效评价', '结果沟通'];
export const periods = {H1:'上半年', H2:'下半年', Y:'全年'};

export function defaultPeriod(date = new Date()) {
  return date.getMonth() < 6 ? 'H1' : 'H2';
}

export function periodRange(year, period) {
  return {start: year + (period === 'H2' ? '-07-01' : '-01-01'), end: year + (period === 'H1' ? '-06-30' : '-12-31')};
}

export function dueFollowUps(coaching, events, today = todayISO()) {
  const rows = [];
  for (const c of coaching) {
    if (!c.completed && c.followUpDate && c.followUpDate <= today) {
      rows.push({kind:'coaching', id:c.id, memberId:c.memberId, title:c.topic || '1:1 沟通', date:c.followUpDate});
    }
  }
  for (const e of events) {
    if (e.type === 'black' && !e.closed && e.memberIds?.length && e.followUpDate && e.followUpDate <= today) {
      rows.push({kind:'event', id:e.id, memberId:e.memberIds[0], title:e.title || '事件复核', date:e.followUpDate});
    }
  }
  return rows.sort((a,b)=>a.date.localeCompare(b.date)).map(row=>({...row, overdue:row.date < today}));
}

export function closeFollowUp(record, today, nextDate) {
  if (!record.result?.trim()) throw new Error('请先填写本次跟进结果');
  if (nextDate && nextDate <= today) throw new Error('下次跟进日期须晚于本次完成日期');
  return {...record, history:[...(record.history || []), {due:record.followUpDate || '', date:today, result:record.result.trim()}],
    followUpDate:nextDate, completed:!nextDate, result:'', nextDate:''};
}

const agreement = goal => ({title:goal.title, measure:goal.measure || '', expected:goal.expected || '', agreed:goal.agreed || '待双方确认'});

export function amendGoal(goal, changes, reason, date = todayISO()) {
  if (!changes.title?.trim() || !reason?.trim()) throw new Error('请填写调整后的目标和调整原因');
  return {...goal, ...changes, agreed:'待双方确认', adjustment:null, amendments:[...(goal.amendments || []),
    {date, previous:agreement(goal), reason:reason.trim()}]};
}

export function confirmStage(review, goals, stage, date = todayISO()) {
  const {versions, ...fields} = review;
  return {...review, stage:Math.max(review.stage || 0, Math.min(stage+1, 3)), versions:[...(versions || []),
    {date, stage, review:structuredClone(fields), goals:structuredClone(goals)}]};
}

function inRange(date, start, end) {
  return (!date || !start || date >= start) && (!date || !end || date <= end);
}

export function evidenceChoices({goals=[], events=[], tasks=[], workItems=[], memberId, start, end, self=false}) {
  const rows = [];
  for (const e of events) {
    const people = e.memberIds || [];
    if ((!self && !people.includes(memberId)) || !inRange(e.date, start, end)) continue;
    rows.push({key:'event:'+e.id, label:'事迹', title:e.title || '未命名事迹', date:e.date || '',
      detail:[e.facts,e.outcome,e.impact].filter(Boolean).join('；'), team:people.some(id=>id !== 'me')});
  }
  for (const [kind, records] of [['task', tasks], ['work', workItems]]) {
    for (const record of records) {
      const owner = record.owner;
      if ((!self && owner !== memberId) || !inRange(record.due, start, end)) continue;
      rows.push({key:kind+':'+record.id, label:kind === 'task' ? '任务' : '工作项', title:record.title,
        date:record.due || '', detail:record.status || '', team:owner !== 'me'});
    }
  }
  if (self) {
    for (const goal of goals) {
      if (goal.memberId !== memberId || (goal.end && goal.end < start) || (goal.start && goal.start > end)) continue;
      rows.push({key:'goal:'+goal.id, label:'目标', title:goal.title, date:'', detail:goal.expected || '', team:false});
    }
  }
  return rows;
}

export function annualMaterials(annual, reviews) {
  const combined = new Map((annual.evidence || []).map(e=>[e.key, e]));
  for (const r of reviews) {
    if (r.kind !== 'self' || r.memberId !== annual.memberId || r.year !== annual.year || !['H1','H2'].includes(r.period)) continue;
    if (r.end < annual.start || r.start > annual.end) continue;
    for (const e of r.evidence || []) {
      if (!combined.has(e.key) && inRange(e.date, annual.start, annual.end)) combined.set(e.key, {...e});
    }
  }
  return [...combined.values()];
}

export function needsContribution(e) {
  return Boolean(e.team && !e.contribution?.trim());
}

export function buildSelfDraft(review) {
  const evidence = review.evidence || [];
  if (evidence.some(needsContribution)) throw new Error('请为所选团队成果填写自己的实际贡献');
  const named = evidence.map((e,i)=>({...e, mark:'〔'+(i+1)+'〕'}));
  const section = (title, lines) => [title, ...lines.filter(Boolean)].join('\n');
  return [
    section('我的动作', [review.actions,...named.filter(e=>e.contribution).map(e=>e.mark+e.contribution)]),
    section('交付结果', [review.results,...named.map(e=>e.mark+e.title+(e.detail?' · '+e.detail:''))]),
    section('对团队的影响', [review.impact]),
    section('下一步改进', [review.improvement]),
    named.length ? section('引用材料', named.map(e=>e.mark+[e.date,e.label,e.title].filter(Boolean).join(' · '))) : ''
  ].filter(Boolean).join('\n\n');
}
