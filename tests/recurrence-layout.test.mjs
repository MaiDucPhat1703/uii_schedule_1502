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
