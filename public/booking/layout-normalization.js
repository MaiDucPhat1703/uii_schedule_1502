import {bookingResources} from './resources.js';
// Align requested display clusters without changing stored layout or booking identities.
export function normalizeBookingLayout(data) {
  const objects=(data?.objects||[]).map(o=>({...o,position:[...o.position],rotation:[...o.rotation],scale:[...o.scale]}));
  const group=bookingResources(data).find(r=>r.capacity===6);
  if(group){
    const members=objects.filter(o=>group.members.includes(o.id)).sort((a,b)=>Number((a.source||a.id).match(/chair-(\d+)$/)?.[1]||0)-Number((b.source||b.id).match(/chair-(\d+)$/)?.[1]||0)||a.id.localeCompare(b.id));
    const yaw=group.rotation[1],cos=Math.cos(yaw),sin=Math.sin(yaw);
    members.forEach((chair,i)=>{
      const angle=i*Math.PI/3,x=Math.sin(angle)*1.15*group.scale[0],z=Math.cos(angle)*1.15*group.scale[2];
      chair.position[0]=group.position[0]+x*cos+z*sin;
      chair.position[2]=group.position[2]-x*sin+z*cos;
    });
  }
  const resources=bookingResources(data),table=objects.find(o=>o.id==='hex-1'&&!o.deleted);
  const first=resources.filter(r=>r.capacity===1&&r.tableId===table?.id).sort((a,b)=>a.shortCode.localeCompare(b.shortCode));
  if(table&&first.length===6){
    const yaw=table.rotation[1],cos=Math.cos(yaw),sin=Math.sin(yaw);
    first.forEach((resource,i)=>{
      const chair=objects.find(o=>o.id===resource.id),angle=i*Math.PI/3;
      const x=Math.sin(angle)*1.15*table.scale[0],z=-Math.cos(angle)*1.15*table.scale[2];
      chair.position[0]=table.position[0]+x*cos+z*sin;
      chair.position[2]=table.position[2]-x*sin+z*cos;
    });
  }
  return {...data,objects};
}

// Date-only arithmetic avoids local timezone/DST shifts for weekly recurrence.
export function weeklyOccurrences(firstDay, lastDay, maxOccurrences = 52) {
  const valid = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  if (!valid(firstDay) || !valid(lastDay) || lastDay < firstDay) {
    throw new Error('Ngày kết thúc lặp lại phải bằng hoặc sau ngày đầu tiên.');
  }
  const start = Date.parse(firstDay + 'T00:00:00Z');
  const end = Date.parse(lastDay + 'T00:00:00Z');
  const out = [];
  for (let stamp = start; stamp <= end; stamp += 7 * 86400000) {
    out.push(new Date(stamp).toISOString().slice(0, 10));
    if (out.length > maxOccurrences) {
      throw new Error(`Một chuỗi đặt lặp tối đa ${maxOccurrences} lần. Hãy chọn ngày kết thúc gần hơn.`);
    }
  }
  return out;
}
