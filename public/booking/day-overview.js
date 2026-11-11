import {resourceReservations} from './resources.js';

// Public day summaries use approved occupancy only.
export function dailyIntervals(resource,reservations){
 const unique=new Map();
 for(const r of resourceReservations(resource,reservations)){
  if(r.status!=='active'||r.resourceType!=='seat'||!Number.isInteger(r.startMinute)||!Number.isInteger(r.endMinute)||r.endMinute<=r.startMinute)continue;
  const key=r.startMinute+':'+r.endMinute;
  const interval={startMinute:r.startMinute,endMinute:r.endMinute};
  if(r.booker)interval.booker=r.booker;
  unique.set(key,interval);
 }
 return [...unique.values()].sort((a,b)=>a.startMinute-b.startMinute||a.endMinute-b.endMinute);
}
export function dailySummary(resources,reservations){
 let total=0,scheduled=0;
 for(const resource of resources){total+=resource.capacity;if(dailyIntervals(resource,reservations).length)scheduled+=resource.capacity}
 return {total,scheduled,free:total-scheduled};
}
