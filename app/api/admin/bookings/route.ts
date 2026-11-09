import {env} from '../../../runtime.ts';
import {getAdmin,sameOrigin} from '../../../admin-auth';
import {settings,policyError,dayValid} from '../../../booking-policy';
import {bookingResources} from '../../../../public/booking/resources';
export const dynamic='force-dynamic';
const json=(b:unknown,s=200)=>Response.json(b,{status:s,headers:{'Cache-Control':'no-store'}});
const editToken=(row:any)=>JSON.stringify(Object.fromEntries(Object.entries(row).filter(([k])=>k!=='edit_token').sort(([a],[b])=>a.localeCompare(b))));
export async function GET(r:Request){
 if(!await getAdmin(r))return json({error:'Vui lòng đăng nhập admin.'},401);
 const url=new URL(r.url),day=url.searchParams.get('day'),status=url.searchParams.get('status'),query=(url.searchParams.get('search')||'').trim().toLowerCase();
 const offset=Number(url.searchParams.get('offset')||0),limit=100;
 if(!Number.isSafeInteger(offset)||offset<0||query.length>255||day&&!dayValid(day)||status&&!['pending','active','rejected','cancelled'].includes(status))return json({error:'Bộ lọc không hợp lệ.'},400);
 const conditions=["resource_type='seat'"],args:any[]=[];
 if(day){conditions.push('day=?');args.push(day)}
 if(status){conditions.push('status=?');args.push(status)}
 if(query){conditions.push("position(? in lower(concat_ws(' ',display_name,organization,seat_label,subject,email,phone,id)))>0");args.push(query)}
 const rows=await env.DB!.prepare('SELECT * FROM seat_bookings WHERE '+conditions.join(' AND ')+' ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?').bind(...args,limit+1,offset).all();
 const totals=await env.DB!.prepare("SELECT status,COUNT(*) n FROM seat_bookings WHERE resource_type='seat' GROUP BY status").all();
 return json({bookings:rows.results.slice(0,limit).map((b:any)=>({...b,edit_token:editToken(b)})),totals:totals.results,offset,limit,hasMore:rows.results.length>limit});
}
export async function POST(r:Request){if(!await getAdmin(r))return json({error:'Vui lòng đăng nhập admin.'},401);if(!sameOrigin(r))return json({error:'Yêu cầu không hợp lệ.'},403);let b:any;try{b=await r.json()}catch{return json({error:'Dữ liệu không hợp lệ.'},400)}if(typeof b?.id!=='string'||(b.note!==undefined&&(typeof b.note!=='string'||b.note.length>1000))||!['approve','edit','reject','cancel'].includes(b.action))return json({error:'Thao tác không hợp lệ.'},400);
 const current=await env.DB!.prepare("SELECT * FROM seat_bookings WHERE id=? AND resource_type='seat'").bind(b.id).first();if(!current)return json({error:'Không tìm thấy yêu cầu.'},404);if(b.expectedToken&&b.expectedToken!==editToken(current))return json({error:'Yêu cầu đã được thay đổi. Đóng biểu mẫu và tải lại trước khi xử lý.'},409);
 if(b.action==='edit'||b.action==='approve'){
 if(b.action==='approve'&&current.status!=='pending')return json({error:'Yêu cầu không còn chờ xử lý.'},409);
 const ids:any[]=b.action==='edit'?b.seatIds:(current.seat_ids?JSON.parse(current.seat_ids as string):[current.seat_id]);if(!Array.isArray(ids)||!ids.length||ids.length>36||ids.some(id=>typeof id!=='string'||id.length>100)||new Set(ids).size!==ids.length)return json({error:'Chọn từ 1 đến 36 chỗ khác nhau.'},400);
 const seatIds=[...ids].sort(),space=await env.DB!.prepare("SELECT data,revision FROM spatial_spaces WHERE id='main'").first(),resources=space?bookingResources(JSON.parse(space.data as string)):[],chosen=seatIds.map(id=>resources.find((o:any)=>o.id===id));if(chosen.some(o=>!o)||chosen.length>1&&chosen.some(o=>o.capacity!==1))return json({error:'Chọn ghế đang mở; Bàn 7 phải đăng ký riêng nguyên cụm.'},400);
 const fields=b.action==='edit'?b:{day:current.day,startMinute:current.start_minute??Number(current.start_slot)*30,endMinute:current.end_minute??Number(current.end_slot)*30};
 if(!dayValid(fields.day))return json({error:'Ngày không hợp lệ.'},400);
 const unchanged=fields.day===current.day&&fields.startMinute===(current.start_minute??Number(current.start_slot)*30)&&fields.endMinute===(current.end_minute??Number(current.end_slot)*30)&&JSON.stringify(seatIds)===JSON.stringify((current.seat_ids?JSON.parse(current.seat_ids as string):[current.seat_id]).sort());
 const cfg=await settings();if(b.action==='approve'||!unchanged){const error=policyError({...cfg.policy,seatsOpen:true},fields.day,fields.startMinute,fields.endMinute,'seat');if(error)return json({error},400)}
 const conflicts=[...new Set(chosen.flatMap(o=>[o.id,...o.members]))];const snapshotKeys=Object.keys(current).filter(k=>k!=='id'),guard=snapshotKeys.map(k=>`${k} IS ?`).join(' AND '),snapshotValues=snapshotKeys.map(k=>current[k]);
 let assignments:string,values:any[];
 if(b.action==='edit'){
 for(const [key,max] of [['displayName',255],['organization',255],['email',255],['phone',20],['leader',255],['subject',255]] as const)if(typeof b[key]!=='string'||!b[key].trim()||b[key].length>max)return json({error:'Điền đầy đủ họ tên, đơn vị, email, điện thoại, người phụ trách và mục đích.'},400);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)||!/^\+?[\d\s().-]{8,20}$/.test(b.phone)||typeof b.description!=='string'||b.description.length>2000||!['startup','faculty','staff','other'].includes(b.groupType)||typeof b.adminNote!=='string'||b.adminNote.length>1000)return json({error:'Thông tin liên hệ, nhóm hoặc ghi chú không hợp lệ.'},400);
 const changes:any={day:b.day,start_minute:b.startMinute,end_minute:b.endMinute,start_slot:b.startMinute/30,end_slot:b.endMinute/30,seat_id:seatIds[0],seat_ids:JSON.stringify(seatIds),seat_label:chosen.map(o=>o.capacity===6?o.label:o.code).join('; '),attendees:chosen.reduce((n,o)=>n+o.capacity,0),display_name:b.displayName.trim(),organization:b.organization.trim(),email:b.email.trim(),phone:b.phone.trim(),leader:b.leader.trim(),subject:b.subject.trim(),description:b.description.trim(),group_type:b.groupType,admin_note:b.adminNote.trim()};assignments=Object.keys(changes).map(k=>`${k}=?`).join(',');values=Object.values(changes);
 }else{assignments="status='active',admin_note=?";values=[b.note||'']}
 const checkOverlap=b.action==='approve'||current.status==='active'||current.status==='pending'&&!unchanged;
 const overlap=checkOverlap?` AND NOT EXISTS (SELECT 1 FROM seat_bookings other WHERE other.id<>? AND other.status='active' AND other.day=? AND EXISTS (SELECT 1 FROM json_each(COALESCE(other.seat_ids,json_array(other.seat_id))) held WHERE held.value IN (${conflicts.map(()=>'?').join(',')})) AND COALESCE(other.start_minute,other.start_slot*30)<? AND COALESCE(other.end_minute,other.end_slot*30)>?)`:'';
 const overlapArgs=checkOverlap?[b.id,fields.day,...conflicts,fields.endMinute+cfg.policy.bufferMinutes,fields.startMinute-cfg.policy.bufferMinutes]:[];
 const result=await env.DB!.prepare(`UPDATE seat_bookings SET ${assignments} WHERE id=? AND ${guard} AND EXISTS (SELECT 1 FROM spatial_spaces WHERE id='main' AND revision=?) AND EXISTS (SELECT 1 FROM booking_settings WHERE id='main' AND revision=?)${overlap}`).bind(...values,b.id,...snapshotValues,Number(space!.revision),cfg.revision,...overlapArgs).run();if(!result.meta.changes)return json({error:'Có lịch đã duyệt trùng giờ hoặc dữ liệu vừa thay đổi. Chưa lưu thay đổi; hãy tải lại.'},409);
 }else{const allowed=b.action==='reject'?"'pending'":"'pending','active'",status=b.action==='reject'?'rejected':'cancelled';const results=await env.DB!.batch([env.DB!.prepare('DELETE FROM seat_claims WHERE booking_id=? AND EXISTS (SELECT 1 FROM seat_bookings WHERE id=? AND status IN ('+allowed+'))').bind(b.id,b.id),env.DB!.prepare('UPDATE seat_bookings SET status=?,admin_note=? WHERE id=? AND status IN ('+allowed+')').bind(status,b.note||'',b.id)]);if(!results[1].meta.changes)return json({error:'Lượt đặt đã được xử lý. Hãy cập nhật danh sách.'},409);}
 return json({ok:true});}
