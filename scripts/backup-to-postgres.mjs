import {readFile,writeFile,mkdir} from 'node:fs/promises';import {dirname,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {PGlite} from '@electric-sql/pglite';
export const TABLES=['spatial_layouts','spatial_spaces','booking_settings','meeting_rooms','seat_bookings','seat_claims'];
const literal=v=>{if(v===null)return 'NULL';if(typeof v==='number'&&Number.isFinite(v))return String(v);if(typeof v==='string'&&!v.includes('\0'))return "'"+v.replace(/'/g,"''")+"'";throw Error('Giá trị trong bản sao không hợp lệ.')};
export async function convertBackup(backup){
 if(backup?.format!=='uii-booking-backup'||backup.version!==1||!backup.tables||Object.keys(backup.tables).some(n=>!TABLES.includes(n))||TABLES.some(n=>!Array.isArray(backup.tables[n])))throw Error('Bản sao không đúng định dạng hoặc thiếu bảng.');
 const db=new PGlite(),counts={},statements=['-- Import ONLY into a new, empty UII schema after running the initial migration.','BEGIN;','SET LOCAL standard_conforming_strings = on;'];
 try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);');await db.exec(await readFile(new URL('../supabase/migrations/202611080001_initial.sql',import.meta.url),'utf8'));
 for(const name of TABLES){const allowed=(await db.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',['uii',name])).rows.map(r=>r.column_name);counts[name]=backup.tables[name].length;
 for(const row of backup.tables[name]){if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Dòng không hợp lệ.');const cols=Object.keys(row);if(!cols.length||cols.some(c=>!allowed.includes(c)))throw Error('Cột không hợp lệ trong '+name);const values=cols.map(c=>row[c]);values.forEach(literal);const head='INSERT INTO uii."'+name+'" ('+cols.map(c=>'"'+c+'"').join(',')+') VALUES (';
 await db.query(head+values.map((_,i)=>'$'+(i+1)).join(',')+')',values);statements.push(head+values.map(literal).join(',')+');');}}
 statements.push('COMMIT;');return {sql:statements.join('\n')+'\n',counts};
 }finally{await db.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const input=process.argv[2],output=process.argv[3]||'backups/import-supabase.sql';if(!input)throw Error('Dùng: npm run backup:sql -- backups/backup.json backups/import-supabase.sql');const {sql,counts}=await convertBackup(JSON.parse(await readFile(input,'utf8')));await mkdir(dirname(output),{recursive:true});await writeFile(output,sql,{flag:'wx',mode:0o600});console.table(counts);console.log('Đã tạo '+output+'. Chỉ nhập vào database mới còn trống.');}
