// Present old stored labels and current selections consistently, without changing booking IDs.
export function placeGroups(value){
 const items=Array.isArray(value)?value.map(s=>s.code+(s.capacity===6?' · 6 chỗ':'')):String(value||'').split(/;\s*/);
 const tables=new Map(),other=new Set();
 for(const raw of items){const text=raw.trim(),m=text.match(/^Bàn\s+(\d+)\s*·\s*Ghế\s+(\d+)$/i),whole=text.match(/^Bàn\s+(\d+)(?:\s*·\s*(?:Cả\s*)?6\s*chỗ)?$/i);
  if(m){const n=Number(m[1]);if(!tables.has(n))tables.set(n,{whole:false,seats:new Set()});tables.get(n).seats.add(Number(m[2]));}
  else if(whole){const n=Number(whole[1]);if(!tables.has(n))tables.set(n,{whole:false,seats:new Set()});tables.get(n).whole=true;}
  else if(text)other.add(text);
 }
 return [...tables].sort(([a],[b])=>a-b).map(([n,g])=>({title:'Bàn '+n,detail:g.whole?'Nguyên bàn · 6 chỗ':g.seats.size===6&&[1,2,3,4,5,6].every(i=>g.seats.has(i))?'Cả 6 ghế':'Ghế '+[...g.seats].sort((a,b)=>a-b).map(i=>String(i).padStart(2,'0')).join(', ')})).concat([...other].map(title=>({title,detail:''})));
}
export const placeSummary=value=>placeGroups(value).map(g=>g.title+(g.detail?' · '+g.detail:'')).join('\n');
