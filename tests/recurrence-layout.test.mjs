import assert from 'node:assert/strict';
import {weeklyOccurrences} from '../public/booking/layout-normalization.js';

assert.deepEqual(weeklyOccurrences('2026-11-11','2026-12-02'),[
  '2026-11-11','2026-11-18','2026-11-25','2026-12-02'
]);
assert.deepEqual(weeklyOccurrences('2026-11-11','2026-11-11'),['2026-11-11']);
assert.throws(()=>weeklyOccurrences('2026-11-11','2026-11-10'),/Ngày kết thúc/);
assert.throws(()=>weeklyOccurrences('2026-11-11','2028-11-11'),/tối đa 52/);
assert.throws(()=>weeklyOccurrences('2026-02-30','2026-03-30'),/Ngày kết thúc/);

console.log('PASS weekly recurrence date generation and validation');

const {normalizeBookingLayout}=await import('../public/booking/layout-normalization.js');
const {MEETING_TABLE}=await import('../public/booking/resources.js');
const table={id:MEETING_TABLE,source:'hex-3',position:[14,0,-6],rotation:[0,.3,0],scale:[1,1,1]};
const members=Array.from({length:6},(_,i)=>({id:'copy-'+i,source:'chair-'+(45+i),bookable:true,position:[14+Math.sin(i*Math.PI/3)*(1+i*.02),0,-6+Math.cos(i*Math.PI/3)*1.2],rotation:[0,0,0],scale:[1,1,1]}));
const regular={id:'chair-33',position:[-4,0,3],rotation:[0,0,0],scale:[1,1,1],bookable:true};
const input={version:1,objects:[table,regular,...members]},original=JSON.stringify(input),output=normalizeBookingLayout(input);
assert.equal(JSON.stringify(input),original,'display alignment does not overwrite saved layout');
assert.deepEqual(output.objects.find(o=>o.id===regular.id),regular,'working chairs keep saved positions');
const angles=[];
for(const chair of output.objects.filter(o=>o.id.startsWith('copy-'))){
 const dx=chair.position[0]-14,dz=chair.position[2]+6;
 assert.ok(Math.abs(Math.hypot(dx,dz)-1.15)<1e-9);
 angles.push(Math.atan2(dx,dz));
}
angles.sort((a,b)=>a-b);
for(let i=0;i<6;i++)assert.ok(Math.abs((angles[(i+1)%6]-angles[i]+2*Math.PI)%(2*Math.PI)-Math.PI/3)<1e-9,'six chairs have equal angular gaps');
assert.deepEqual(output.objects.map(o=>o.id),input.objects.map(o=>o.id),'booking identities stay unchanged');
console.log('PASS Bàn 7 symmetry and saved layout/booking identity preservation');

const one={id:'hex-1',position:[-3.7,0,2],rotation:[0,0,0],scale:[1,1,1]};
const oneChairs=Array.from({length:6},(_,i)=>({id:'chair-'+(33+i),bookable:true,position:[-3.7+Math.sin(i*Math.PI/3)*1.2+(i===0?.1:0),0,2+Math.cos(i*Math.PI/3)*1.2],rotation:[0,0,0],scale:[1,1,1]}));
const aligned=normalizeBookingLayout({objects:[one,...oneChairs]});
const north=aligned.objects.find(o=>o.id==='chair-36'),south=aligned.objects.find(o=>o.id==='chair-33');
assert.equal(north.position[0],one.position[0]);assert.ok(Math.abs(south.position[0]-one.position[0])<1e-9);
for(const o of aligned.objects.filter(o=>o.bookable))assert.ok(Math.abs(Math.hypot(o.position[0]+3.7,o.position[2]-2)-1.15)<1e-9);
console.log('PASS Bàn 1 symmetry, centered north/south chairs, fixed seat IDs');
