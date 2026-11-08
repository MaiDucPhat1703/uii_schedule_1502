import {env} from '../../../runtime.ts';
import {getAdmin} from '../../../admin-auth';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!await getAdmin(request))return Response.json({error:'Vui lòng đăng nhập admin.'},{status:401,headers:{'Cache-Control':'no-store'}});
 const names=['spatial_layouts','spatial_spaces','booking_settings','meeting_rooms','seat_bookings','seat_claims'];
 const results=await env.DB!.batch(names.map(name=>env.DB!.prepare('SELECT * FROM '+name)));
 const tables=Object.fromEntries(names.map((name,i)=>[name,results[i].results]));
 return Response.json({format:'uii-booking-backup',version:1,exportedAt:new Date().toISOString(),tables},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'attachment; filename="uii-backup-'+new Date().toISOString().slice(0,10)+'.json"'}});
}
