export function visibleToRoot(object){for(let o=object;o;o=o.parent)if(!o.visible)return false;return true}
export function pickItem(ray,items,{kind='',seatsOnly=false}={}){
 const candidates=items.filter(i=>!i.deleted&&visibleToRoot(i.object)&&(!kind||i.kind===kind)&&(!seatsOnly||i.kind==='chair'));
 const owners=new Map(),meshes=[];
 for(const item of candidates)item.object.traverse(o=>{if(!o.isMesh||!visibleToRoot(o))return;const material=Array.isArray(o.material)?o.material[0]:o.material;if(item.kind==='glass'&&kind!=='glass'&&material?.transparent)return;owners.set(o,item);meshes.push(o)});
 const hits=ray.intersectObjects(meshes,false);return hits.length?owners.get(hits[0].object):null;
}
export function clipboardRecord(item){return {format:'uii-object-v1',source:item.source||item.id,label:item.label,bookable:!!item.bookable,position:item.object.position.toArray(),rotation:item.object.rotation.toArray().slice(0,3),scale:item.object.scale.toArray(),...(item.color?{color:item.color}:{})}}
export function parseClipboard(text,templates){let data;try{data=JSON.parse(text)}catch{return null}if(data?.format!=='uii-object-v1'||!templates.has(data.source)||!['position','rotation','scale'].every(k=>Array.isArray(data[k])&&data[k].length===3&&data[k].every(v=>Number.isFinite(v)&&Math.abs(v)<10000))||data.scale.some(v=>v<=0||v>1000))return null;return data}
export function toggleSelection(set,item,toggle=false,preserve=false){if(!item){set.clear();return}if(toggle){set.has(item)?set.delete(item):set.add(item)}else if(!preserve||!set.has(item)){set.clear();set.add(item)}}
export function selectionCenter(items){if(!items.length)return [0,0,0];return [0,1,2].map(axis=>items.reduce((sum,i)=>sum+i.object.position.toArray()[axis],0)/items.length)}
export function parseObjectClipboard(text,templates){let data;try{data=JSON.parse(text)}catch{return null}if(data?.format==='uii-object-v1'){const one=parseClipboard(text,templates);return one?[one]:null}if(data?.format!=='uii-objects-v1'||!Array.isArray(data.objects)||data.objects.length<1||data.objects.length>500)return null;const records=data.objects.map(o=>parseClipboard(JSON.stringify(o),templates));return records.every(Boolean)?records:null;}
export function translateSelection(items,axis,value){const index={x:0,y:1,z:2}[axis],delta=value-selectionCenter(items)[index];for(const i of items)i.object.position[axis]+=delta;}
export function rotateSelection(items,angle){const [x,,z]=selectionCenter(items),c=Math.cos(angle),s=Math.sin(angle);for(const i of items){const dx=i.object.position.x-x,dz=i.object.position.z-z;i.object.position.x=x+dx*c+dz*s;i.object.position.z=z-dx*s+dz*c;i.object.rotation.y+=angle;}}
