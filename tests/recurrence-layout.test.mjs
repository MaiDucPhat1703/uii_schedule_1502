import assert from 'node:assert/strict';
import {normalizeBookingLayout,weeklyOccurrences} from '../public/booking/layout-normalization.js';

assert.deepEqual(weeklyOccurrences('2026-11-11','2026-12-02'),[
  '2026-11-11','2026-11-18','2026-11-25','2026-12-02'
]);
assert.deepEqual(weeklyOccurrences('2026-11-11','2026-11-11'),['2026-11-11']);
assert.throws(()=>weeklyOccurrences('2026-11-11','2026-11-10'),/Ngày kết thúc/);
assert.throws(()=>weeklyOccurrences('2026-11-11','2028-11-11'),/tối đa 52/);
assert.throws(()=>weeklyOccurrences('2026-02-30','2026-03-30'),/Ngày kết thúc/);

const objects=[];
for(let t=1;t<=6;t++){
  const center=[t*5,0,0];
  objects.push({id:'table-'+t,source:'hex-'+t,position:center,rotation:[0,0,.0],scale:[1,1,1]});
  for(let i=0;i<6;i++)objects.push({
    id:'seat-'+(t*10+i),source:'chair-'+(32+(t-1)*6+i+1),bookable:true,
    position:[center[0]+Math.sin(i*1.1)*(.7+i*.2),0,center[2]+Math.cos(i*1.1)*(.7+i*.2)],
    rotation:[0,0,0],scale:[1,1,1]
  });
}
const normalized=normalizeBookingLayout({version:1,objects});
for(let t=1;t<=6;t++){
  const table=normalized.objects.find(o=>o.id==='table-'+t);
  const chairs=normalized.objects.filter(o=>{const n=Number((o.source||'').match(/chair-(\d+)$/)?.[1]||0);return n>=33+(t-1)*6&&n<33+t*6;});
  assert.equal(chairs.length,6);
  const radii=chairs.map(c=>Math.hypot(c.position[0]-table.position[0],c.position[2]-table.position[2]));
  assert.ok(radii.every(r=>Math.abs(r-1.12)<1e-9),'chairs have equal distance from table '+t);
  const angles=chairs.map(c=>Math.atan2(c.position[0]-table.position[0],c.position[2]-table.position[2])).sort((a,b)=>a-b);
  const gaps=angles.map((a,i)=>((angles[(i+1)%6]-a+Math.PI*2)%(Math.PI*2)));
  assert.ok(gaps.every(g=>Math.abs(g-Math.PI/3)<1e-9),'chairs are evenly spaced around table '+t);
}
console.log('PASS weekly recurrence date generation, 52-occurrence guard, invalid date rejection and even chair spacing for all six tables');
