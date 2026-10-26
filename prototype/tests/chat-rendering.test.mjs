import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as linkPolicy from '../desktop/assets.mjs';

test('external reply links reject local files, script schemes and credential-bearing URLs',()=>{
  assert.equal(typeof linkPolicy.externalURL,'function');
  assert.equal(linkPolicy.externalURL('https://example.com/docs?q=1'),'https://example.com/docs?q=1');
  for(const value of ['file:///etc/passwd','javascript:alert(1)','data:text/html,bad','https://user:password@example.com',undefined])assert.throws(()=>linkPolicy.externalURL(value));
});
test('reply renderer preserves GFM and unknown streaming code without executing HTML or fetching images',async t=>{
  await fs.mkdir(new URL('../.cache/',import.meta.url),{recursive:true});
  const target=new URL(`../.cache/chat-render-${process.pid}.mjs`,import.meta.url);
  t.after(()=>fs.rm(target,{force:true}));
  const source=new URL('../src/chat/Markdown.jsx',import.meta.url);
  const {code}=await transformWithEsbuild(await fs.readFile(source,'utf8'),source.pathname,{loader:'jsx',jsx:'automatic'});
  await fs.writeFile(target,code);
  const {Markdown}=await import(pathToFileURL(target.pathname));
  const html=renderToStaticMarkup(React.createElement(Markdown,{text:'# Plan\n\n- [x] Safe\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n<script>alert(1)</script>\n\n![remote](https://private.example/pixel)\n\n[bad](javascript:alert(1))\n\n[good](https://example.com)\n\n```not-a-language\n<div>literal</div>'}));
  assert.match(html,/<h1>Plan<\/h1>/);assert.match(html,/<table>/);assert.match(html,/type="checkbox"/);
  assert.match(html,/not-a-language/);assert.match(html,/&lt;div&gt;literal&lt;\/div&gt;/);assert.match(html,/复制代码/);
  assert.doesNotMatch(html,/<script|<img|javascript:|src="https:\/\/private/);
  assert.match(html,/href="https:\/\/example.com"/);
});
