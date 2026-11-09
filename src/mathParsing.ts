import type {JSONContent} from '@tiptap/react';
export type MathMatch={from:number,to:number,latex:string,block:boolean};
// Delimiters are explicit. Single-dollar maths are conservative to preserve USD prices.
export function findMath(text:string):MathMatch[]{
 const re=/\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$\$([\s\S]*?)\$\$|(?<![\\$])\$([^$\n]+?)\$(?!\$)/g;
 const codeRanges=[...text.matchAll(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g)].map(m=>[m.index!,m.index!+m[0].length]);
 const result:MathMatch[]=[];
 for(const m of text.matchAll(re)){
  const from=m.index!,to=from+m[0].length;
  if(codeRanges.some(([a,b])=>from<b&&to>a)||from>0&&text[from-1]==='\\')continue;
  const raw=m[1]??m[2]??m[3]??m[4],latex=raw.trim();
  if(!latex||latex.length>20000)continue;
  if(m[4]!==undefined&&(/^(\s)|\s$/.test(raw)||/^\d[\d,.]*\s+(?:USD|VND|triệu|tỷ|million|billion|and|và)\b/i.test(raw)))continue;
  result.push({from,to,latex,block:m[1]!==undefined||m[3]!==undefined});
 }
 return result;
}
function textOf(n:JSONContent):string{return n.type==='text'?n.text||'':n.type==='hardBreak'?'\n':(n.content||[]).map(textOf).join('')}
function sliceRun(run:JSONContent[],from:number,to:number):JSONContent[]{let pos=0;const out:JSONContent[]=[];for(const node of run){const text=textOf(node),a=Math.max(from-pos,0),b=Math.min(to-pos,text.length);if(b>a)out.push(node.type==='hardBreak'?node:{...node,text:text.slice(a,b)});pos+=text.length}return out}
export function convertLatexDocument(doc:JSONContent):{doc:JSONContent,count:number}{
 let count=0;
 function paragraph(node:JSONContent):JSONContent[]{
  const output:JSONContent[]=[],content=node.content||[];let inline:JSONContent[]=[];
  function flush(){if(inline.some(n=>n.type!=='text'||n.text?.trim()))output.push({...node,content:inline});inline=[]}
  for(let i=0;i<content.length;){
   const run:JSONContent[]=[];
   while(i<content.length&&['text','hardBreak'].includes(content[i].type||'')&&!content[i].marks?.some(m=>m.type==='code'))run.push(content[i++]);
   if(!run.length){inline.push(content[i++]);continue}
   const text=run.map(textOf).join(''),matches=findMath(text);let offset=0;
   for(const match of matches){inline.push(...sliceRun(run,offset,match.from));if(match.block){flush();output.push({type:'blockMath',attrs:{latex:match.latex}})}else inline.push({type:'inlineMath',attrs:{latex:match.latex}});offset=match.to;count++}
   inline.push(...sliceRun(run,offset,text.length));
  }
  if(inline.length)flush();return output.length?output:[node];
 }
 function visit(node:JSONContent):JSONContent[]{
  if(node.type==='codeBlock'||node.type==='inlineMath'||node.type==='blockMath')return [node];
  if(node.type==='paragraph'||node.type==='heading')return paragraph(node);
  if(!node.content)return [node];const children:JSONContent[]=[];
  for(let i=0;i<node.content.length;i++){
   const child=node.content[i],start=textOf(child).trim();
   if(child.type==='paragraph'&&(start==='\\['||start==='$$')){
    const end=start==='\\['?'\\]':'$$';let found=-1;
    for(let j=i+1;j<node.content.length;j++){if(node.content[j].type!=='paragraph')break;if(textOf(node.content[j]).trim().endsWith(end)){found=j;break}}
    if(found!==-1){const source=node.content.slice(i,found+1).map(textOf).join('\n');const matches=findMath(source);if(matches.length===1&&matches[0].from===0&&matches[0].to===source.length){children.push({type:'blockMath',attrs:{latex:matches[0].latex}});count++;i=found;continue}}
   }
   children.push(...visit(child));
  }
  // A list item must begin with a paragraph in the standard ProseMirror schema.
  if(node.type==='listItem'&&children[0]?.type!=='paragraph')children.unshift({type:'paragraph'});
  return [{...node,content:children}];
 }
 return {doc:visit(doc)[0],count};
}
