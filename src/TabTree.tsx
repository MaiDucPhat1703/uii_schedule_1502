import {useEffect,useRef,useState,type Dispatch,type SetStateAction,type PointerEvent as ReactPointerEvent} from 'react';
import {ChevronDown,ChevronRight,FileText,GripVertical,CornerDownRight,ArrowDownToLine} from 'lucide-react';
import {descendants,dropTab,moveTab,type DocumentTab,type TabDropPosition} from './documentModel';
type Hover={id:string|null,position:TabDropPosition,valid:boolean};
type Props={tabs:DocumentTab[],selectedId:string,collapsed:Set<string>,setCollapsed:Dispatch<SetStateAction<Set<string>>>,onSelect:(id:string)=>void,onChange:(tabs:DocumentTab[])=>void,onMessage:(message:string)=>void,locked:boolean,onDragging:(v:boolean)=>void};
export default function TabTree({tabs,selectedId,collapsed,setCollapsed,onSelect,onChange,onMessage,locked,onDragging}:Props){
 const [dragging,setDragging]=useState<string|null>(null),[hover,setHover]=useState<Hover|null>(null),[point,setPoint]=useState({x:0,y:0});
 const host=useRef<HTMLDivElement>(null),gesture=useRef<{id:string,pointerId:number,x:number,y:number,active:boolean}|null>(null),hoverRef=useRef<Hover|null>(null),handleRef=useRef<HTMLButtonElement|null>(null);
 function cancel(){const g=gesture.current;gesture.current=null;hoverRef.current=null;setDragging(null);setHover(null);onDragging(false);if(g&&handleRef.current?.hasPointerCapture(g.pointerId))handleRef.current.releasePointerCapture(g.pointerId);handleRef.current=null}
 useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&gesture.current){e.preventDefault();cancel()}};window.addEventListener('keydown',escape);return()=>{window.removeEventListener('keydown',escape);onDragging(false)}},[]);
 function start(event:ReactPointerEvent<HTMLButtonElement>,id:string){if(locked||!event.isPrimary||event.button!==0)return;event.preventDefault();gesture.current={id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,active:false};handleRef.current=event.currentTarget;event.currentTarget.setPointerCapture(event.pointerId)}
 function move(event:ReactPointerEvent<HTMLButtonElement>){
  const g=gesture.current;if(!g||event.pointerId!==g.pointerId)return;
  if(!g.active&&Math.hypot(event.clientX-g.x,event.clientY-g.y)<5)return;
  if(!g.active){g.active=true;setDragging(g.id);onDragging(true)}event.preventDefault();setPoint({x:event.clientX,y:event.clientY});
  const under=document.elementFromPoint(event.clientX,event.clientY),row=under?.closest<HTMLElement>('[data-tab-drop-id]'),root=under?.closest('[data-tab-root-drop]');
  let next:Hover|null=null;
  if(row&&host.current?.contains(row)){
   const id=row.dataset.tabDropId!,rect=row.getBoundingClientRect(),fraction=(event.clientY-rect.top)/rect.height;
   const position:TabDropPosition=fraction<.25?'before':fraction>.75?'after':'inside';
   next={id,position,valid:!descendants(tabs,g.id).has(id)};
  }else if(root&&host.current?.contains(root))next={id:null,position:'root',valid:true};
  hoverRef.current=next;setHover(next);
  const rect=host.current?.getBoundingClientRect();if(rect){if(event.clientY<rect.top+28)host.current!.scrollTop-=10;else if(event.clientY>rect.bottom-28)host.current!.scrollTop+=10}
 }
 function finish(event:ReactPointerEvent<HTMLButtonElement>){
  const g=gesture.current,target=hoverRef.current;if(!g||event.pointerId!==g.pointerId)return;
  if(g.active&&target){
   if(target.valid){const next=dropTab(tabs,g.id,target.id,target.position);onChange(next);onSelect(g.id);const moved=next.find(t=>t.id===g.id);if(moved?.parentId)setCollapsed(prev=>{const value=new Set(prev);value.delete(moved.parentId!);return value});onMessage('Đã di chuyển thẻ và giữ các thẻ con. Nhấn Lưu tài liệu để lưu thứ tự mới.')}
   else onMessage('Không thể thả thẻ vào chính nó hoặc vào thẻ con của nó.');
  }
  cancel();
 }
 const label=hover?hover.valid?(hover.position==='root'?'Đưa ra cấp cao nhất':hover.position==='inside'?'Đặt làm thẻ con':hover.position==='before'?'Đặt phía trên':'Đặt phía dưới'):'Không thể thả tại đây':'Kéo tới vị trí mới';
 function tree(parentId:string|null,depth=0):React.ReactNode{return tabs.filter(t=>t.parentId===parentId).map(tab=>{const children=tabs.some(t=>t.parentId===tab.id),isTarget=hover?.id===tab.id;return <div key={tab.id}><div data-tab-drop-id={tab.id} className={'doc-tab-row '+(selectedId===tab.id?'selected ':'')+(dragging===tab.id?'is-dragging ':'')+(isTarget?'drop-'+hover!.position+(hover!.valid?'':' drop-invalid'):'')} style={{paddingLeft:Math.min(5+depth*13,165)}}><button className="tab-grip" aria-label={'Kéo thẻ '+(tab.title||'Chưa đặt tên')} title="Kéo để sắp xếp; thả giữa thẻ khác để tạo thẻ con. Alt + ↑/↓ để đổi thứ tự bằng bàn phím." disabled={locked} draggable={false} onPointerDown={e=>start(e,tab.id)} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={()=>{if(gesture.current)cancel()}} onKeyDown={e=>{if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();onChange(moveTab(tabs,tab.id,e.key==='ArrowUp'?-1:1));onMessage('Đã đổi thứ tự thẻ. Nhấn Lưu tài liệu.')}}}><GripVertical size={15}/></button><button className="tab-expand" aria-label={(collapsed.has(tab.id)?'Mở':'Thu gọn')+' '+tab.title} disabled={!children||locked||!!dragging} onClick={()=>setCollapsed(prev=>{const next=new Set(prev);next.has(tab.id)?next.delete(tab.id):next.add(tab.id);return next})}>{children?(collapsed.has(tab.id)?<ChevronRight size={13}/>:<ChevronDown size={13}/>):<span/>}</button><button className="doc-tab-name" disabled={locked||!!dragging} title={tab.title} onClick={()=>onSelect(tab.id)}><FileText size={15}/><span>{tab.title||'Chưa đặt tên'}</span></button>{isTarget&&hover!.valid&&hover!.position==='inside'&&<CornerDownRight className="drop-inside-icon" size={14}/>}</div>{!collapsed.has(tab.id)&&tree(tab.id,depth+1)}</div>})}
 return <div ref={host} className={'doc-tree draggable-tree '+(dragging?'tree-dragging':'')} role="navigation" aria-label="Các thẻ tài liệu">{tree(null)}<div data-tab-root-drop="true" className={'root-drop-zone '+(dragging?'visible ':'')+(hover?.position==='root'?'root-drop-active':'')}><ArrowDownToLine size={14}/><span>Thả ở đây để đưa ra cấp cao nhất</span></div>{dragging&&<div className={'tab-drag-ghost '+(hover&&!hover.valid?'invalid':'')} style={{left:Math.min(point.x+16,window.innerWidth-220),top:point.y+16}}><GripVertical size={14}/><span>{tabs.find(t=>t.id===dragging)?.title}<small>{label}</small></span></div>}<span className="sr-only" aria-live="polite">{dragging?label:''}</span></div>
}
