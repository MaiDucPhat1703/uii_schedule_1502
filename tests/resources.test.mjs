import assert from 'node:assert/strict';import fs from 'node:fs';import {bookingResources,resourceReservations,MEETING_TABLE,chairFacingAngle} from '../public/booking/resources.js';
// The actual published layout is optional here; a standalone fixture tests operating rules.
const mk=(id,source,x,z,bookable=true)=>({id,source,position:[x,0,z],bookable});
const objects=[mk('hex-1','hex-1',0,0,false),...Array.from({length:6},(_,i)=>mk('chair-'+(33+i),'chair-'+(33+i),Math.cos(i),Math.sin(i))),mk(MEETING_TABLE,'hex-3',20,20,false),...Array.from({length:6},(_,i)=>mk('copy-'+i,'chair-'+(45+i),20+Math.cos(i),20+Math.sin(i))),...Array.from({length:6},(_,i)=>mk('chair-'+(77+i),'chair-'+(77+i),-10,i,true))];
let resources=bookingResources({objects});assert.equal(resources.length,7);assert.equal(new Set(resources.map(r=>r.code)).size,7);const group=resources.find(r=>r.capacity===6);assert.equal(group.code,'Bàn 7');assert.equal(group.members.length,6);assert.ok(!resources.some(r=>r.id==='copy-0'));assert.ok(!resources.some(r=>r.id==='chair-77'));assert.equal(resources.find(r=>r.id==='chair-36').code,'Bàn 1 · Ghế 01');
assert.deepEqual(resourceReservations(group,[{seatId:'copy-0',startMinute:600,endMinute:720},{seatId:group.id,startMinute:780,endMinute:840},{seatId:'chair-33'}]).map(r=>r.seatId),[group.id,group.id]);
resources=bookingResources({objects:objects.map(o=>o.id==='copy-0'?{...o,bookable:false}:o)});assert.ok(!resources.some(r=>r.capacity===6));assert.ok(!resources.some(r=>r.id==='copy-1'),'do not fall back to individual bookings for a closed group');
console.log('PASS readable unique codes, clockwise seat numbering, six-place cluster, pantry exclusion and legacy group conflicts');

for(let i=0;i<6;i++){const a=i*Math.PI/3,chair=[2+Math.sin(a),0,3+Math.cos(a)],table=[2,0,3],angle=chairFacingAngle(chair,table)*Math.PI/180;const front=[-Math.sin(angle),Math.cos(angle)],toward=[table[0]-chair[0],table[2]-chair[2]];assert.ok(front[0]*toward[0]+front[1]*toward[1]>.999,'chair front faces table; back outside for all six angles');}
console.log('PASS all six chair orientations face the table center');

const {hexOutline,CHAIR_BODY}=await import('../public/booking/furniture-geometry.js');
const outline=hexOutline();
for(let i=0;i<6;i++)assert.ok(Math.abs(Math.hypot(outline[i][0]-outline[(i+1)%6][0],outline[i][1]-outline[(i+1)%6][1])-.96)<1e-9,'regular hexagon is not flattened by applying bounding dimensions twice');
assert.equal(CHAIR_BODY.width,.45);assert.equal(CHAIR_BODY.height,.43);
console.log('PASS shared tabletop and chair dimensions match the 3D model');
