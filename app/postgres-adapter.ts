// Only server-owned SQL from app/api is accepted. This adapter is never exposed as an API.
export function postgresSQL(source:string){
 let sql=source.replace(/`([^`]+)`/g,'"$1"').replace(/\bIS\s+\?/g,'IS NOT DISTINCT FROM ?');
 // SQLite JSON arrays are stored as text to preserve existing backups and edit tokens.
 sql=sql.replace(/json_array\(([^()]+)\)/g,'jsonb_build_array($1)::text');
 let pos=0;
 while((pos=sql.indexOf('json_each(',pos))!==-1){let i=pos+10,depth=1,quote=false;for(;i<sql.length;i++){if(sql[i]==="'"){if(quote&&sql[i+1]==="'"){i++;continue}quote=!quote}if(!quote){if(sql[i]==='(')depth++;if(sql[i]===')'&&--depth===0)break}}
 const expression=sql.slice(pos+10,i);const replacement='jsonb_array_elements_text(('+expression+')::jsonb)';sql=sql.slice(0,pos)+replacement+sql.slice(i+1);pos+=replacement.length;}
 sql=sql.replace(/\)\s+(startMinute|endMinute)\b/g,') AS "$1"');
 let n=0,quoted=false,result='';for(let i=0;i<sql.length;i++){const c=sql[i];if(c==="'"){if(quoted&&sql[i+1]==="'"){result+="''";i++;continue}quoted=!quoted}result+=c==='?'&&!quoted?'$'+(++n):c}return result;
}
export function database(client:any){
 class Statement{args:any[]=[];constructor(public source:string){}bind(...args:any[]){this.args=args;return this}async all(){const rows=await client.unsafe(postgresSQL(this.source),this.args);return {results:Array.from(rows),meta:{changes:rows.count??rows.length}}}async first(){return (await this.all()).results[0]??null}async run(){return this.all()}}
 return {prepare:(sql:string)=>new Statement(sql),batch:async(items:Statement[])=>{const results=[];for(const item of items)results.push(await item.all());return results}};
}
