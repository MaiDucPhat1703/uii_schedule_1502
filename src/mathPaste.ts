import {DOMParser as ProseMirrorParser,DOMSerializer,type Schema} from '@tiptap/pm/model';
import type {JSONContent} from '@tiptap/react';
import {marked} from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import {findMath,convertLatexDocument} from './mathParsing';
export function mathElement(latex:string,block:boolean,doc:Document=document):HTMLElement{const element=doc.createElement(block?'div':'span');element.setAttribute('data-type',block?'block-math':'inline-math');element.setAttribute('data-latex',latex);return element}
function replaceRenderedMath(html:string):{html:string,count:number}{
 const doc=new DOMParser().parseFromString(html,'text/html');let count=0;
 for(const annotation of [...doc.querySelectorAll('annotation[encoding="application/x-tex"],annotation[encoding="application/x-latex"],annotation[encoding="math/tex"]')]){
  if(!annotation.isConnected||annotation.closest('[data-type="inline-math"],[data-type="block-math"]'))continue;
  const latex=annotation.textContent?.trim();if(!latex)continue;
  const display=annotation.closest('.katex-display,[data-display="true"],mjx-container[display="true"]');
  const root=display||annotation.closest('.katex,mjx-container')||annotation.closest('math');if(!root)continue;
  const block=!!display||root.getAttribute('display')==='block'||root.parentElement?.tagName==='P'&&root.parentElement.textContent?.trim()===root.textContent?.trim();
  root.replaceWith(mathElement(latex,!!block,doc));count++;
 }
 // Other renderers often retain source directly on their outer math element.
 for(const element of [...doc.querySelectorAll('[data-math],[data-latex]')]){
  if(!element.isConnected||element.matches('[data-type="inline-math"],[data-type="block-math"]')||element.closest('[data-type="inline-math"],[data-type="block-math"]'))continue;
  const latex=element.getAttribute('data-latex')||element.getAttribute('data-math');if(!latex)continue;
  element.replaceWith(mathElement(latex,element.getAttribute('data-display')==='true'||element.tagName==='DIV',doc));count++;
 }
 return {html:doc.body.innerHTML,count};
}
export function markdownMathHtml(text:string):string{
 const matches=findMath(text),tokens=new Map<string,string>();let offset=0,prepared='';
 // Token prefix is random so source text cannot accidentally collide with it.
 const prefix='MATH'+crypto.randomUUID().replaceAll('-','')+'TOKEN';
 for(const [index,match] of matches.entries()){const key=prefix+index+'END';tokens.set(key,mathElement(match.latex,match.block).outerHTML);prepared+=text.slice(offset,match.from)+(match.block?'\n\n'+key+'\n\n':key);offset=match.to}
 prepared+=text.slice(offset);let html=marked.parse(prepared,{async:false,gfm:true,breaks:true}) as string;
 for(const [key,value] of tokens){html=html.replace('<p>'+key+'</p>',value).replaceAll(key,value)}return html;
}
export function prepareMathPaste(html:string,text:string,schema:Schema):{doc:JSONContent,count:number}|null{
 if(!html&&!findMath(text).length)return null;
 const replaced=html?replaceRenderedMath(html):{html:markdownMathHtml(text),count:0};
 const clean=DOMPurify.sanitize(replaced.html,{ADD_ATTR:['data-type','data-latex','data-storage-path'],FORBID_TAGS:['script','style','iframe','object','embed']});
 const dom=new DOMParser().parseFromString(clean,'text/html');const doc=ProseMirrorParser.fromSchema(schema).parse(dom.body).toJSON() as JSONContent;
 const converted=convertLatexDocument(doc);const ownNodes=dom.querySelectorAll('[data-type="inline-math"],[data-type="block-math"]').length;
 if(!converted.count&&!replaced.count&&!ownNodes)return null;
 return {doc:converted.doc,count:converted.count+Math.max(replaced.count,ownNodes)};
}
export function mathClipboardSerializer(schema:Schema){const original=DOMSerializer.fromSchema(schema);const render=(block:boolean)=>(node:Parameters<typeof original.serializeNode>[0])=>{const element=mathElement(String(node.attrs.latex||''),block);element.innerHTML=katex.renderToString(String(node.attrs.latex||''),{displayMode:block,throwOnError:false,trust:false,strict:'ignore',maxExpand:200});return element};return new DOMSerializer({...original.nodes,inlineMath:render(false),blockMath:render(true)},original.marks)}
