import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";
import { loadPersistence, PersistenceProvider, StorageStatus, StorageLoadError } from './state/Persistence.jsx';
import './state/storage.css';

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
    root.render(<React.StrictMode><PersistenceProvider engine={engine}><StorageStatus/><div inert={engine.recovered}><App/></div></PersistenceProvider></React.StrictMode>);
  } catch (error) { root.render(<StorageLoadError error={error.message} onRetry={start}/>); }
}
start();
