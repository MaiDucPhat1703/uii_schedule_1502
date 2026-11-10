import assert from 'node:assert/strict';
import {axisTicks} from '../public/booking/axis-ticks.js';
for(const width of [180,240,300,340,460,600,1000])for(const [open,close] of [[420,1320],[435,1305],[540,600]]){
 const ticks=axisTicks(open,close,width);assert.equal(ticks[0],open);assert.equal(ticks.at(-1),close);
 let right=-12;
 ticks.forEach((m,i)=>{const x=(m-open)/(close-open)*width,left=i===0?0:i===ticks.length-1?width-36:x-18;assert.ok(left>=right+12,`${width}px labels overlap`);right=left+36});
}
console.log('PASS timeline labels do not overlap at sidebar/mobile/desktop widths; both opening and closing times remain visible');
