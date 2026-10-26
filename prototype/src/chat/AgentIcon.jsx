import React from 'react';
import { Robot } from '@phosphor-icons/react';

export function AgentIcon({ name, size = 22, className = '' }) {
  if (!['Codex', 'Claude', 'Gemini'].includes(name)) return <Robot size={size} className={className} aria-hidden="true" />;
  return <span className={`agent-brand agent-brand-${name.toLowerCase()} ${className}`} style={{ width:size, height:size }} aria-hidden="true">
    {name === 'Codex' ? <><img className="brand-light" src="/agents/codex-light.png" alt=""/><img className="brand-dark" src="/agents/codex-dark.png" alt=""/></> : <img src={`/agents/${name.toLowerCase()}.png`} alt=""/>}
  </span>;
}
