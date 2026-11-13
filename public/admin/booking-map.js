import {adminSeatLabel,t} from '/admin/language.js';
import {CHAIR_BODY,CHAIR_BACK_PATH,hexOutline} from '/booking/furniture-geometry.js';
import * as THREE from '/studio/assets/three.module.js';
import {buildModel} from '/studio/model.js';
import {bookingResources,chairFacingAngle,MEETING_TABLE} from '/booking/resources.js';
import {normalizeBookingLayout} from '/booking/layout-normalization.js';
const NS='http://www.w3.org/2000/svg',model=buildModel();
const catalog=new Map(model.editItems.map(i=>{const copy=i.object.clone(true);copy.position.set(0,0,0);copy.rotation.set(0,0,0);copy.scale.set(1,1,1);copy.updateMatrixWorld(true);return [i.id,{kind:i.kind,size:new THREE.Box3().setFromObject(copy).getSize(new THREE.Vector3())}]}));
export function requestedSeatIds(booking,resources){let ids;try{ids=booking.seat_ids?JSON.parse(booking.seat_ids):[booking.seat_id]}catch{ids=[booking.seat_id]}return [...new Set(ids.flatMap(id=>resources.find(r=>r.id===id)?.members||[id]))];}
const shape=(tag,attrs={},text)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n};
function point(o,x,z){return new THREE.Vector3(x,0,z).multiply(new THREE.Vector3(...o.scale)).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation))).add(new THREE.Vector3(...o.position))}
function makeSeatControl(node,resource,onPick){
 node.setAttribute('role','button');
 node.setAttribute('tabindex','0');
 node.setAttribute('data-resource-id',resource.id);
 node.setAttribute('aria-label',adminSeatLabel(resource.code)+(resource.capacity===6?' · '+t('{count} chỗ',{count:6}):''));
 node.onclick=()=>onPick(resource);
 node.onkeydown=event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  event.preventDefault();
  if(!event.repeat)onPick(resource);
 };
}
export function drawBookingMap(container,space,booking,whole=false,{area,onPick}={}){container.replaceChildren();if(!space||booking.resource_type==='room'){const p=document.createElement('p');p.textContent=!space?t('Chưa có sơ đồ đang áp dụng.'):t('Đăng ký phòng cũ không có vị trí ghế trên sơ đồ.');container.append(p);return {located:0,total:0,missing:[],area:t('Không có sơ đồ')}}
 const normalizedData=normalizeBookingLayout(space.data),resources=bookingResources(normalizedData),wanted=requestedSeatIds(booking,resources),ids=new Set(wanted),objects=normalizedData.objects.filter(o=>!o.deleted).map(o=>({...o,meta:catalog.get(o.source||o.id)})).filter(o=>o.meta),meeting=resources.find(r=>r.capacity===6),meetingIds=new Set(meeting?.members||[]),isMeeting=area?area==='meeting':wanted.length>0&&wanted.every(id=>meetingIds.has(id));
 const chairs=objects.filter(o=>o.meta.kind==='chair'&&(whole||(!area&&ids.has(o.id))||(isMeeting?meetingIds.has(o.id):resources.some(r=>r.capacity===1&&r.members.includes(o.id))))),located=objects.filter(o=>o.meta.kind==='chair'&&ids.has(o.id));
 const extents=whole?objects.filter(o=>['wall','glass','hex'].includes(o.meta.kind)):chairs;
 if(!extents.length){const p=document.createElement('p');p.textContent=t('Không tìm thấy vị trí trên sơ đồ hiện tại.');container.append(p);return {located:0,total:wanted.length,missing:wanted,area:t('Không tìm thấy vị trí')}}
 const positions=extents.flatMap(o=>whole?[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>point(o,x*o.meta.size.x/2,z*o.meta.size.z/2)):[new THREE.Vector3(...o.position)]),xs=positions.map(p=>p.x),zs=positions.map(p=>p.z),x=Math.min(...xs)-.7,z=Math.min(...zs)-.7,w=Math.max(...xs)-x+.7,h=Math.max(...zs)-z+.7;
 const map=shape('svg',{viewBox:[x,z,w,h].join(' '),class:'admin-floor-map',role:onPick?'group':'img','aria-label':t('Vị trí {seats}',{seats:adminSeatLabel(String(booking.seat_label||'').replace(/;\s*/g,'\n')).replace(/\n/g,', ')})});container.append(map);
 for(const o of objects.filter(o=>o.meta.kind==='hex'&&(whole||(isMeeting?o.id===MEETING_TABLE:o.id!==MEETING_TABLE)))){
  const points=hexOutline().map(([x,z])=>point(o,x,z)),center=point(o,0,0);
  const label=t('Bàn {number}',{number:o.id===MEETING_TABLE?7:Number((o.source||o.id).slice(4))});
  const table=shape('g');
  table.append(shape('polygon',{points:points.map(p=>p.x+','+p.z).join(' '),class:'admin-table'}),shape('text',{x:center.x,y:center.z,class:'admin-table-name'},label));
  if(onPick&&o.id===MEETING_TABLE&&meeting)makeSeatControl(table,meeting,onPick);
  else if(!onPick)table.append(shape('title',{},o.id===MEETING_TABLE?label:adminSeatLabel(o.label?.replace('Bàn lục giác','Bàn')||o.id)));
  map.append(table);
 }
 if(whole)for(const o of objects.filter(o=>['wall','glass'].includes(o.meta.kind))){const size=o.meta.size,points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>point(o,a*size.x/2,b*size.z/2));map.append(shape('polygon',{points:points.map(p=>p.x+','+p.z).join(' '),class:'admin-wall'}))}
 for(const o of chairs){const resource=resources.find(r=>r.members.includes(o.id)),table=objects.find(t=>t.id===resource?.tableId),angle=table?chairFacingAngle(o.position,table.position):0,chosen=ids.has(o.id),g=shape('g',{transform:`translate(${o.position[0]} ${o.position[2]}) rotate(${angle}) scale(${o.scale[0]} ${o.scale[2]})`,class:'admin-chair'+(chosen&&!onPick?' requested':''),'data-seat-id':o.id});g.append(shape('rect',CHAIR_BODY),shape('path',{d:CHAIR_BACK_PATH}),shape('text',{x:0,y:0,transform:`rotate(${-angle})`},resource?.capacity===6?'':resource?.shortCode||''),shape('title',{},adminSeatLabel(resource?.code||o.label)+(chosen?' · '+t('Thuộc yêu cầu này'):'')));if(onPick&&resource){
  if(resource.capacity===1)makeSeatControl(g,resource,onPick);
  else{
   g.setAttribute('data-resource-id',resource.id);
   g.setAttribute('aria-hidden','true');
   g.onclick=()=>onPick(resource);
  }
 }map.append(g)}
 return {located:located.length,total:wanted.length,missing:wanted.filter(id=>!located.some(o=>o.id===id)),area:isMeeting?t('Khu 2 · Bàn 7 bên trong'):t('Khu 1 · Bàn 1–6')};
}
