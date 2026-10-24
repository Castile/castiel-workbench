import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";
import { loadPersistence, PersistenceProvider, StorageStatus, StorageLoadError } from './state/Persistence.jsx';
import './state/storage.css';
import { AgentsProvider } from './state/Agents';

const root = createRoot(document.getElementById('root'));
let engine;
window.castielDesktop?.onFlushRequest(async token => {
  await new Promise(resolve => setTimeout(resolve, 0));
  try { if (!engine?.recovered) await engine?.flush(); await window.castielDesktop.completeClose(token, true); }
  catch { await window.castielDesktop.completeClose(token, false); }
});
async function start() {
  try {
    engine = await loadPersistence();
    root.render(<React.StrictMode><PersistenceProvider engine={engine}><AgentsProvider><StorageStatus/><div inert={engine.recovered}><App/></div></AgentsProvider></PersistenceProvider></React.StrictMode>);
  } catch (error) { root.render(<StorageLoadError error={error.message} onRetry={start}/>); }
}
start();
