export function visibleMembers(members, query, scope) {
  const needle = query.trim().toLocaleLowerCase();
  return members.filter(member => {
    if (scope === 'archived' && !member.archived || scope === 'active' && member.archived) return false;
    return [member.name, member.role, member.skills].join(' ').toLocaleLowerCase().includes(needle);
  });
}

export function archivePreview(tasks, memberId, items = []) {
  const open = task => !['已完成', '已取消', '已关闭', '已验收'].includes(task.status);
  return {
    transfer: [...tasks, ...items.filter(item => !item.sourceId)].filter(task => open(task) && task.owner === memberId),
    external: [...tasks, ...items].filter(task => open(task) && task.sourceId && task.sourceOwner === memberId)
  };
}

export function transferPatch(task, owner) {
  return task.sourceId ? {owner, ownerOverride:true} : {owner};
}

export function cleanEvent(draft, today) {
  if (!draft.date || !draft.memberIds?.length || !draft.facts?.trim()) throw new Error('请填写参与成员、日期和事实。');
  if (draft.type === 'black' && draft.closed && !draft.correction?.trim()) throw new Error('请先填写纠正结果，再结案。');
  const event = {...draft, facts:draft.facts.trim(), title:draft.title?.trim() || Array.from(draft.facts.trim().split('\n')[0]).slice(0,40).join('')};
  event.contributions = Object.fromEntries(event.memberIds.map(id => [id, draft.contributions?.[id]?.trim() || '']));
  event.closedAt = event.closed ? event.closedAt || today : '';
  if (event.type === 'black') delete event.praise;
  return event;
}

const maxThumbnailLength = 40 * 1024;
export function validAvatar(data) {
  return typeof data === 'string' && data.length <= maxThumbnailLength && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(data);
}
export function validateAvatarFile(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file?.type)) throw new Error('请选择 JPG、PNG 或 WebP 格式的本机图片。');
  if (file.size > 5 * 1024 * 1024) throw new Error('原图超过 5 MB，请缩小后重试。');
}
export async function thumbnail(file) {
  validateAvatarFile(file);
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 160;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0,0,160,160);
    const side = Math.min(image.width,image.height);
    context.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,160,160);
    const result = canvas.toDataURL('image/jpeg',0.76);
    if (!validAvatar(result)) throw new Error('缩略图超过容量限制，请选择另一张图片。');
    return result;
  } finally {
    image.close();
  }
}

// Explicitly build the data that can cross into a shared image.
export function publicPoster(event, draft, members) {
  if (event.type !== 'red') throw new Error('仅红事件可生成表扬海报。');
  const people = members.filter(m => event.memberIds.includes(m.id) && draft.memberIds.includes(m.id))
    .map(m => ({name:m.name, avatar:validAvatar(m.avatar) ? m.avatar : ''}));
  if (!people.length) throw new Error('请至少选择一位参与成员。');
  if (!draft.title?.trim() || !draft.text?.trim()) throw new Error('请填写公开标题和表扬文案。');
  return {title:draft.title.trim(), text:draft.text.trim(), people};
}

export function posterLines(value, maxWidth, measure) {
  return value.split(/\r?\n/).flatMap(paragraph => {
    const lines = [];
    let line = '';
    for (const char of paragraph) {
      if (line && measure(line + char) > maxWidth) {
        lines.push(line);
        line = '';
      }
      line += char;
    }
    return [...lines,line];
  });
}

async function loadAvatar(src) {
  if (!src) return null;
  const image = new Image();
  image.src = src;
  try { await image.decode(); return image; } catch { return null; }
}

export async function drawPoster(poster) {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  const context = canvas.getContext('2d');
  const family = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  const wrap = (value,font,width) => {
    context.font = font + ' ' + family;
    return posterLines(value,width,s => context.measureText(s).width);
  };
  if (poster.title.length > 140 || poster.text.length > 1800 || poster.people.length > 24) throw new Error('海报内容过长，请缩短文案或减少成员。');
  const title = wrap(poster.title,'700 62px',764);
  const body = wrap(poster.text,'400 34px',764);
  const people = poster.people.map(p => ({...p, lines:wrap(p.name, '600 32px',636)}));
  const rosterHeight = people.reduce((height,p)=>height+Math.max(88,p.lines.length*42+16),0);
  const height = 228 + title.length*78 + body.length*54 + rosterHeight + 100;
  if (height > 2150) throw new Error('海报内容过长，请缩短文案或减少成员。');
  canvas.height = Math.max(720,height);
  const gradient = context.createLinearGradient(0,0,960,canvas.height);
  gradient.addColorStop(0,'#f9f3e8');
  gradient.addColorStop(1,'#f0e1c9');
  context.fillStyle = gradient;
  context.fillRect(0,0,960,canvas.height);
  context.strokeStyle = '#bd9b68';
  context.lineWidth = 2;
  context.strokeRect(35,35,890,canvas.height-70);
  context.fillStyle = '#914937';
  context.fillRect(97,98,62,7);
  const block = (lines,x,y,font,lineHeight,color) => {
    context.fillStyle=color;
    context.font=font+' '+family;
    context.textBaseline='top';
    for (const line of lines) { context.fillText(line,x,y); y+=lineHeight; }
    return y;
  };
  let y=block(title,96,142,'700 62px',78,'#46342d')+36;
  y=block(body,98,y,'400 34px',54,'#56493e')+48;
  context.fillStyle='#cab394';
  context.fillRect(98,y,764,1);
  y+=25;
  const images = await Promise.all(people.map(p=>loadAvatar(p.avatar)));
  people.forEach((person,i) => {
    context.save();
    context.beginPath();
    context.arc(134,y+36,36,0,2*Math.PI);
    context.clip();
    if (images[i]) context.drawImage(images[i],98,y,72,72);
    else {
      context.fillStyle='#e4c9ac'; context.fillRect(98,y,72,72);
      context.fillStyle='#6b4734'; context.font='600 28px '+family; context.textAlign='center'; context.textBaseline='middle';
      context.fillText(Array.from(person.name).slice(-2).join(''),134,y+36,62);
    }
    context.restore();
    block(person.lines,197,y+15,'600 32px',42,'#4b392f');
    y+=Math.max(88,person.lines.length*42+16);
  });
  return canvas.toDataURL('image/png');
}
