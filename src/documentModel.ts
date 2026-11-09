import type {JSONContent} from '@tiptap/react';
export type DocumentTab={id:string,parentId:string|null,title:string,content:JSONContent};
export const emptyContent=():JSONContent=>({type:'doc',content:[{type:'paragraph'}]});
export function plainDocument(text:string):JSONContent{return {type:'doc',content:text.split('\n').map(line=>({type:'paragraph',...(line?{content:[{type:'text',text:line}]}:{})}))}}
export function plainText(node:JSONContent):string{if(node.type==='inlineMath')return '\\('+String(node.attrs?.latex||'')+'\\)';if(node.type==='blockMath')return '\\['+String(node.attrs?.latex||'')+'\\]\n';if(node.type==='text')return node.text||'';if(node.type==='hardBreak')return '\n';if(node.type==='image')return node.attrs?.alt?`[Ảnh: ${node.attrs.alt}]`:'';const value=(node.content||[]).map(plainText).join('');return ['paragraph','heading','listItem','blockquote','tableRow'].includes(node.type||'')?value+'\n':value}
export function initialTabs(tabs:DocumentTab[]|undefined,oldText:string):DocumentTab[]{return tabs?.length?structuredClone(tabs):[{id:crypto.randomUUID(),parentId:null,title:'Nội dung chính',content:plainDocument(oldText)}]}
export function descendants(tabs:DocumentTab[],id:string):Set<string>{const found=new Set([id]);for(let changed=true;changed;){changed=false;for(const tab of tabs)if(tab.parentId&&found.has(tab.parentId)&&!found.has(tab.id)){found.add(tab.id);changed=true}}return found}
export function canReparent(tabs:DocumentTab[],id:string,parentId:string|null){return parentId===null||tabs.some(t=>t.id===parentId)&&!descendants(tabs,id).has(parentId)}
export function moveTab(tabs:DocumentTab[],id:string,delta:number):DocumentTab[]{const current=tabs.find(t=>t.id===id);if(!current)return tabs;const peers=tabs.filter(t=>t.parentId===current.parentId);const from=peers.findIndex(t=>t.id===id),target=peers[from+delta];if(!target)return tabs;const a=tabs.findIndex(t=>t.id===id),b=tabs.findIndex(t=>t.id===target.id);const result=[...tabs];[result[a],result[b]]=[result[b],result[a]];return result}
export function tabsAsText(tabs:DocumentTab[]){return tabs.map(t=>t.title+'\n'+plainText(t.content)).join('\n\n')}

export type TabDropPosition='before'|'inside'|'after'|'root';
/** Move only the selected record; descendants keep their parent IDs and content. */
export function dropTab(tabs:DocumentTab[],sourceId:string,targetId:string|null,position:TabDropPosition):DocumentTab[]{
 const source=tabs.find(t=>t.id===sourceId);if(!source)return tabs;
 const moving=descendants(tabs,sourceId);
 if(position!=='root'&&(!targetId||moving.has(targetId)))return tabs;
 const target=tabs.find(t=>t.id===targetId);
 if(position!=='root'&&!target)return tabs;
 const parentId=position==='root'?null:position==='inside'?target!.id:target!.parentId;
 if(!canReparent(tabs,sourceId,parentId))return tabs;
 const result=tabs.filter(t=>t.id!==sourceId),moved={...source,parentId};
 if(position==='root'||position==='inside')result.push(moved);
 else{const at=result.findIndex(t=>t.id===targetId);result.splice(at+(position==='after'?1:0),0,moved)}
 return result;
}
