// Validate stored metadata too: malformed labels must not break the public map.
export function layoutValid(data:any):boolean{
 if(!data||data.version!==1||!Array.isArray(data.objects)||data.objects.length>2000)return false;
 const ids=new Set<string>();
 for(const o of data.objects){
  if(!o||typeof o.id!=='string'||!o.id.length||o.id.length>100||ids.has(o.id))return false;
  if(!['position','rotation','scale'].every(k=>Array.isArray(o[k])&&o[k].length===3&&o[k].every((v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<10000))||o.scale.some((v:number)=>v<=0||v>1000))return false;
  if(o.label!==undefined&&(typeof o.label!=='string'||o.label.length>100))return false;
  if(o.source!==undefined&&(typeof o.source!=='string'||!o.source.length||o.source.length>100))return false;
  if(['bookable','deleted'].some(k=>o[k]!==undefined&&typeof o[k]!=='boolean'))return false;
  if(o.color!=null&&(typeof o.color!=='string'||!/^#[a-f0-9]{6}$/i.test(o.color)))return false;
  ids.add(o.id);
 }
 return true;
}
