import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyIntervals,dailySummary} from '../public/booking/day-overview.js';
await test('Day overview shows every approved interval, deduplicates group members, and counts physical places',()=>{
 const seat={id:'a',capacity:1,members:['a']},group={id:'group',capacity:6,members:['g1','g2']};
 const events=[
  {seatId:'a',resourceType:'seat',status:'active',startMinute:690,endMinute:1095},
  {seatId:'a',resourceType:'seat',status:'active',startMinute:420,endMinute:480},
  {seatId:'a',resourceType:'seat',status:'pending',startMinute:480,endMinute:600},
  {seatId:'g1',resourceType:'seat',status:'active',startMinute:900,endMinute:960},
  {seatId:'g2',resourceType:'seat',status:'active',startMinute:900,endMinute:960},
 ];
 assert.deepEqual(dailyIntervals(seat,events),[{startMinute:420,endMinute:480},{startMinute:690,endMinute:1095}]);
 assert.equal(dailyIntervals(group,events).length,1);
 assert.deepEqual(dailySummary([seat,group,{id:'free',members:[],capacity:1}],events),{total:8,scheduled:7,free:1});
 assert.deepEqual(dailyIntervals(seat,[{...events[0],status:'rejected'}]),[]);
});
