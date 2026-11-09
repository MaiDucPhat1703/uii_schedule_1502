/** Only normal web URLs can be opened by the document's Ctrl/Cmd-click action. */
export function safeWebLink(href:string,base:string):string|null{
 try{const url=new URL(href,base);return ['https:','http:'].includes(url.protocol)?url.href:null}catch{return null}
}
export function openModifiedDocumentLink(event:MouseEvent):boolean{
 if(event.button!==0||(!event.ctrlKey&&!event.metaKey)||event.altKey)return false;
 const element=event.target instanceof Element?event.target:event.target instanceof Node?event.target.parentElement:null;
 const anchor=element?.closest('a[href]');if(!anchor)return false;
 const href=safeWebLink(anchor.getAttribute('href')||'',window.location.href);
 event.preventDefault();event.stopPropagation();
 if(href)window.open(href,'_blank','noopener,noreferrer');
 return true;
}
