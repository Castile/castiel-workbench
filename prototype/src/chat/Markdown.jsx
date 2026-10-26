import React, { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check, ArrowSquareOut } from '@phosphor-icons/react';

export function CopyButton({ text, label='复制', className='' }) {
  const [status,setStatus]=useState(''), timer=useRef();
  React.useEffect(()=>()=>clearTimeout(timer.current),[]);
  async function copy(){try{if(window.castielDesktop)await window.castielDesktop.writeClipboard(text);else await navigator.clipboard.writeText(text);setStatus('已复制')}catch{setStatus('复制失败，请手动选择')}clearTimeout(timer.current);timer.current=setTimeout(()=>setStatus(''),2500)}
  return <button type="button" className={`copy-button ${className}`} onClick={copy} aria-label={status||label} title={status||label}>{status==='已复制'?<Check size={15}/>:<Copy size={15}/>}<span role="status">{status||label}</span></button>;
}
const textOf = node => typeof node==='string' ? node : Array.isArray(node) ? node.map(textOf).join('') : React.isValidElement(node) ? textOf(node.props.children) : '';
function CodeBlock({children}) {
  const code=React.Children.toArray(children).find(React.isValidElement), language=/language-([^\s]+)/.exec(code?.props.className||'')?.[1]||'text';
  return <div className="code-block"><div className="code-toolbar"><span>{language}</span><CopyButton text={textOf(children).replace(/\n$/,'')} label="复制代码"/></div><pre tabIndex={0} aria-label={`${language} 代码`}>{children}</pre></div>;
}
function MarkdownLink({href,children}) {
  const [error,setError]=useState('');
  let safe=false;
  try{const url=new URL(href);safe=['http:','https:'].includes(url.protocol)&&!url.username&&!url.password}catch{}
  if (!safe) return <span>{children}</span>;
  async function open(event){if(!window.castielDesktop)return;event.preventDefault();try{await window.castielDesktop.openExternal(href);setError('')}catch{setError('链接未能打开')}}
  return <><a href={href} target="_blank" rel="noopener noreferrer" onClick={open}>{children}<ArrowSquareOut size={12} aria-hidden="true"/></a>{error&&<small role="status">{error}</small>}</>;
}
const components={
  pre:CodeBlock,
  a:MarkdownLink,
  img:({alt})=><span className="markdown-image-note">[图片：{alt||'未自动加载'}]</span>,
  table:({children})=><div className="markdown-table" tabIndex={0} role="region" aria-label="回复中的表格"><table>{children}</table></div>
};
export function Markdown({text=''}) {
  return <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight,{detect:false,ignoreMissing:true}]]} components={components} skipHtml>{text}</ReactMarkdown></div>;
}
