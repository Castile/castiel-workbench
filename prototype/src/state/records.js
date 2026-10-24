const sessionKeys = ['title','agent','model','workspaceId','workspaceSnapshot','agentSettingsSnapshot','ruleVersion','messages','context','sessionArchived','date','status','runtime'];
const pick = (value, keys) => Object.fromEntries(keys.filter(k => value[k] !== undefined).map(k => [k, value[k]]));
export function pendingRun(row, id) {
  const previous=row.runtime?.agent===row.agent&&row.runtime.status!=='handedOff'?row.runtime:{};
  return {...previous,id,sessionId:row.id,agent:row.agent,status:'starting',text:'',events:[],error:'',startedAt:new Date().toISOString()};
}
export function seedRecords(rows) {
  return { tasks: rows.map(({ messages, ...task }) => task), sessions: rows.filter(r => r.messages?.length).map(r => ({ ...pick(r, sessionKeys), id: 'session-' + r.id, taskId: r.id })) };
}
export function presentRecords(records) {
  const linked = new Map(records.sessions.filter(s => s.taskId).map(s => [s.taskId, s]));
  return [
    ...records.tasks.map(t => { const s = linked.get(t.id); return { ...t, ...s, id: t.id, taskTitle: t.title, title: s?.title || t.title, sessionId: s?.id, sessionKind: 'task', messages: s?.messages || [] }; }),
    ...records.sessions.filter(s => !s.taskId).map(s => ({ owner: 'me', projectId: null, effort: null, priority: '中', context: ['', '', '', ''], ...s, sessionId: s.id, sessionKind: 'agent' }))
  ];
}
export function addRecords(records, rows) {
  const next = { tasks: [...records.tasks], sessions: [...records.sessions] };
  for (const row of rows) {
    if (row.sessionKind === 'agent') next.sessions.push({ ...pick(row, sessionKeys), id: row.id, taskId: null });
    else {
      const { messages, sessionKind, ...task } = row; next.tasks.push(task);
      if (messages?.length) next.sessions.push({ ...pick(row, sessionKeys), id: crypto.randomUUID(), taskId: row.id });
    }
  }
  return next;
}
export function updateRecord(records, id, update, sessionOnly = false) {
  const row = presentRecords(records).find(r => r.id === id); if (!row) return records;
  const result = update(row), patch = Object.fromEntries(Object.entries(result).filter(([k, v]) => !Object.is(v, row[k])));
  const standalone = row.sessionKind === 'agent';
  let sessions = records.sessions;
  const relevant = pick(patch, sessionKeys);
  if (Object.keys(relevant).length) {
    const existing = sessions.find(s => s.id === row.sessionId);
    if (existing) sessions = sessions.map(s => s.id === existing.id ? { ...s, ...relevant } : s);
    else if (relevant.messages?.length) sessions = [...sessions, { ...pick(row, sessionKeys), ...relevant, id: crypto.randomUUID(), taskId: id }];
  }
  const tasks = standalone || sessionOnly ? records.tasks : records.tasks.map(t => t.id === id ? { ...t, ...Object.fromEntries(Object.entries(patch).filter(([k]) => !['messages','sessionArchived','sessionId','sessionKind','taskTitle','taskId'].includes(k))) } : t);
  return { tasks, sessions };
}
