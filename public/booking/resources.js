// Shared by the public map and server validation. Object IDs never change.
export const MEETING_TABLE='added-a6fb9fd3-3fc2-4d1c-8aba-ae85531a4c94';
const source=o=>o.source||o.id;
const chair=o=>/^chair-\d+$/.test(source(o));
export function bookingResources(data){
 const objects=(data?.objects||[]).filter(o=>!o.deleted),tables=objects.filter(o=>/^hex-\d+$/.test(source(o))),meeting=objects.find(o=>o.id===MEETING_TABLE);
 const members=meeting?objects.filter(chair).filter(o=>Math.hypot(o.position[0]-meeting.position[0],o.position[2]-meeting.position[2])<2).sort((a,b)=>a.id.localeCompare(b.id)):[];
 const excluded=new Set(members.map(o=>o.id));
 const resources=objects.filter(o=>chair(o)&&o.bookable&&!excluded.has(o.id)&&!/^chair-(77|78|79|80|81|82)$/.test(source(o))).map(o=>{
 const table=tables.filter(t=>t.id!==MEETING_TABLE).map(t=>({t,d:Math.hypot(o.position[0]-t.position[0],o.position[2]-t.position[2])})).sort((a,b)=>a.d-b.d)[0];
 const copyNumber=Number(source(o).slice(6));const copyIndex=objects.filter(c=>chair(c)&&source(c)===source(o)).findIndex(c=>c.id===o.id)+1;
 const number=Number(o.id.match(/^chair-(\d+)$/)?.[1]);
 const tableNumber=table&&table.d<2?Number(source(table.t).slice(4)):null;
 const local=tableNumber&&number>=33&&number<=68?(3-(number-33)%6+6)%6+1:null;
 return {...o,tableId:table&&table.d<2?table.t.id:null,tableNumber,code:local?`Bàn ${tableNumber} · Ghế ${String(local).padStart(2,'0')}`:number?`G${String(number).padStart(2,'0')}`:`G${copyNumber}–${copyIndex}`,shortCode:local?String(local).padStart(2,'0'):number?String(number):String(copyIndex),label:local?`Bàn ${tableNumber} · Ghế ${local}`:o.label,capacity:1,members:[o.id]};
 });
 if(meeting&&members.length===6&&members.every(o=>o.bookable))resources.push({...meeting,tableId:meeting.id,tableNumber:7,code:'Bàn 7',shortCode:'7',label:'Bàn 7 · Đặt nguyên cụm 6 chỗ',capacity:6,members:members.map(o=>o.id)});
 return resources;
}
export function resourceReservations(resource,reservations){const ids=new Set([resource.id,...resource.members]);return reservations.filter(r=>ids.has(r.seatId)).map(r=>({...r,seatId:resource.id}));}
// In SVG, the chair faces +Y and its back lies at -Y. Keep the back outside the table.
export function chairFacingAngle(chairPosition,tablePosition){return Math.atan2(chairPosition[0]-tablePosition[0],tablePosition[2]-chairPosition[2])*180/Math.PI;}
