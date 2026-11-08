import postgres from 'npm:postgres@3.4.7';
import {createHandler} from '../app/edge-handler.ts';
const get=(key:string)=>{const v=Deno.env.get(key);if(!v)throw Error('Missing '+key);return v};
const sql=postgres(get('SUPABASE_DB_URL'),{prepare:false,max:3,idle_timeout:20,connect_timeout:10,ssl:'require'});
const config={SUPABASE_URL:get('SUPABASE_URL'),SUPABASE_ANON_KEY:get('SUPABASE_ANON_KEY'),ALLOWED_ORIGIN:get('ALLOWED_ORIGIN'),VISITOR_SECRET:get('VISITOR_SECRET')};
Deno.serve(createHandler((fn:any)=>sql.begin(fn),config));
