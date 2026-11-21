import { createServer } from 'vite';

export async function loadRuntimeUI(t) {
  const server = await createServer({ root: new URL('../', import.meta.url).pathname, configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, preTransformRequests: false }, appType: 'custom' });
  t.after(() => server.close());
  return { ...await server.ssrLoadModule('/src/state/Agents.jsx'), ...await server.ssrLoadModule('/src/chat/Conversation.jsx') };
}
