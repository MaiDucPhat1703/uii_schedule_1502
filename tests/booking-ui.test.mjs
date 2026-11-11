// DOM-level workflow test. Browser layout and real pointer hardware are separate QA.
import assert from 'node:assert/strict';import fs from 'node:fs';import {pathToFileURL} from 'node:url';import {buildModel} from '../public/studio/model.js';import {bookingResources,MEETING_TABLE} from '../public/booking/resources.js';
class Element{constructor(tag='div'){this.tagName=tag;this.children=[];this.style={};this.attrs={};this.value='';this.hidden=false;this.checked=false;this.className='';this.textContent='';this.classList={toggle(){}};this.open=false}append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=[...nodes]}setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]}add(node){this.children.push(node);if(!this.value)this.value=String(node.value)}addEventListener(){}querySelector(){return new Element()}scrollIntoView(){}getBoundingClientRect(){return {left:0,width:600}}setPointerCapture(){}hasPointerCapture(){return true}releasePointerCapture(){}remove(){}showModal(){this.open=true}close(){this.open=false}}
const html=fs.readFileSync('public/booking/index.html','utf8'),nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
const staticCopy={nodeValue:'Lịch chỗ ngồi'},languagePreference=new Map();
globalThis.NodeFilter={SHOW_TEXT:4};
globalThis.document={documentElement:Object.assign(new Element('html'),{querySelectorAll:()=>[]}),createTreeWalker:()=>{let found=false;return {currentNode:staticCopy,nextNode(){if(found)return false;found=true;return true}}},hidden:false,getElementById:id=>{assert.ok(nodes.has(id),'missing HTML target '+id);return nodes.get(id)},createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),createTextNode:text=>({textContent:text}),querySelectorAll:()=>[],addEventListener(){}};globalThis.Option=class{constructor(text,value){this.text=text;this.value=value}};globalThis.innerWidth=1280;globalThis.localStorage={getItem:key=>languagePreference.get(key),setItem:(key,value)=>languagePreference.set(key,value)};
const interval=globalThis.setInterval,timeout=globalThis.setTimeout;globalThis.setInterval=()=>0;globalThis.setTimeout=()=>0;
const model=buildModel();const objects=model.editItems.map(i=>({id:i.id,label:i.label,position:i.object.position.toArray(),rotation:i.object.rotation.toArray().slice(0,3),scale:i.object.scale.toArray(),bookable:i.kind==='chair'&&Number(i.id.slice(6))>=33&&Number(i.id.slice(6))<=68,deleted:false}));
objects.push({id:MEETING_TABLE,source:'hex-3',position:[14,0,-6],rotation:[0,0,0],scale:[1,1,1],bookable:false});for(let i=0;i<6;i++)objects.push({id:'meeting-'+i,source:'chair-'+(45+i),position:[14+Math.cos(i*Math.PI/3),0,-6+Math.sin(i*Math.PI/3)],rotation:[0,0,0],scale:[1,1,1],bookable:true});
let layoutRevision=1;let reservations=[];const policy={seatsOpen:true,openMinute:420,closeMinute:1260,stepMinutes:15,minMinutes:30,maxSeatMinutes:480,bufferMinutes:0,weekdays:[0,1,2,3,4,5,6],advanceDays:30};
let earlyAreaClick=false;globalThis.fetch=async path=>{if(!earlyAreaClick&&path==='/api/settings'){earlyAreaClick=true;nodes.get('meetingArea').onclick()}return ({ok:true,json:async()=>path.startsWith('/api/settings')?{policy}:path.startsWith('/api/space')?{space:{name:'Test',revision:layoutRevision,data:{version:1,objects}}}:{reservations,mine:[]}})};
try{let source=fs.readFileSync('public/booking/seats.js','utf8').replace(/from '([^']+)'/g,(_,p)=>"from '"+pathToFileURL(process.cwd()+(p.startsWith('/studio/')?'/public'+p:'/public/booking/'+p)).href+"'");await import('data:text/javascript,'+encodeURIComponent(source));
 const get=id=>nodes.get(id),all=(node)=>[node,...node.children.filter(c=>c instanceof Element).flatMap(all)];

 assert.ok(get('selectedTitle').textContent.includes('Bàn 7'),'early area click selects the meeting table after data loads');assert.equal(get('proceed').disabled,false);get('backOverview').onclick();
 assert.equal(get('overviewPanel').hidden,false);assert.equal(get('bookingWorkspace').hidden,true);get('workingArea').onclick();
 const chair=id=>all(get('mapSections')).find(n=>n.attrs['data-seat-id']===id);

 // A booking outside the requested hour must still be visible in the day overview.
 get('start').value=540;get('end').value=600;
 reservations=[{seatId:'chair-36',resourceType:'seat',startMinute:690,endMinute:1095,status:'active'}];
 get('day').value=new Date(Date.now()+2*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});await get('day').onchange();
 assert.equal(Number(get('start').value),540,'changing day preserves start time');assert.equal(Number(get('end').value),600,'changing day preserves end time');
 assert.ok(chair('chair-36').attrs.class.includes('scheduled'),'later booking is amber even when current interval is free');
 assert.ok(chair('chair-36').attrs['aria-label'].includes('11:30–18:15'));
 assert.ok(!nodes.has('daySchedule'),'redundant daily list removed');
 get('rangeView').onclick();assert.ok(chair('chair-36').attrs.class.includes('free'),'range mode checks only the requested hour');
 get('start').value=690;get('end').value=720;get('start').onchange();assert.ok(chair('chair-36').attrs.class.includes('busy'));chair('chair-36').onclick();assert.equal(get('proceed').disabled,true,'busy requested interval stays blocked');
 get('dayView').onclick();assert.ok(chair('chair-36').attrs.class.includes('scheduled'));
 get('clearSeats').onclick();reservations=[];get('start').value=420;get('end').value=480;await get('refresh').onclick();
 assert.equal(all(get('mapSections')).filter(n=>n.attrs['data-seat-id']).length,36);assert.equal(get('seatList').children.length,0,'no duplicate seat catalogue');assert.equal(get('tablePicker').children.length,0,'no table toolbar');
 get('day').value=new Date(Date.now()+86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});await get('refresh').onclick();chair('chair-36').onclick();chair('chair-35').onclick();chair('chair-42').onclick();assert.equal(get('basketItems').children.length,3,'pick across tables directly on spatial map');get('proceed').onclick();assert.equal(get('bookingModal').open,true);assert.equal(get('formSeat').textContent,'Đặt 3 chỗ ngồi');assert.equal(get('formSeats').children.length,2);assert.equal(get('formSeats').children[0].children[0].textContent,'Bàn 1');assert.equal(get('formSeats').children[0].children[1].textContent,'Ghế 01, 02');assert.equal(all(get('mapSections')).filter(n=>n.tagName==='text'&&/^Bàn [1-6]$/.test(n.textContent)).length,6,'table numbers are visible');assert.ok(!all(get('mapSections')).some(n=>n.tagName==='text'&&/ĐẶT/.test(n.textContent)),'no booking instruction on tabletops');get('closeForm').onclick();get('clearSeats').onclick();chair('chair-36').onclick();
 let track=get('selectedTimeline').children[0];const x=m=>(m-420)/840*600,event=x=>({button:0,clientX:x,pointerId:1,preventDefault(){}});track.onpointerdown(event(x(600)));track.onpointermove(event(x(720)));track.onpointerup(event(x(720)));assert.equal(Number(get('start').value),600);assert.equal(Number(get('end').value),720);
 // Adjacent bookings at 15:00 block only the chair that has a 15:00 reservation.
 chair('chair-35').onclick();
 reservations=[
  ...['chair-36','chair-35'].map(seatId=>({seatId,resourceType:'seat',startMinute:780,endMinute:900,status:'active',booker:{name:'Khách mẫu',email:'khach@example.test',phone:'0900001234',purpose:'Họp nhóm'}})),
  {seatId:'chair-36',resourceType:'seat',startMinute:900,endMinute:960,status:'active',displayName:'Private booker',email:'private@example.test'}
 ];
 get('start').value=900;get('end').value=960;await get('refresh').onclick();
 assert.equal(get('proceed').disabled,true);assert.equal(get('seatConflicts').hidden,false);
 assert.equal(get('conflictSeats').children.length,1);assert.match(get('conflictSeats').children[0].textContent,/Ghế 01.*15:00–16:00/);
 assert.match(get('conflictFree').textContent,/Ghế 02/);
 assert.match(chair('chair-36').attrs.class,/selection-conflict/);
 const busy=get('selectedTimeline').children[0].children.find(n=>n.className==='block busy');
 busy.onclick();assert.equal(get('busyDetail').open,true);assert.match(get('busyDetailSeat').textContent,/Ghế 02/);
 assert.match(get('busyDetailTime').textContent,/13:00–15:00/);assert.equal(get('busyBookerName').textContent,'Khách mẫu');assert.equal(get('busyBookerEmail').textContent,'khach@example.test');assert.equal(get('busyBookerPhone').textContent,'0900001234');assert.equal(get('busyBookerPurpose').textContent,'Họp nhóm');assert.equal(Number(get('start').value),900);
 assert.ok(!all(get('busyDetail')).some(n=>String(n.textContent).includes('private@example.test')));
 const dialog=get('busyDetail');
 dialog.getBoundingClientRect=()=>({left:100,right:500,top:100,bottom:450});
 const inside={target:dialog,clientX:120,clientY:120},outside={target:dialog,clientX:50,clientY:120};
 dialog.onpointerdown(inside);dialog.onclick(inside);assert.equal(dialog.open,true);
 dialog.onpointerdown(inside);dialog.onclick(outside);assert.equal(dialog.open,true);
 dialog.onpointerdown(outside);dialog.onclick(outside);assert.equal(dialog.open,false);
 busy.onclick();get('closeBusyDetail').onclick();assert.equal(dialog.open,false);
 get('removeConflicts').onclick();
 assert.equal(get('basketItems').children.length,1);assert.equal(get('proceed').disabled,false);
 reservations=[];get('start').value=600;get('end').value=720;await get('refresh').onclick();
 // Every working chair faces its saved table; overview and detail share the same geometry.
 for(const resource of bookingResources({objects}).filter(r=>r.capacity===1&&r.tableId)){
  const node=chair(resource.id),table=objects.find(o=>o.id===resource.tableId),angle=Number(node.attrs.transform.match(/rotate\(([^)]+)\)/)[1])*Math.PI/180;
  const coords=node.attrs.transform.match(/translate\(([^ ]+) ([^)]+)\)/);const toward=[table.position[0]-Number(coords[1]),table.position[2]-Number(coords[2])],length=Math.hypot(...toward);
  assert.ok((-Math.sin(angle)*toward[0]+Math.cos(angle)*toward[1])/length>.999,'front faces table '+resource.id);
  const overview=all(get('overviewMap')).find(n=>n.attrs['data-object-id']===resource.id);
  assert.equal(overview.attrs.transform,node.attrs.transform,'same chair orientation/scale in overview and detail');
  assert.equal(node.children[0].attrs.width,'0.45');assert.equal(node.children[0].attrs.height,'0.43');
 }
 const overviewIds=all(get('overviewMap')).map(n=>n.attrs['data-object-id']);assert.ok(overviewIds.includes('desk-15'),'overview includes saved rectangular furniture');assert.ok(overviewIds.includes('chair-77'),'overview includes nonbookable chairs for orientation');
 const moved=objects.find(o=>o.id==='chair-39');moved.position[0]+=.3;moved.scale[0]=1.2;layoutRevision++;await get('refresh').onclick();assert.ok(chair('chair-39').attrs.transform.startsWith(`translate(${moved.position[0]} ${moved.position[2]})`),'saved chair coordinates are used exactly');assert.ok(chair('chair-39').attrs.transform.includes('scale(1.2 1)'),'saved chair scale is preserved');
 get('backOverview').onclick();get('meetingArea').onclick();assert.ok(get('summary').textContent.startsWith('0 / 6 chỗ có lịch'),'meeting summary counts six places across the whole day');assert.equal(get('selectionBasket').hidden,true);assert.equal(get('mapToolbar').hidden,false);assert.equal(typeof chair(MEETING_TABLE).onclick,'function','Bàn 7 chairs are clickable');chair(MEETING_TABLE).onclick();assert.ok(get('mapSections').children.length>0,'Bàn 7 remains visible after selection');assert.equal(get('proceed').disabled,false,'meeting table automatically selected');assert.equal(get('proceed').disabled,false);assert.ok(get('selectedTitle').textContent.includes('Bàn 7'));assert.ok(!nodes.has('bookingTerms'),'no internal approval notice on guest form');
 reservations=[{seatId:MEETING_TABLE,resourceType:'seat',startMinute:600,endMinute:720,status:'active',mine:true}];await get('refresh').onclick();assert.equal(get('proceed').disabled,true);track=get('selectedTimeline').children[0];track.onpointerdown(event(x(720)));track.onpointerup(event(x(720)));assert.equal(Number(get('start').value),720);assert.equal(get('proceed').disabled,false);
 reservations=[{seatId:MEETING_TABLE,resourceType:'seat',startMinute:600,endMinute:720,status:'pending'}];get('start').value=600;get('end').value=720;await get('refresh').onclick();assert.equal(get('proceed').disabled,false,'pending request does not hold the seat');assert.equal(get('selectedTimeline').children[0].children.filter(n=>n.className==='block busy').length,0,'pending block is absent from timeline');assert.ok(!all(get('selectedTimeline')).some(n=>(n.textContent||'').includes('duyệt')));
 console.log('PASS minimal guest interface, spatial multi-selection across tables, live layout coordinates, shared time drag, six-seat table and occupied-slot protection');

 const selectedStart=get('start').value,selectedEnd=get('end').value,selectedDay=get('day').value;
 assert.equal(document.documentElement.lang,'vi');
 get('guestLanguageToggle').onclick();
 assert.equal(document.documentElement.lang,'en');assert.equal(staticCopy.nodeValue,'Seat schedule');
 assert.equal(languagePreference.get('uii-guest-language'),'en');
 assert.match(get('selectedTitle').textContent,/Table 7/);assert.match(get('proceed').textContent,/Book 6 selected seats/);
 assert.equal(get('start').value,selectedStart);assert.equal(get('end').value,selectedEnd);assert.equal(get('day').value,selectedDay);
 assert.equal(get('proceed').disabled,false);
 get('proceed').onclick();assert.match(get('formSeat').textContent,/Book 6 seats/);assert.equal(get('repeatPreview').textContent,'One booking will be created.');get('closeForm').onclick();
 get('guestLanguageToggle').onclick();assert.equal(document.documentElement.lang,'vi');assert.equal(staticCopy.nodeValue,'Lịch chỗ ngồi');
 const originalFetch=globalThis.fetch;let finish,posts=0;
 globalThis.fetch=(path,options)=>options?.method==='POST'&&path==='/api/bookings'?(posts++,new Promise(resolve=>finish=resolve)):originalFetch(path,options);
 get('proceed').onclick();const submission=get('bookingForm').onsubmit({preventDefault(){}});
 assert.equal(get('bookingFields').disabled,true,'freeze the captured form while sending');
 await get('bookingForm').onsubmit({preventDefault(){}});assert.equal(posts,1,'double click sends once');
 finish({ok:true,json:async()=>({id:'qa-result',count:1})});await submission;assert.equal(get('toast').textContent,'Đặt chỗ thành công.');assert.equal(get('bookingFields').disabled,false);assert.equal(get('bookingModal').open,false);
 globalThis.fetch=originalFetch;

}finally{globalThis.setInterval=interval;globalThis.setTimeout=timeout}
