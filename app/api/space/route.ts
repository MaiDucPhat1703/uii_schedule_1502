import {layoutValid} from '../../layout-validation';
import {bookingResources,MEETING_TABLE} from '../../../public/booking/resources';
import {env} from '../../runtime.ts';
import {getAdmin} from '../../admin-auth';
export const dynamic='force-dynamic';
const json=(b:unknown,s=200)=>Response.json(b,{status:s,headers:{'Cache-Control':'no-store'}});
export async function GET(r:Request){const u=await getAdmin(r);const row=await env.DB!.prepare('SELECT * FROM spatial_spaces WHERE id = ?').bind('main').first();return json({space:row?{name:row.name,data:JSON.parse(row.data as string),revision:row.revision,updatedAt:row.updated_at}:null,isAdmin:!!u});}
export async function POST(r:Request){
 const u=await getAdmin(r);if(!u)return json({error:'Vui lòng đăng nhập.'},401);if(r.headers.get('origin')&&r.headers.get('origin')!==new URL(r.url).origin)return json({error:'Yêu cầu không hợp lệ.'},403);
 let b:any;try{b=await r.json()}catch{return json({error:'Dữ liệu không hợp lệ.'},400)}
 if(!b?.data||b.data.version!==1||!Array.isArray(b.data.objects)||b.data.objects.length>2000||JSON.stringify(b.data).length>2000000||typeof b.name!=='string'||b.name.length>120)return json({error:'Sơ đồ không hợp lệ.'},400);
 if(!layoutValid(b.data))return json({error:'Thông số hoặc thông tin vật thể không hợp lệ.'},400);
 const row=await env.DB!.prepare('SELECT owner_id, revision FROM spatial_spaces WHERE id = ?').bind('main').first();
 const resources=bookingResources(b.data);const future=await env.DB!.prepare("SELECT DISTINCT held.value seat_id FROM seat_bookings c,json_each(COALESCE(c.seat_ids,json_array(c.seat_id))) held WHERE c.resource_type='seat' AND c.status IN ('pending','active') AND c.day>=?").bind(new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'})).all();if(future.results.some((r:any)=>!resources.some((o:any)=>o.id===r.seat_id||o.members.includes(r.seat_id))))return json({error:'Giữ nguyên các ghế / cụm có đăng ký sắp tới trước khi áp dụng.'},409);
 const data=JSON.stringify(b.data),now=new Date().toISOString(),today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
 if(!row){const result=await env.DB!.prepare('INSERT INTO spatial_spaces (id,owner_id,name,data,revision,updated_at) VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT(id) DO NOTHING').bind('main',u.userId,b.name,data,now).run();if(!result.meta.changes)return json({error:'Sơ đồ đã được tạo. Hãy tải lại trước khi áp dụng.'},409);}
 else {const result=await env.DB!.prepare("UPDATE spatial_spaces SET name = ?, data = ?, revision = revision + 1, updated_at = ? WHERE id = 'main' AND revision = ? AND NOT EXISTS (SELECT 1 FROM seat_bookings c,json_each(COALESCE(c.seat_ids,json_array(c.seat_id))) held WHERE c.resource_type='seat' AND c.status IN ('pending','active') AND c.day >= ? AND NOT EXISTS (SELECT 1 FROM json_each(?) allowed WHERE allowed.value = held.value))").bind(b.name,data,now,b.revision,today,JSON.stringify(resources.flatMap((o:any)=>[o.id,...o.members]))).run();if(!result.meta.changes)return json({error:'Sơ đồ đã thay đổi hoặc bạn đang xóa ghế có lượt đặt sắp tới. Hãy tải lại / giữ ghế đã được đặt.'},409);}
 return json({ok:true});
}
