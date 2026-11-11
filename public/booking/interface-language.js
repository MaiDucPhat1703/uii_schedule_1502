export function createInterfaceLanguage(storageKey, english){
 let language = 'vi';
 try {
  if(localStorage.getItem(storageKey)==='en')language='en';
 }catch{}

 const current=()=>language;
 function t(key, values={}){
  const message=language==='en'&&Object.hasOwn(english,key)?english[key]:key;
  return String(message??'').replace(/\{(\w+)\}/g,(token,name)=>values[name]??token);
 }

 const copy=[];
 function capture(root){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
   const node=walker.currentNode,source=node.nodeValue,key=source.trim();
   if(!Object.hasOwn(english,key))continue;
   copy.push(()=>{node.nodeValue=source.replace(key,()=>t(key))});
  }
  for(const node of root.querySelectorAll('[aria-label],[title],[placeholder],[alt]')){
   for(const attr of ['aria-label','title','placeholder','alt']){
    const key=node.getAttribute(attr);
    if(Object.hasOwn(english,key))copy.push(()=>node.setAttribute(attr,t(key)));
   }
  }
 }
 function apply(){
  document.documentElement.lang=language;
  for(const update of copy)update();
 }
 function toggle(){
  language=language==='vi'?'en':'vi';
  try{localStorage.setItem(storageKey,language)}catch{}
  apply();
 }

 // Translate generated table and seat labels without changing stored names.
 function seatDetail(text){
  const seat=/^Ghế (\d+(?:, \d+)*)$/.exec(text);
  return seat?t('Ghế {number}',{number:seat[1]}):t(text);
 }
 function seatLabel(label){
  if(language==='vi')return label;
  return String(label??'').split('\n').map(line=>{
   const match=/^Bàn (\d+)(?: · (.*))?$/.exec(line);
   if(!match)return seatDetail(line);
   const [,number,detail]=match;
   return t('Bàn {number}',{number})+(detail?' · '+seatDetail(detail):'');
  }).join('\n');
 }
 return {current,t,capture,apply,toggle,seatLabel};
}
