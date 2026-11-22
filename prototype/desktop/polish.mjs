import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { boundedText } from './company-sources.mjs';

const instructions = '你是中文文稿编辑。润色所给文稿，保留事实、引用、数字、人名及归因。参考材料仅作事实依据。仅返回润色后的正文。';

export function polishInput({text, evidence = ''}) {
  if (typeof text !== 'string' || !text.trim() || text.length > 18000 ||
      typeof evidence !== 'string' || evidence.length > 18000) throw new Error('文稿和参考材料各限 18000 字');
  return evidence.trim() ? '文稿\n'+text+'\n\n参考材料\n'+evidence : text;
}

// The CLI manages authentication. Its safe mode keeps user hooks, skills and plugins out of the editing request.
async function claudeText(tool, env, model, input, signal) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'castiel-polish-'));
  try {
    const args = ['-p','--safe-mode','--tools','','--strict-mcp-config','--disable-slash-commands',
      '--no-session-persistence','--output-format','json','--system-prompt',instructions];
    if (model) args.push('--model',model);
    return await new Promise((resolve,reject) => {
      const child = spawn(tool.executable,args,{cwd,env,signal,windowsHide:true,stdio:['pipe','pipe','ignore']});
      const chunks = [];
      let size = 0;
      child.on('error', () => reject(new Error('Claude 文稿请求已中止或无法启动')));
      child.stdout.on('data', chunk => {
        size += chunk.length;
        if (size > 512*1024) { child.kill(); reject(new Error('模型返回内容过长')); } else chunks.push(chunk);
      });
      child.on('close', code => {
        let result;
        try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* Older CLI or service failure. */ }
        if (code !== 0 || result?.is_error || !result?.result?.trim()) reject(new Error('Claude 润色失败，请检查本机 CLI 版本、登录和服务额度'));
        else resolve(result.result.trim());
      });
      child.stdin.on('error',()=>{});
      child.stdin.end(input);
    });
  } finally { await fs.rm(cwd,{recursive:true,force:true}); }
}

// Use a single Responses request with an empty tool list. Agent sessions can have
// workspace tools and MCP servers and are deliberately never used to polish personnel records.
export async function codexText(config, env, model, input, signal, request = fetch) {
  const name = config.model_provider || 'openai';
  const provider = config.model_providers?.[name] || {};
  const base = provider.base_url || (name === 'openai' ? (env.OPENAI_BASE_URL || 'https://api.openai.com/v1') : null);
  if (!base || (provider.wire_api && provider.wire_api !== 'responses')) throw new Error('当前 Codex 服务没有可用的 Responses 接口');
  const url = new URL(base.replace(/\/+$/,'')+'/responses');
  const loopback = ['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) || url.username || url.password) throw new Error('模型接口地址无效');
  if (!model) throw new Error('请在润色窗口选择具体模型');
  const token = env[provider.env_key || (name === 'openai' ? 'OPENAI_API_KEY' : '')];
  if (!token && (provider.env_key || name === 'openai' || provider.requires_openai_auth)) throw new Error('此 Codex 配置仅有 CLI 登录或缺少接口密钥。纯文本润色需要配置提供方的 API 环境变量，也可选择 Claude。');
  if (provider.auth || provider.aws || provider.credential_file || provider.gateway_oauth) throw new Error('此 Codex 认证方式暂不支持纯文本润色');
  const headers = {...provider.http_headers,'Content-Type':'application/json'};
  for (const [header,variable] of Object.entries(provider.env_http_headers || {})) if (env[variable]) headers[header] = env[variable];
  if (token) headers.Authorization = 'Bearer '+token;
  for (const [key,value] of Object.entries(provider.query_params || {})) url.searchParams.set(key,value);
  const response = await request(url,{method:'POST',headers,redirect:'error',signal,body:JSON.stringify({model,instructions,input,tools:[],tool_choice:'none',store:false})});
  if (!response.ok) { await response.body?.cancel(); throw new Error('模型服务返回 HTTP '+response.status+'，原稿已保留'); }
  const data = JSON.parse(await boundedText(response,512*1024));
  const output = data.output?.flatMap(item => item.type === 'message' ? item.content || [] : []).filter(part=>part.type === 'output_text').map(part=>part.text).join('\n').trim();
  if (!output) throw new Error('模型没有返回润色正文');
  return output;
}

export async function polish(runtime, data, args, signal) {
  const input = polishInput(args);
  const {agent, model = 'system'} = args;
  const tool = runtime.catalog.agents[agent];
  if (!['Claude','Codex'].includes(agent) || !tool?.installed || data.agentConfig?.[agent]?.enabled === false) throw new Error('请先安装并启用所选 Agent');
  if (model !== 'system' && !tool.models?.some(row=>row[0]===model)) throw new Error('请选择已检测的模型');
  const target = model === 'system' ? tool.configuredModel : model;
  if (agent === 'Claude') return claudeText(tool,runtime.env,target,input,signal);
  if (!runtime.rpc) throw new Error('本机 Codex 尚未连接');
  const {config} = await runtime.rpc.request('config/read',{includeLayers:false});
  return codexText(config,runtime.env,target,input,signal);
}
