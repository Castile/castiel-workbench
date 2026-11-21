import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const modelName = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-[\]]{0,199}$/.test(value) ? value : '';
export { modelName };

export async function readJSON(file) {
  try { if ((await fs.stat(file)).size > 2 * 1024 * 1024) throw new Error('配置文件过大'); return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw new Error('无法读取配置：' + file); }
}
export async function command(executable, args, env, timeout = 10000) {
  const { stdout } = await execute(executable, args, { env, timeout, maxBuffer: 2 * 1024 * 1024, windowsHide: true }); return stdout;
}
export async function desktopEnvironment(base = process.env, home = os.homedir()) {
  let env = { ...base };
  // Finder has a small PATH. Read the user's login shell environment in memory only.
  if (process.platform === 'darwin') {
    const shell = ['/bin/zsh', '/bin/bash'].includes(base.SHELL) ? base.SHELL : '/bin/zsh';
    try {
      const output = await command(shell, ['-ilc', "printf '\\0CASTIEL_ENV_START\\0'; /usr/bin/env -0"], base, 4000);
      const marker = '\0CASTIEL_ENV_START\0', start = output.lastIndexOf(marker);
      if (start >= 0) for (const item of output.slice(start + marker.length).split('\0')) {
        const at = item.indexOf('='); if (at > 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(item.slice(0, at))) env[item.slice(0, at)] = item.slice(at + 1);
      }
    } catch { /* Fall back to inherited environment and standard install locations. */ }
  }
  if (process.platform === 'win32') {
    const pathKey = Object.keys(env).find(key => key.toUpperCase() === 'PATH');
    const inherited = env[pathKey] || '';
    if (pathKey && pathKey !== 'PATH') delete env[pathKey];
    env.PATH = [inherited, path.join(home, '.local', 'bin')].filter(Boolean).join(path.delimiter);
  } else env.PATH = [...new Set([...(env.PATH || '').split(path.delimiter), path.join(home, '.local/bin'), path.join(home, '.npm-global/bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'].filter(Boolean))].join(path.delimiter);
  // Do not leak the host application's JS loader or nest inside a Claude session.
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS; delete env.CLAUDECODE; delete env.CLAUDE_CODE_ENTRYPOINT;
  return env;
}
export async function findCLI(name, env, home = os.homedir()) {
  const candidates = (env.PATH || '').split(path.delimiter).filter(Boolean).map(dir => path.join(dir, process.platform === 'win32' ? name + '.exe' : name));
  if (name === 'codex' && process.platform === 'win32') {
    const target = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
    for (const dir of (env.PATH || '').split(path.delimiter).filter(Boolean)) {
      const pkg = path.join(dir, 'node_modules', '@openai', 'codex');
      const binary = path.join('vendor', target + '-pc-windows-msvc', 'codex', 'codex.exe');
      candidates.push(path.join(pkg, binary), path.join(pkg, 'node_modules', '@openai', 'codex-win32-' + process.arch, binary));
    }
  }
  if (name === 'codex' && process.platform === 'darwin') candidates.push('/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex', '/Applications/Codex.app/Contents/Resources/codex');
  if (name === 'claude' && process.platform !== 'win32') candidates.push(path.join(home, '.local/bin/claude'));
  for (const candidate of candidates) { try { await fs.access(candidate, 0o1); if ((await fs.stat(candidate)).isFile()) return candidate; } catch {} }
  return null;
}
const effortName = value => typeof value === 'string' && /^(none|minimal|low|medium|high|xhigh|max|ultra)$/.test(value) ? value : null;
function optionHelp(help, flag) {
  const lines = String(help || '').split('\n'), at = lines.findIndex(line => line.trimStart().startsWith(flag + ' '));
  if (at < 0) return '';
  const next = lines.findIndex((line, i) => i > at && /^\s*--?[a-z]/.test(line));
  return lines.slice(at, next < 0 ? undefined : next).join(' ');
}
function schemaValues(schema, value) {
  if (!value) return [];
  if (value.$ref?.startsWith('#/definitions/')) return schemaValues(schema, schema.definitions?.[value.$ref.split('/').at(-1)]);
  return value.enum || (value.anyOf || value.oneOf || []).flatMap(part => schemaValues(schema, part));
}
export async function codexTurnSchema(executable, env) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'castiel-codex-capabilities-'));
  try {
    await command(executable, ['app-server', 'generate-json-schema', '--out', directory], env, 10000);
    return await readJSON(path.join(directory, 'v2', 'TurnStartParams.json'));
  } catch { return {}; }
  finally { await fs.rm(directory, { recursive: true, force: true }); }
}
export function codexSummary(config, models, schema = {}) {
  const configuredModel = modelName(config.model) || null;
  const reasoningEfforts = Object.fromEntries(models.filter(m => modelName(m.model)).map(m => [m.model, [...new Set((m.supportedReasoningEfforts || []).map(option => effortName(option.reasoningEffort)).filter(Boolean))]]));
  const defaultReasoningEfforts = Object.fromEntries(models.filter(m => modelName(m.model) && effortName(m.defaultReasoningEffort)).map(m => [m.model, m.defaultReasoningEffort]));
  const reviewers = schemaValues(schema, schema.properties?.approvalsReviewer);
  return { configuredModel, configuredReasoningEffort: effortName(config.model_reasoning_effort), configuredApprovalsReviewer: ['user', 'auto_review'].includes(config.approvals_reviewer) ? config.approvals_reviewer : config.approvals_reviewer === 'guardian_subagent' ? 'auto_review' : 'user', reasoningEfforts, defaultReasoningEfforts,
    capabilities: { effort: Boolean(schema.properties?.effort), reviewer: reviewers.includes('user'), autoReview: reviewers.includes('auto_review') } };
}
export function claudeSummary(settings, env, auth = {}, help = '') {
  const effective = { ...env, ...settings.env };
  const configured = modelName(settings.model) || modelName(effective.ANTHROPIC_MODEL);
  const models = new Map([['system', ['system', configured ? '本机默认 · ' + configured : '本机默认', '沿用 Claude Code 的配置']]]);
  for (const [key, label] of [['ANTHROPIC_MODEL', '配置模型'], ['ANTHROPIC_DEFAULT_SONNET_MODEL', 'Sonnet 配置'], ['ANTHROPIC_DEFAULT_OPUS_MODEL', 'Opus 配置'], ['ANTHROPIC_DEFAULT_HAIKU_MODEL', 'Haiku 配置']]) {
    const value = modelName(effective[key]); if (value) models.set(value, [value, value, label + '；实际访问权限由服务端确认']);
  }
  if (configured) models.set(configured, [configured, configured, '本机配置模型']);
  const hasCredential = Boolean(auth.loggedIn || effective.ANTHROPIC_API_KEY || effective.ANTHROPIC_AUTH_TOKEN || settings.apiKeyHelper || effective.CLAUDE_CODE_USE_BEDROCK || effective.CLAUDE_CODE_USE_VERTEX || effective.CLAUDE_CODE_USE_FOUNDRY);
  const effortHelp = optionHelp(help, '--effort'), permissionHelp = optionHelp(help, '--permission-mode');
  const effortChoices = effortHelp.match(/\((?:choices:\s*)?((?:"?(?:none|minimal|low|medium|high|xhigh|max|ultra)"?[\s,]*)+)\)/)?.[1] || '';
  const efforts = [...new Set((effortChoices.match(/\b(?:none|minimal|low|medium|high|xhigh|max|ultra)\b/g) || []))];
  const permissionChoices = permissionHelp.match(/\(choices:\s*([^)]*)\)/)?.[1] || '';
  const permissionModes = ['manual', 'acceptEdits', 'auto', 'plan'].filter(mode => new RegExp('(?:"|\\b)' + mode + '(?:"|\\b)').test(permissionChoices));
  return { configuredModel: configured || null, models: [...models.values()], authenticated: hasCredential, provider: effective.ANTHROPIC_BASE_URL ? '本机自定义服务' : auth.apiProvider || '本机默认服务', authLabel: hasCredential ? '沿用本机认证' : '未检测到认证，请先在 Claude Code 登录',
    configuredReasoningEffort: effortName(effective.CLAUDE_CODE_EFFORT_LEVEL) || effortName(settings.effortLevel), configuredPermissionMode: ['manual', 'acceptEdits', 'auto', 'plan'].includes(settings.permissions?.defaultMode) ? settings.permissions.defaultMode : null,
    reasoningEfforts: efforts.length ? { '*': efforts } : {}, capabilities: { effort: Boolean(effortHelp && efforts.length), autoReview: false, permissionModes } };
}
export function redactError(text, env = {}) {
  let result = String(text || '工具运行失败');
  for (const [key, value] of Object.entries(env)) if (/(TOKEN|KEY|SECRET|PASSWORD)/i.test(key) && typeof value === 'string' && value.length >= 6) result = result.split(value).join('[已隐藏凭据]');
  return result.replace(/\b(?:sk-[\w-]{8,}|Bearer\s+[A-Za-z0-9._~+/-]{8,})/g, '[已隐藏凭据]').slice(0, 1400);
}
