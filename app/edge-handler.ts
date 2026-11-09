import {context} from './runtime.ts';import {database} from './postgres-adapter.ts';
import * as auth from './api/admin/auth/route.ts';import * as bookings from './api/bookings/route.ts';import * as admin from './api/admin/bookings/route.ts';import * as backup from './api/admin/backup/route.ts';import * as layouts from './api/layouts/route.ts';import * as space from './api/space/route.ts';import * as settings from './api/settings/route.ts';import * as rooms from './api/rooms/route.ts';
const routes:Record<string,any>={'/api/admin/auth':auth,'/api/bookings':bookings,'/api/admin/bookings':admin,'/api/admin/backup':backup,'/api/layouts':layouts,'/api/space':space,'/api/settings':settings,'/api/rooms':rooms};
export function createHandler(transaction:any,config:Record<string,string>){return async(request:Request)=>{
 const origin=request.headers.get('origin'),allowed=config.ALLOWED_ORIGIN;
 const headers:Record<string,string>={'Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
 if(origin!==allowed)return Response.json({error:'Nguồn truy cập không hợp lệ.'},{status:403,headers});
 Object.assign(headers,{'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-visitor-token','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Expose-Headers':'x-visitor-token, content-disposition'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const url=new URL(request.url),path=url.searchParams.get('route')||'',module=routes[path],fn=module?.[request.method];
 if(!fn)return Response.json({error:'Không tìm thấy chức năng.'},{status:module?405:404,headers});
 if(Number(request.headers.get('content-length')||0)>2100000)return Response.json({error:'Dữ liệu quá lớn.'},{status:413,headers});
 try{
 const body=request.method==='GET'?undefined:await request.text();if(body&&body.length>2100000)return Response.json({error:'Dữ liệu quá lớn.'},{status:413,headers});
 url.searchParams.delete('route');const internal=new URL(allowed);internal.pathname=path;internal.search=url.search;
 const normalized=new Request(internal,{method:request.method,headers:request.headers,body});
 return await transaction(async(client:any)=>{
 // All reads/writes of this small booking system share a transaction lock. Approval,
 // layout changes and overlap checks therefore remain atomic across concurrent calls.
 await client.unsafe('SET LOCAL search_path TO uii, pg_temp');await client.unsafe('SELECT pg_advisory_xact_lock(15021502)');
 const state={...config,DB:database(client)};return context.run(state,async()=>{const result:Response=await fn(normalized);const h=new Headers(result.headers);for(const [k,v]of Object.entries(headers))h.set(k,v);if((state as any).visitorToken)h.set('x-visitor-token',(state as any).visitorToken);h.delete('set-cookie');return new Response(result.body,{status:result.status,headers:h})});
 });
 }catch(e){const message=String((e as any)?.message||'');if(message==='BOOKING_CONFLICT')return Response.json({error:'Có lượt vừa được đặt hoặc cấu hình đã thay đổi. Chưa lưu chuỗi đặt lặp; hãy tải lại và thử lại.'},{status:409,headers});console.error('UII API failed',request.method,path,(e as any)?.code||'error');return Response.json({error:'Chưa xử lý được yêu cầu. Kiểm tra cấu hình Supabase và thử lại.'},{status:500,headers})}
}}
