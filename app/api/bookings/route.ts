import {bookingResources} from '../../../public/booking/resources';
import {env} from '../../runtime.ts';
import {visitor,sameOrigin} from '../../admin-auth';
import {settings,dayValid,policyError,seedRooms} from '../../booking-policy';

export const dynamic='force-dynamic';
const response=(b:unknown,s=200,cookie:string|null=null)=>Response.json(b,{status:s,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
const conflictMessage='Có ít nhất một ngày trong chuỗi bị trùng lịch. Chưa lưu lượt nào; hãy đổi ngày hoặc khung giờ.';

export async function GET(r:Request){
 const u=await visitor(r),day=new URL(r.url).searchParams.get('day');
 if(!dayValid(day))return response({error:'Ngày không hợp lệ.'},400,u.cookie);
 const rows=await env.DB!.prepare("SELECT seat_id,seat_ids,resource_type,COALESCE(start_minute,start_slot*30) startMinute,COALESCE(end_minute,end_slot*30) endMinute,user_id,status FROM seat_bookings WHERE day=? AND resource_type='seat' AND status='active'").bind(day).all();
 const mine=await env.DB!.prepare("SELECT id,status FROM seat_bookings WHERE user_id=? AND day=? AND resource_type='seat' ORDER BY created_at").bind(u.userId,day).all();
 return response({reservations:rows.results.flatMap((b:any)=>(b.seat_ids?JSON.parse(b.seat_ids):[b.seat_id]).map((seatId:string)=>({seatId,resourceType:b.resource_type,startMinute:b.startMinute,endMinute:b.endMinute,mine:b.user_id===u.userId,status:b.status}))),mine:mine.results},200,u.cookie);
}

export async function POST(r:Request){
 const u=await visitor(r),json=(b:unknown,s=200)=>response(b,s,u.cookie);
 if(!sameOrigin(r))return json({error:'Yêu cầu không hợp lệ.'},403);
 let b:any;try{b=await r.json()}catch{return json({error:'Dữ liệu không hợp lệ.'},400)}
 if(b?.action)return json({error:'Lượt đặt này không hỗ trợ tự sửa hoặc hủy.'},403);
 if(!b||typeof b!=='object')return json({error:'Dữ liệu đăng ký không hợp lệ.'},400);

 const requested=Array.isArray(b.seatIds)?b.seatIds:[b.seatId];
 if(!requested.length||requested.length>36||requested.some((id:unknown)=>typeof id!=='string'||!id.length||id.length>100)||new Set(requested).size!==requested.length)return json({error:'Chọn từ 1 đến 36 ghế khác nhau.'},400);
 const seatIds:string[]=[...requested].sort();b.seatId=seatIds[0];
 const type=b.resourceType||'seat';
 if(type!=='seat')return json({error:'Hệ thống hiện chỉ nhận đặt chỗ ngồi theo khung giờ.'},400);
 if(typeof b.attendees!=='number'||!Number.isInteger(b.attendees)||b.attendees<1||b.attendees>1000||!['startup','faculty','staff','other'].includes(b.groupType))return json({error:'Chọn nhóm đối tượng và số người hợp lệ.'},400);
 for(const [key,max] of [['displayName',255],['organization',255],['email',255],['phone',20],['leader',255],['subject',255]] as const)if(typeof b[key]!=='string'||!b[key].trim()||b[key].length>max)return json({error:'Vui lòng điền đủ họ tên, đơn vị, email, điện thoại, người chủ trì và tiêu đề.'},400);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)||!/^\+?[\d\s().-]{8,20}$/.test(b.phone)||typeof b.description!=='string'||b.description.length>2000)return json({error:'Email, số điện thoại hoặc mô tả không hợp lệ.'},400);

 if(b.occurrences!==undefined&&!Array.isArray(b.occurrences))return json({error:'Danh sách ngày lặp không hợp lệ.'},400);
 const occurrences=Array.isArray(b.occurrences)?b.occurrences:[{requestId:b.requestId,day:b.day,startMinute:b.startMinute,endMinute:b.endMinute}];
 if(!occurrences.length||occurrences.length>52)return json({error:'Một lượt đặt lặp tối đa 52 lần hàng tuần.'},400);
 const ids=new Set<string>(),days=new Set<string>();
 for(const occurrence of occurrences){
  if(!occurrence||typeof occurrence.requestId!=='string'||!occurrence.requestId.length||occurrence.requestId.length>80||ids.has(occurrence.requestId)||!dayValid(occurrence.day)||days.has(occurrence.day)||!Number.isInteger(occurrence.startMinute)||!Number.isInteger(occurrence.endMinute))return json({error:'Danh sách ngày lặp không hợp lệ hoặc bị trùng.'},400);
  ids.add(occurrence.requestId);days.add(occurrence.day);
 }
 const config=await settings();
 for(const occurrence of occurrences){const error=policyError(config.policy,occurrence.day,occurrence.startMinute,occurrence.endMinute,type);if(error)return json({error:occurrence.day+': '+error},400);}

 // Idempotency: a retry after a successful response loss must not duplicate the series.
 const pending:any[]=[];
 for(const occurrence of occurrences){
  const prior=await env.DB!.prepare('SELECT user_id,seat_id,seat_ids,day,COALESCE(start_minute,start_slot*30) startMinute,COALESCE(end_minute,end_slot*30) endMinute,status FROM seat_bookings WHERE id=?').bind(occurrence.requestId).first();
  if(prior){
   const priorSeats=(prior.seat_ids?JSON.parse(prior.seat_ids as string):[prior.seat_id]).sort();
   if(prior.user_id!==u.userId||JSON.stringify(priorSeats)!==JSON.stringify(seatIds)||prior.day!==occurrence.day||prior.startMinute!==occurrence.startMinute||prior.endMinute!==occurrence.endMinute)return json({error:'Một yêu cầu trong chuỗi đã tồn tại với nội dung khác. Vui lòng tải lại.'},409);
  }else pending.push(occurrence);
 }
 if(!pending.length)return json({ok:true,id:occurrences[0].requestId,status:'pending',count:occurrences.length,alreadySaved:true});

 // Durable per-visitor storage-abuse guard. Retries of saved IDs do not consume quota.
 const recent=await env.DB!.prepare("SELECT COUNT(*) n FROM seat_bookings WHERE user_id=? AND created_at>=?").bind(u.userId,new Date(Date.now()-3600000).toISOString()).first();
 if(Number(recent?.n||0)+pending.length>120){const limited=json({error:'Phiên này đã gửi nhiều lượt trong một giờ. Vui lòng thử lại sau.'},429);limited.headers.set('Retry-After','3600');return limited;}

 const space=await env.DB!.prepare('SELECT data,revision FROM spatial_spaces WHERE id=?').bind('main').first();
 if(!space)return json({error:'Sơ đồ chỗ ngồi chưa được áp dụng.'},409);
 const resources=bookingResources(JSON.parse(space.data as string));
 const chosen=seatIds.map(id=>resources.find((o:any)=>o.id===id));
 if(chosen.some(o=>!o))return json({error:'Có ghế không còn mở đặt riêng. Chọn lại ghế lẻ hoặc Bàn 7 trên sơ đồ.'},409);
 if(chosen.length>1&&chosen.some(o=>o.capacity!==1))return json({error:'Bàn 7 được đặt riêng nguyên 6 chỗ; không ghép với ghế lẻ.'},400);
 const capacity=chosen.reduce((sum,o)=>sum+o.capacity,0);
 if(b.attendees!==capacity)return json({error:'Số chỗ phải đúng với toàn bộ ghế đã chọn ('+capacity+' chỗ).'},400);
 const conflictIds=[...new Set(chosen.flatMap(o=>[o.id,...o.members]))];
 const name=chosen.map(o=>o.capacity===6?o.label:o.code).join('; ');
 const resourceRevision=Number(space.revision),buffer=config.policy.bufferMinutes;

 // Check every occurrence before inserting any row. The Edge Function holds a transaction lock,
 // so this preflight and the following inserts are atomic with respect to other booking requests.
 for(const occurrence of pending){
  const placeholders=conflictIds.map(()=>'?').join(',');
  const conflict=await env.DB!.prepare(`SELECT id FROM seat_bookings WHERE EXISTS (SELECT 1 FROM json_each(COALESCE(seat_ids,json_array(seat_id))) held WHERE held.value IN (${placeholders})) AND day=? AND status='active' AND COALESCE(start_minute,start_slot*30) < ? AND COALESCE(end_minute,end_slot*30) > ? LIMIT 1`).bind(...conflictIds,occurrence.day,occurrence.endMinute+buffer,occurrence.startMinute-buffer).first();
  if(conflict)return json({error:conflictMessage,conflictDay:occurrence.day},409);
 }

 const statements=pending.map(occurrence=>{
  const columns='id,user_id,seat_id,seat_label,day,start_slot,end_slot,display_name,organization,status,created_at,email,phone,leader,subject,description,group_type,attendees,resource_type,campus,start_minute,end_minute,seat_ids';
  const values=[occurrence.requestId,u.userId,b.seatId,name,occurrence.day,occurrence.startMinute/30,occurrence.endMinute/30,b.displayName.trim(),b.organization.trim(),'pending',new Date().toISOString(),b.email.trim(),b.phone.trim(),b.leader.trim(),b.subject.trim(),b.description.trim(),b.groupType,b.attendees,type,'Cơ sở B · 279 Nguyễn Tri Phương · Tầng 15',occurrence.startMinute,occurrence.endMinute,JSON.stringify(seatIds)];
  const placeholders=conflictIds.map(()=>'?').join(',');
  const query=`INSERT INTO seat_bookings (${columns}) SELECT ${values.map(()=>'?').join(',')} WHERE EXISTS (SELECT 1 FROM booking_settings WHERE id='main' AND revision=?) AND EXISTS (SELECT 1 FROM spatial_spaces WHERE id='main' AND revision=?) AND NOT EXISTS (SELECT 1 FROM seat_bookings WHERE EXISTS (SELECT 1 FROM json_each(COALESCE(seat_ids,json_array(seat_id))) held WHERE held.value IN (${placeholders})) AND day=? AND status='active' AND COALESCE(start_minute,start_slot*30) < ? AND COALESCE(end_minute,end_slot*30) > ?)`;
  return env.DB!.prepare(query).bind(...values,config.revision,resourceRevision,...conflictIds,occurrence.day,occurrence.endMinute+buffer,occurrence.startMinute-buffer);
 });
 const results=await env.DB!.batch(statements);
 if(results.some((result:any)=>Number(result.meta?.changes)!==1))throw new Error('BOOKING_CONFLICT');
 return json({ok:true,id:occurrences[0].requestId,status:'pending',count:occurrences.length,created:pending.length});
}
