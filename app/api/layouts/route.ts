import {layoutValid} from '../../layout-validation';
import { env } from '../../runtime.ts';
import { getAdmin } from '../../admin-auth';
export const dynamic = 'force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 const user=await getAdmin(request);if(!user)return json({error:'Bạn cần đăng nhập để mở bản lưu.'},401);
 const id=new URL(request.url).searchParams.get('id');
 if(id){const row=await env.DB!.prepare('SELECT * FROM spatial_layouts WHERE id = ?').bind(id).first();if(!row)return json({error:'Không tìm thấy bản lưu.'},404);return json({...row,data:JSON.parse(row.data as string)});}
 const rows=await env.DB!.prepare('SELECT id, name, revision, updated_at FROM spatial_layouts ORDER BY updated_at DESC LIMIT 100').all();return json({layouts:rows.results});
}
export async function POST(request:Request){
 const user=await getAdmin(request);if(!user)return json({error:'Bạn cần đăng nhập để lưu.'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Yêu cầu không hợp lệ.'},403);
 let b:any;try{if(Number(request.headers.get('content-length')||0)>2000000)return json({error:'Bản lưu quá lớn.'},413);b=await request.json()}catch{return json({error:'Dữ liệu không hợp lệ.'},400)}
 if(!b||typeof b.name!=='string'||!b.name.trim()||b.name.length>120||!b.data||b.data.version!==1||!Array.isArray(b.data.objects)||b.data.objects.length>2000)return json({error:'Dữ liệu bản vẽ không hợp lệ.'},400);
 if(!layoutValid(b.data))return json({error:'Thông số hoặc thông tin vật thể không hợp lệ.'},400);
 const data=JSON.stringify(b.data);if(data.length>2000000)return json({error:'Bản lưu quá lớn.'},413);
 const now=new Date().toISOString(),id=typeof b.id==='string'?b.id:crypto.randomUUID();
 if(b.id){const changed=await env.DB!.prepare('UPDATE spatial_layouts SET name = ?, data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?').bind(b.name.trim(),data,now,id,b.revision).run();if(!changed.meta.changes)return json({error:'Bản vẽ đã thay đổi ở nơi khác. Hãy lưu thành bản mới để giữ thay đổi của bạn.'},409);}
 else await env.DB!.prepare('INSERT INTO spatial_layouts (id, owner_id, name, data, revision, updated_at) VALUES (?, ?, ?, ?, 1, ?)').bind(id,user.userId,b.name.trim(),data,now).run();
 const row=await env.DB!.prepare('SELECT id, name, revision, updated_at FROM spatial_layouts WHERE id = ?').bind(id).first();return json(row);
}
