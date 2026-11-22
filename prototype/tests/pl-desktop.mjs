import { _electron as electron } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


const root = fileURLToPath(new URL('../',import.meta.url));
const directory = await fs.mkdtemp(path.join(os.tmpdir(),'castiel-team-smoke-'));
const errors=[];
let app;
async function launch() {
  app=await electron.launch({executablePath:process.argv[2] ? path.resolve(process.argv[2]) : (await import('electron')).default,args:process.argv[2]?[]:[path.join(root,'desktop/main.mjs')],env:{...process.env,CASTIEL_DATA_DIR:directory}});
  const page=await app.firstWindow();
  page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'团队',exact:true}).click();
  return page;
}
try {
  let page=await launch();
  await page.getByRole('button',{name:'添加成员'}).click();
  await page.getByLabel('姓名',{exact:true}).fill('验证成员');
  await page.getByLabel('角色',{exact:true}).fill('测试');
  await page.getByRole('button',{name:'保存成员'}).click();
  await page.getByRole('button',{name:'记事迹',exact:true}).click();
  await page.getByLabel('事实经过').fill('内部仅用于核验的事迹');
  await page.getByLabel('海报公开标题').fill('发布质量贡献');
  await page.getByLabel('可公开的贡献与影响').fill('感谢提前验证兼容性');
  await page.getByRole('button',{name:'保存事迹'}).click();
  await page.getByRole('button',{name:'生成海报'}).click();
  const download = page.getByRole('link',{name:'导出 PNG'});
  await download.waitFor();
  const encoded = await download.getAttribute('href');
  assert.match(encoded,/^data:image\/png;base64,iVBOR/);
  assert.equal(encoded,await page.getByAltText('将导出的表扬海报').getAttribute('src'));
  await page.getByRole('button',{name:'完成',exact:true}).click();
  await page.getByRole('button',{name:'记事迹',exact:true}).click();
  await page.getByLabel('事件属性').selectOption('black');
  await page.getByLabel('事迹标题').fill('复核发布检查');
  await page.getByLabel('事实经过').fill('脱敏验证记录');
  await page.getByLabel(/复核日期/).fill('2025-01-01');
  await page.getByRole('button',{name:'保存事迹'}).click();
  await page.getByRole('button',{name:'关闭窗口'}).click();
  await page.getByRole('tab',{name:'项目交付'}).click();
  await page.getByRole('button',{name:'新建工作项'}).waitFor();
  await page.getByText('已保存到本机',{exact:true}).waitFor();
  await app.close();
  page=await launch();
  await page.getByRole('button',{name:/验证成员/}).waitFor();
  await page.getByRole('button',{name:'今日',exact:true}).click();
  await page.getByRole('button',{name:/复核发布检查/}).click();
  assert.equal(await page.getByLabel('事实经过').inputValue(),'脱敏验证记录');
  assert.deepEqual(errors,[]);
  console.log('Desktop team workflow passed: member, event, project entry, restart and follow-up.');
} finally {await app?.close().catch(()=>{});await fs.rm(directory,{recursive:true,force:true});}
