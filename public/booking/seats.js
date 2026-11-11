import {apply,capture,current,guestMessage,seatLabel,t,toggle} from './language.js';
import {axisTicks} from './axis-ticks.js';
import {formatDay,formatDateTime,formatDateText} from './date-format.js';
import {placeGroups} from './place-summary.js';
import {CHAIR_BODY,CHAIR_BACK_PATH,hexOutline} from './furniture-geometry.js';
import {dailyIntervals,dailySummary} from './day-overview.js';
import {mountClockPicker} from './clock-picker.js';
import {minuteAt,draggedRange} from './time-selection.js';
import {bookingResources,resourceReservations,MEETING_TABLE,chairFacingAngle} from './resources.js';
import {normalizeBookingLayout,weeklyOccurrences} from './layout-normalization.js';
import * as THREE from '/studio/assets/three.module.js';
import {buildModel} from '/studio/model.js';
import {formatTime as time,initialRange,localDay,firstFutureMinute,rangeError,conflicts,seatState,freeWindows,codeForSeat} from './availability.js';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg',statusNames={pending:'Không khả dụng',active:'Không khả dụng',rejected:'Từ chối',cancelled:'Đã hủy'};
capture(document.documentElement);
apply();
function paintLanguageToggle(){
 const english=current()==='en';
 $('guestLanguageToggle').textContent=english?'EN / VI':'VI / EN';
 $('guestLanguageToggle').setAttribute('aria-label',english?'Chuyển sang tiếng Việt':'Switch to English');
}
paintLanguageToggle();

const model=buildModel(),catalog=new Map(model.editItems.map(i=>{const copy=i.object.clone(true);copy.position.set(0,0,0);copy.rotation.set(0,0,0);copy.scale.set(1,1,1);copy.updateMatrixWorld(true);return [i.id,{kind:i.kind,zone:i.object.userData.zone,angle:i.object.children[0]?.rotation.y||0,size:new THREE.Box3().setFromObject(copy).getSize(new THREE.Vector3())}]}));
const picked=new Set();
const pickedSeats=()=>seats.filter(s=>picked.has(s.id));
let dragging=false;
let mapInitialized=false,activeArea=null,activeTable=null;
let policy=null,space=null,objects=[],seats=[],reservations=[],mine=[],selected=null,ready=false,loadedDay='',lastUpdate=0,sequence=0,refreshing=false,submitting=false,requestId=null,bookingContext=null,recurrenceRequestKey='',recurrenceRequestIds=[],zoom=1,view='map',mapScope='day';
const start=()=>Number($('start').value),end=()=>Number($('end').value),range=()=>rangeError($('day').value,start(),end(),policy),usable=()=>ready&&loadedDay===$('day').value&&Date.now()-lastUpdate<60000;
function svg(tag,attrs={},text){const node=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;return node}
function toast(msg){$('toast').textContent=msg;$('toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.display='none',5000)}
async function api(path,options){const r=await fetch(path,{...options,signal:AbortSignal.timeout(20000)});let b;try{b=await r.json()}catch{throw Error(t('Chưa kết nối được hệ thống. Vui lòng thử lại.'))}if(!r.ok)throw Object.assign(Error(formatDateText(guestMessage(b.error||'Yêu cầu chưa được xử lý.'))),{conflictDay:b.conflictDay,conflictSeatIds:b.conflictSeatIds});return b}
function setTimes(preferredStart,preferredEnd){const oldStart=preferredStart??start(),oldEnd=preferredEnd??end();for(const id of ['start','end'])$(id).replaceChildren();for(let m=policy.openMinute;m<=policy.closeMinute;m+=policy.stepMinutes){if(m<policy.closeMinute)$('start').add(new Option(time(m),m));if(m>policy.openMinute)$('end').add(new Option(time(m),m))}const chosen=initialRange(policy,oldStart||firstFutureMinute($('day').value,policy),oldEnd);$('start').value=chosen.start;$('end').value=chosen.end;const maxDate=policy.unlimitedBooking?'':new Date(Date.now()+policy.advanceDays*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});$('day').max=maxDate;$('closedNotice').hidden=policy.seatsOpen;renderDurations()}
function renderDurations(){$('durations').replaceChildren();const maxDuration=Math.min(policy.unlimitedBooking?1440:policy.maxSeatMinutes,policy.closeMinute-policy.openMinute);for(const duration of [...new Set([policy.minMinutes,60,120,240,480,720,960,1200,1440])].filter(v=>v>=policy.minMinutes&&v<=maxDuration&&v%policy.stepMinutes===0)){const b=document.createElement('button');b.textContent=duration%60?t('{count} phút',{count:duration}):t('{count} giờ',{count:duration/60});b.className=end()-start()===duration?'active':'';b.onclick=()=>{const to=start()+duration;if(to>policy.closeMinute)return toast(t('Thời lượng này vượt giờ đóng cửa. Hãy chọn giờ bắt đầu sớm hơn.'));$('end').value=to;requestId=null;render()};$('durations').append(b)}}
function seatStatus(seat){if(!usable()||!space||range())return 'unknown';const state=seatState(seat.id,start(),end(),resourceReservations(seat,reservations),policy);return state==='pending'?'busy':state}
function matches(seat){const q=$('search').value.trim().toLowerCase();return activeArea!==null&&(activeArea==='meeting'?seat.capacity===6:seat.capacity===1)&&(!q||(seat.code+' '+seat.label).toLowerCase().includes(q))&&(!$('onlyFree').checked||seatStatus(seat)==='free')}
function transform(o,x,z){const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation));return new THREE.Vector3(x,0,z).multiply(new THREE.Vector3(...o.scale)).applyQuaternion(q).add(new THREE.Vector3(...o.position))}
function openArea(area){if($('bookingModal').open)return;activeArea=area;selected=null;picked.clear();requestId=null;view='map';$('search').value='';$('onlyFree').checked=false;activeTable=null;if(area==='meeting'){selected=seats.find(s=>s.capacity===6)||null;if(selected)picked.add(selected.id)}drawDetailMap();render();applyZoom();$('timePicker').scrollIntoView({behavior:'smooth',block:'start'})}
function syncArea(){const detail=activeArea!==null;$('overviewPanel').hidden=detail;$('bookingWorkspace').hidden=!detail;$('timePicker').hidden=!detail;$('areaTitle').textContent=activeArea==='meeting'?t('Khu 2 · Bàn 7 bên trong'):t('Khu 1 · Bàn 1–6');$('tablePicker').replaceChildren();$('selectionBasket').hidden=activeArea==='meeting';$('spaceName').textContent=activeArea==='meeting'?t('Bàn 7 · Nguyên cụm 6 chỗ'):t('Chọn ghế');$('mapToolbar').hidden=false;}

function chairAngle(o){const seat=seats.find(r=>r.members.includes(o.id)),table=objects.find(t=>t.id===seat?.tableId);return table?chairFacingAngle(o.position,table.position):180-(o.rotation[1]+(o.meta.angle||0))*180/Math.PI;}

function drawOverview(){const node=svg('svg',{viewBox:'-8.5 -9.3 27 18.8',class:'overview-map',role:'group','aria-label':t('Tổng quan gồm khu bàn 1 đến 6 và bàn 7 bên trong')});$('overviewMap').replaceChildren(node);
 const relevant=objects;
 if(relevant.length){const corners=relevant.flatMap(o=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>transform(o,x*o.meta.size.x/2,z*o.meta.size.z/2)));const xs=corners.map(p=>p.x),zs=corners.map(p=>p.z);node.setAttribute('viewBox',[Math.min(...xs)-.8,Math.min(...zs)-.8,Math.max(...xs)-Math.min(...xs)+1.6,Math.max(...zs)-Math.min(...zs)+1.6].join(' '))}
 for(const o of relevant){if(o.meta.kind==='chair'){const angle=chairAngle(o),g=svg('g',{class:'overview-chair','data-object-id':o.id,transform:`translate(${o.position[0]} ${o.position[2]}) rotate(${angle}) scale(${o.scale[0]} ${o.scale[2]})`});g.append(svg('rect',CHAIR_BODY),svg('path',{d:CHAIR_BACK_PATH}));node.append(g);continue;}const size=o.meta.size,points=o.meta.kind==='hex'?hexOutline().map(([x,z])=>transform(o,x,z)):[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>transform(o,x*size.x/2,z*size.z/2));node.append(svg('polygon',{points:points.map(p=>p.x+','+p.z).join(' '),class:['wall','glass','divider'].includes(o.meta.kind)?'overview-wall':o.meta.kind==='chair'?'overview-chair':'overview-furniture','data-object-id':o.id,...(o.color?{style:'fill:'+o.color}:{})}))}
 for(const group of [false,true]){const resources=seats.filter(s=>(s.capacity===6)===group);if(!resources.length)continue;const ids=new Set(resources.flatMap(r=>r.members)),chairs=objects.filter(o=>ids.has(o.id)),xs=chairs.map(o=>o.position[0]),zs=chairs.map(o=>o.position[2]);const x=Math.min(...xs)-.6,z=Math.min(...zs)-.6,w=Math.max(...xs)-x+.6,h=Math.max(...zs)-z+.6;const g=svg('g',{class:'overview-zone',role:'button',tabindex:'0','aria-label':group?t('Chọn khu 2: Bàn 7, đặt nguyên 6 chỗ'):t('Chọn khu 1: Bàn 1 đến 6, đặt từng ghế')});g.append(svg('rect',{x,y:z,width:w,height:h,rx:.25}),svg('text',{x:x+w/2,y:group?z+h+.42:z-.35},group?t('Khu 2 · Bàn 7'):t('Khu 1 · Bàn 1–6')),svg('text',{x:x+w/2,y:group?z+h+.86:z+.12,class:'overview-subtitle'},group?t('Đặt nguyên 6 chỗ →'):t('Chọn từng ghế →')));g.onclick=()=>openArea(group?'meeting':'working');g.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();openArea(group?'meeting':'working')}};node.append(g)}
}

function buildMap(data,preview=false){
 data=normalizeBookingLayout(data);
 objects=data.objects.filter(o=>!o.deleted).map(o=>({...o,meta:catalog.get(o.source||o.id)})).filter(o=>o.meta);
 seats=bookingResources(data).sort((a,b)=>(a.tableNumber||99)-(b.tableNumber||99)||a.shortCode.localeCompare(b.shortCode));const keepId=selected?.id;selected=seats.find(s=>s.id===keepId)||null;if(activeArea==='meeting'&&!selected){selected=seats.find(s=>s.capacity===6)||null;if(selected)picked.add(selected.id)}if(activeArea==='working'&&activeTable&&!seats.some(s=>s.capacity===1&&s.tableId===activeTable)){activeTable=null;selected=null;}
 drawOverview();drawDetailMap();applyZoom();
 $('emptySpace').hidden=!!space;$('emptySpace').querySelector('h3').textContent=preview?t('Sơ đồ mẫu — chưa mở cho đặt thực tế'):t('Chưa có sơ đồ được áp dụng');
}
function drawDetailMap(){
 for(const seat of seats)seat.mapNodes=[];
 $('mapSections').replaceChildren();
 for(const group of [false,true]){
 const resources=seats.filter(s=>(s.capacity===6)===group&&(activeArea==='meeting'?group:activeArea==='working'&&!group));if(!resources.length)continue;
 const section=document.createElement('section');section.className='map-zone'+(group?' meeting-zone':'');
 const heading=document.createElement('h3');heading.textContent=group?t('Bàn 7 · Đặt nguyên 6 chỗ'):t('Toàn bộ bàn và ghế trong Khu 1');
 const help=document.createElement('p');help.textContent=group?t('Bấm vào ghế trong cụm để đặt cả 6 chỗ.'):t('Bàn và ghế hiển thị theo bố trí hiện tại. Bấm trực tiếp nhiều ghế để đặt chung.');
 const scroller=document.createElement('div');scroller.className='map-scroll';const map=svg('svg',{class:'booking-map',role:'group','aria-label':heading.textContent});scroller.append(map);section.append(scroller);$('mapSections').append(section);
 const ids=new Set(resources.flatMap(r=>r.members));const chairs=objects.filter(o=>ids.has(o.id));
 const xs=chairs.map(o=>o.position[0]),zs=chairs.map(o=>o.position[2]);const minX=Math.min(...xs)-.6,maxX=Math.max(...xs)+.6,minZ=Math.min(...zs)-.65,maxZ=Math.max(...zs)+.65;
 map.setAttribute('viewBox',[minX,minZ,maxX-minX,maxZ-minZ].join(' '));map.style.aspectRatio=(maxX-minX)/(maxZ-minZ);
 for(const o of objects.filter(o=>o.meta.kind==='hex'&&(group?o.id===MEETING_TABLE:o.id!==MEETING_TABLE))){
 const size=o.meta.size,points=hexOutline().map(([x,z])=>transform(o,x,z));
 const polygon=svg('polygon',{points:points.map(p=>p.x+','+p.z).join(' '),class:'furniture'+(o.id===activeTable?' highlighted-table':''),...(group?{role:'button',tabindex:'0','aria-label':t('Chọn Bàn 7 · nguyên cụm 6 chỗ')}:{})});if(group){const meetingSeat=resources.find(r=>r.capacity===6);if(meetingSeat){polygon.style.cursor='pointer';polygon.onclick=()=>choose(meetingSeat);polygon.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose(meetingSeat)}}}}map.append(polygon);
 polygon.append(svg('title',{},group?t('Bàn {number}',{number:7}):seatLabel(o.label?.replace('Bàn lục giác','Bàn')||'Bàn '+Number((o.source||o.id).slice(4)))));const center=transform(o,0,0);map.append(svg('text',{x:center.x,y:center.z,class:'furniture-label'},t('Bàn {number}',{number:o.id===MEETING_TABLE?7:Number((o.source||o.id).slice(4))})));


 }
 for(const o of chairs){const seat=resources.find(r=>r.members.includes(o.id));if(!seat)continue;const p=transform(o,0,0),table=objects.find(t=>t.id===seat.tableId),angle=chairAngle(o);
 const node=svg('g',{transform:`translate(${p.x} ${p.z}) rotate(${angle}) scale(${o.scale[0]} ${o.scale[2]})`,class:'seat unknown',...(group?{}:{role:'button',tabindex:'0'}),'data-seat-id':seat.id});
 node.append(svg('rect',{...CHAIR_BODY,class:'seat-body'}),svg('path',{d:CHAIR_BACK_PATH,class:'seat-back'}),svg('text',{x:0,y:.01,transform:`rotate(${-angle})`},group?'':seat.shortCode));
 const title=svg('title',{},seatLabel(seat.code));node.append(title);seat.mapNodes??=[];seat.mapNodes.push({node,title});node.setAttribute('role','button');node.setAttribute('tabindex','0');node.onclick=()=>choose(seat);node.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose(seat)}};map.append(node);
 }
 }

}

function choose(seat){if(seat.capacity===6){selected=seat;picked.clear();picked.add(seat.id);render();return}selected=seat;requestId=null;if(picked.has(seat.id))picked.delete(seat.id);else if(seatStatus(seat)==='free'){if(seat.capacity===6||pickedSeats().some(s=>s.capacity===6))picked.clear();picked.add(seat.id)}else toast(t('{seat} chưa trống suốt khung giờ này. Bấm vạch xám để xem giờ đã đặt.',{seat:seatLabel(seat.code)}));render();}
function renderBasket(){const chosen=pickedSeats();$('basketTitle').textContent=t('Đã chọn {count} chỗ',{count:chosen.reduce((sum,s)=>sum+s.capacity,0)});$('basketItems').replaceChildren();for(const id of picked){const seat=seats.find(s=>s.id===id),b=document.createElement('button');b.textContent=(seat?seatLabel(seat.code):t('Ghế đã gỡ'))+' ×';b.className=seat&&seatStatus(seat)==='free'?'':'basket-conflict';b.title=t('Bỏ ghế này khỏi lượt đặt');b.onclick=()=>{picked.delete(id);requestId=null;render()};$('basketItems').append(b)}$('basketHint').textContent=!picked.size?t('Bấm ghế trên sơ đồ để chọn.'):chosen.length!==picked.size?t('Có ghế đã bị gỡ khỏi sơ đồ. Bỏ ghế có cảnh báo và chọn lại.'):chosen.some(s=>seatStatus(s)!=='free')?t('Có ghế không còn trống trong khung giờ này. Đổi giờ hoặc bỏ ghế có cảnh báo.'):t('Cùng ngày và khung giờ.');$('selectTable').hidden=activeArea!=='working';$('selectTable').textContent=activeTable?t('Chọn ghế trống ở Bàn {number}',{number:seats.find(s=>s.tableId===activeTable)?.tableNumber}):t('Chọn tất cả ghế trống trong khu');}

function areaResources(){return seats.filter(s=>activeArea===null||(activeArea==='meeting'?s.capacity===6:s.capacity===1))}
function mapStatus(seat){if(!usable()||!space)return 'unknown';return mapScope==='day'?(dailyIntervals(seat,reservations).length?'scheduled':'free'):seatStatus(seat)}
function renderDayOverview(){
 const valid=usable()&&!!space,all=dailySummary(seats,reservations);
 $('dayTitle').textContent=t('Lịch cả ngày · {date}',{date:formatDay($('day').value)});
 $('dayTotals').textContent=!valid?t('Đang tải lịch trong ngày…'):t('{scheduled} chỗ có lịch · {free} chỗ trống cả ngày',all);
 for(const [id,capacity] of [['workingDaySummary',1],['meetingDaySummary',6]]){const count=dailySummary(seats.filter(s=>s.capacity===capacity),reservations);$(id).textContent=!valid?t('Đang tải lịch…'):t('{scheduled} / {total} chỗ có lịch trong ngày',count)}
 $('dayView').setAttribute('aria-pressed',String(mapScope==='day'));$('rangeView').setAttribute('aria-pressed',String(mapScope==='range'));
 $('legendFree').textContent=mapScope==='day'?t('Trống cả ngày'):t('Trống giờ muốn đặt');$('legendOccupied').textContent=mapScope==='day'?t('Có lịch trong ngày'):t('Bận giờ muốn đặt');$('occupiedLegend').className=mapScope==='day'?'scheduled':'busy';
 $('mapModeHint').textContent=mapScope==='day'?t('Màu vàng: có lịch ở một hoặc nhiều khoảng trong ngày. Bấm ghế để xem giờ; vẫn đặt được vào khoảng còn trống.'):t('Sơ đồ đang kiểm tra {start}–{end}. Bấm ghế để xem lịch cả ngày.',{start:time(start()),end:time(end())});
 $('timeScopeHint').textContent=t('Khung giờ này dùng để kiểm tra và đặt chỗ; không lọc mất lịch cả ngày.');
 return dailySummary(areaResources(),reservations);
}
function render(){
 if(!policy)return;syncArea();renderBasket();const stats=renderDayOverview(),error=range();
 $('closedNotice').hidden=!!space&&policy.seatsOpen;$('closedNotice').textContent=!space?t('Sơ đồ đang được cập nhật. Vui lòng thử lại sau.'):t('Hiện chưa mở đặt chỗ. Bạn vẫn xem được lịch cả ngày.');
 $('rangeError').hidden=!error||!activeArea;$('rangeError').textContent=guestMessage(error);$('rangeLabel').textContent=time(start())+' – '+time(end());$('rangeHint').textContent=formatDay($('day').value)+' · '+(end()>start()?t('{count} phút',{count:end()-start()}):t('Chọn lại giờ'));renderDurations();startClock.sync();endClock.sync();$('seatList').replaceChildren();
 for(const seat of seats){const state=mapStatus(seat),chosen=picked.has(seat.id),events=dailyIntervals(seat,reservations);for(const {node,title} of seat.mapNodes||[]){node.setAttribute('class','seat '+state+(chosen&&state!=='unknown'?' selected':'')+(chosen&&seatStatus(seat)==='busy'?' selection-conflict':''));node.style.display=matches(seat)?'':'none';const label=mapScope==='day'?(state==='free'?t('Trống cả ngày'):state==='scheduled'?t('Có lịch trong ngày: {times}',{times:events.map(r=>time(r.startMinute)+'–'+time(r.endMinute)).join(', ')}):t('Chưa xác định')):(state==='free'?t('Trống giờ muốn đặt'):state==='busy'?t('Bận giờ muốn đặt'):t('Chưa xác định'));node.setAttribute('aria-label',seatLabel(seat.code)+' · '+label);node.setAttribute('aria-pressed',String(chosen));title.textContent=node.getAttribute('aria-label')}}
 $('summary').textContent=!space?t('Chưa áp dụng sơ đồ cho đặt chỗ.'):!usable()?t('Đang tải lịch trong ngày…'):mapScope==='day'?t('{scheduled} / {total} chỗ có lịch trong ngày · {free} chỗ trống cả ngày',stats):error?t('Chọn khung giờ hợp lệ để kiểm tra ghế trống.'):t('{free} / {total} chỗ trống suốt {start}–{end}',{free:seats.filter(matches).filter(s=>seatStatus(s)==='free').reduce((n,s)=>n+s.capacity,0),total:seats.filter(matches).reduce((n,s)=>n+s.capacity,0),start:time(start()),end:time(end())});
 $('mapPanel').hidden=view!=='map';$('timelinePanel').hidden=view!=='timeline';$('mapTab').classList.toggle('active',view==='map');$('timelineTab').classList.toggle('active',view==='timeline');renderDetails();if(view==='timeline')renderAllTimeline();
}
const watchedAxes=new Set();
function fitAxis(node,width){node.replaceChildren();const ticks=axisTicks(policy.openMinute,policy.closeMinute,width);ticks.forEach((m,i)=>{const span=document.createElement('span');span.textContent=time(m);span.className=i===0?'axis-first':i===ticks.length-1?'axis-last':'';span.style.left=(m-policy.openMinute)/(policy.closeMinute-policy.openMinute)*100+'%';node.append(span)})}
const axisObserver=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{for(const entry of entries)fitAxis(entry.target,entry.contentRect.width)}):null;
function axis(){const node=document.createElement('div');node.className='time-axis';node.setAttribute('aria-label',t('Từ {start} đến {end}',{start:time(policy.openMinute),end:time(policy.closeMinute)}));fitAxis(node,$('selectedTimeline').getBoundingClientRect().width||320);if(axisObserver){for(const old of watchedAxes)if(!old.isConnected){axisObserver.unobserve(old);watchedAxes.delete(old)}watchedAxes.add(node);axisObserver.observe(node)}return node}
function showBusyDetails(seat, interval){
 $('busyDetailSeat').textContent=seatLabel(seat.code)+(seat.capacity===6?' · '+t('Cả 6 chỗ'):'');
 $('busyDetailTime').textContent=formatDay($('day').value)+' · '+time(interval.startMinute)+'–'+time(interval.endMinute);
 const booker=interval.booker;
 $('busyBookerName').textContent=booker?.name||'—';
 $('busyBookerEmail').textContent=booker?.email||'—';
 $('busyBookerPhone').textContent=booker?.phone||'—';
 $('busyBookerPurpose').textContent=booker?.purpose||'—';
 $('busyDetail').showModal();
}
const busyDetail=$('busyDetail');
$('closeBusyDetail').onclick=()=>busyDetail.close();
function isBusyDetailBackdrop(event){
 if(event.target!==busyDetail)return false;
 const bounds=busyDetail.getBoundingClientRect();
 return event.clientX<bounds.left||event.clientX>bounds.right||
  event.clientY<bounds.top||event.clientY>bounds.bottom;
}
let backdropPressed=false;
busyDetail.onpointerdown=event=>{backdropPressed=isBusyDetailBackdrop(event)};
busyDetail.onpointercancel=()=>{backdropPressed=false};
busyDetail.onclick=event=>{
 if(backdropPressed&&isBusyDetailBackdrop(event))busyDetail.close();
 backdropPressed=false;
};

function renderConflicts(batch){
 const panel=$('seatConflicts'),list=$('conflictSeats');
 list.replaceChildren();
 const blocked=usable()&&space&&!range()?batch.map(seat=>({
  seat, intervals:conflicts(seat.id,start(),end(),resourceReservations(seat,reservations),policy)
 })).filter(item=>item.intervals.length):[];
 panel.hidden=!blocked.length;
 if(!blocked.length)return;
 for(const {seat,intervals} of blocked){
  const row=document.createElement('li');
  const times=[...new Set(intervals.map(r=>time(r.startMinute)+'–'+time(r.endMinute)))];
  row.textContent=t('{seat} · Đã đặt {times}',{seat:seatLabel(seat.code),times:times.join(', ')});
  list.append(row);
 }
 const blockedIds=new Set(blocked.map(({seat})=>seat.id));
 const free=batch.filter(seat=>!blockedIds.has(seat.id));
 $('conflictFree').textContent=free.length?t('Còn trống: {seats}',{seats:free.map(seat=>seatLabel(seat.code)).join(', ')}):t('Không có ghế đã chọn nào trống suốt khung giờ này.');
 $('removeConflicts').hidden=!free.length;
 $('removeConflicts').onclick=()=>{
  for(const id of blockedIds)picked.delete(id);
  if(selected&&blockedIds.has(selected.id))selected=free[0];
  requestId=null;
  render();
 };
}

function track(seat,clickable=false){const width=policy.closeMinute-policy.openMinute,node=document.createElement('div');node.className='day-track'+(!space||!usable()?' unknown':'');node.setAttribute('aria-label',t('Lịch {seat}',{seat:seatLabel(seat.code)}));for(const r of dailyIntervals(seat,reservations)){const left=Math.max(r.startMinute,policy.openMinute),right=Math.min(r.endMinute,policy.closeMinute);if(right<=left)continue;const b=document.createElement('button');b.type='button';b.className='block busy';b.style.left=(left-policy.openMinute)/width*100+'%';b.style.width=(right-left)/width*100+'%';b.textContent=time(r.startMinute)+'–'+time(r.endMinute);b.title=t('Xem lịch đã đặt: {seat} · {times}',{seat:seatLabel(seat.code),times:b.textContent});b.setAttribute('aria-label',b.title);b.onclick=()=>showBusyDetails(seat,r);node.append(b)}if(!range()){const range=document.createElement('span');range.className='range-overlay'+(seatStatus(seat)==='busy'?' conflict':'');range.style.left=(start()-policy.openMinute)/width*100+'%';range.style.width=(end()-start())/width*100+'%';node.append(range)}if(clickable){node.tabIndex=0;node.setAttribute('role','group');node.setAttribute('aria-label',t('Chọn giờ cho {seat}. Bấm hoặc kéo; phím mũi tên đổi giờ.',{seat:seatLabel(seat.code)}));let anchor=null,originX=0,preview=null;
 const commit=(a,b,wasDragged)=>{if(!usable()||!space)return toast(t('Đợi dữ liệu mới nhất trước khi chọn giờ.'));if(!wasDragged){const point=Math.min(policy.closeMinute-policy.stepMinutes,a),events=resourceReservations(seat,reservations),window=freeWindows(seat.id,$('day').value,events,policy).find(w=>point>=w.start&&point<w.end);if(!window){const event=events.find(r=>point>=r.startMinute-policy.bufferMinutes&&point<r.endMinute+policy.bufferMinutes);if(event)return showBusyDetails(seat,event);return toast(t('Khoảng giờ này không còn trống hoặc không đủ thời lượng sử dụng.'))}selected=seat;if(seat.capacity===6)picked.clear();picked.add(seat.id);setWindow(window,point);return}
 const chosen=draggedRange(a,b,policy),error=rangeError($('day').value,chosen.start,chosen.end,policy);if(error)return toast(guestMessage(error));const occupied=seatState(seat.id,chosen.start,chosen.end,resourceReservations(seat,reservations),policy)!=='free';$('start').value=chosen.start;$('end').value=chosen.end;selected=seat;if(!occupied){if(seat.capacity===6)picked.clear();picked.add(seat.id)}requestId=null;render();if(occupied)toast(t('Khoảng {start}–{end} có lượt đặt trùng. Chọn đoạn trống khác.',{start:time(chosen.start),end:time(chosen.end)}))};
 node.onpointerdown=e=>{if(e.target?.closest('.block.busy')||e.button!==0||!usable()||!space)return;const rect=node.getBoundingClientRect();anchor=minuteAt(e.clientX,rect.left,rect.width,policy);originX=e.clientX;dragging=true;node.setPointerCapture(e.pointerId);preview=document.createElement('span');preview.className='drag-preview';node.append(preview);e.preventDefault()};
 node.onpointermove=e=>{if(anchor===null)return;const rect=node.getBoundingClientRect(),point=minuteAt(e.clientX,rect.left,rect.width,policy),chosen=draggedRange(anchor,point,policy);preview.style.left=(chosen.start-policy.openMinute)/width*100+'%';preview.style.width=(chosen.end-chosen.start)/width*100+'%';preview.textContent=time(chosen.start)+'–'+time(chosen.end)};
 node.onpointerup=e=>{if(anchor===null)return;const rect=node.getBoundingClientRect(),point=minuteAt(e.clientX,rect.left,rect.width,policy),from=anchor,moved=Math.abs(e.clientX-originX)>5;anchor=null;dragging=false;preview?.remove();if(node.hasPointerCapture(e.pointerId))node.releasePointerCapture(e.pointerId);commit(from,point,moved)};
 node.onpointercancel=()=>{anchor=null;dragging=false;preview?.remove()};
 node.onkeydown=e=>{if(e.target?.closest('.block.busy')||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();if(!usable()||!space)return;const delta=(e.key==='ArrowRight'?1:-1)*policy.stepMinutes;commit(e.shiftKey?start():start()+delta,end()+delta,true);$('selectedTimeline').querySelector('.day-track')?.focus?.()};
 };return node}
function setWindow(window,from=window.start){const duration=Math.max(policy.minMinutes,Math.min(Math.min(policy.unlimitedBooking?1440:policy.maxSeatMinutes,policy.closeMinute-policy.openMinute),end()-start()||60)),to=Math.min(window.end,from+duration);if(to-from<policy.minMinutes)return toast(t('Đoạn giờ còn lại ngắn hơn thời lượng tối thiểu.'));$('start').value=from;$('end').value=to;if(!picked.size&&selected&&seatStatus(selected)==='free'){if(selected.capacity===6)picked.clear();picked.add(selected.id)}requestId=null;render()}
function renderDetails(){if(!selected&&picked.size)selected=pickedSeats().at(-1)||null;$('noSelection').hidden=!!selected;$('seatSelection').hidden=!selected;if(!selected){$('proceed').disabled=true;$('submit').disabled=true;if($('bookingModal').open)$('formError').textContent=t('Ghế vừa bị gỡ khỏi sơ đồ nhận đặt. Đóng biểu mẫu và chọn ghế khác.');return}const state=seatStatus(selected),error=range();$('selectedTitle').textContent=seatLabel(selected.code)+(selected.capacity===6?' · '+t('Cả 6 chỗ'):'');$('selectedRange').textContent=formatDay($('day').value)+' · '+time(start())+'–'+time(end());$('selectedState').className='state-label '+state;$('selectedState').textContent=!space?t('Sơ đồ chưa được áp dụng'):!usable()?t('Chưa có dữ liệu mới nhất'):error?t('Khung giờ chưa hợp lệ'):state==='free'?t('✓ Trống toàn bộ khoảng giờ này'):t('Khung giờ này không khả dụng');$('selectedTimeline').replaceChildren(track(selected,true),axis());const batch=pickedSeats();renderConflicts(batch);$('freeWindowHeading').textContent=batch.length>1?t('Khoảng giờ trống chung của các ghế đã chọn'):t('Chọn một khoảng giờ trống');$('dayEvents').replaceChildren();if(usable()&&space&&!resourceReservations(selected,reservations).length){const p=document.createElement('p');p.textContent=t('Các khoảng trống hiển thị bên dưới.');$('dayEvents').append(p)}for(const r of dailyIntervals(selected,reservations)){const p=document.createElement('button');p.type='button';p.className='day-events busy';p.textContent=time(r.startMinute)+'–'+time(r.endMinute);p.onclick=()=>showBusyDetails(selected,r);$('dayEvents').append(p)}$('freeWindows').replaceChildren();if(usable()&&space){const target=batch.length>1?{id:'selection',members:batch.flatMap(s=>[s.id,...s.members])}:selected;const windows=freeWindows(target.id,$('day').value,resourceReservations(target,reservations),policy);if(!windows.length)$('freeWindows').textContent=t('Không còn khoảng giờ phù hợp trong ngày.');for(const w of windows){const button=document.createElement('button');button.textContent=time(w.start)+'–'+time(w.end);button.title=t('Trống suốt khoảng này; bấm để chọn giờ sử dụng.');button.onclick=()=>setWindow(w);$('freeWindows').append(button)}}else $('freeWindows').textContent=t('Chưa thể xác nhận các khoảng giờ trống.');$('proceed').disabled=!space||!usable()||!!error||!policy.seatsOpen||!picked.size||batch.length!==picked.size||batch.some(s=>seatStatus(s)!=='free');$('proceed').textContent=!policy.seatsOpen?t('Đang đóng nhận đặt ghế'):t('Đăng ký {count} chỗ đã chọn',{count:batch.reduce((sum,s)=>sum+s.capacity,0)});$('submit').disabled=submitting||$('proceed').disabled;if($('bookingModal').open&&bookingContext){const changed=JSON.stringify(bookingContext.seatIds)!==JSON.stringify([...picked].sort())||bookingContext.day!==$('day').value||bookingContext.startMinute!==start()||bookingContext.endMinute!==end();if(changed||$('proceed').disabled){$('submit').disabled=true;if(!submitting)$('formError').textContent=t('Tình trạng ghế hoặc cấu hình thời gian vừa thay đổi. Đóng biểu mẫu và chọn lại khung giờ trước khi gửi.');}}}
function renderAllTimeline(){$('allTimeline').replaceChildren();const inner=document.createElement('div');inner.className='timeline-inner';const header=document.createElement('div');header.className='timeline-head';header.append(document.createTextNode(t('Chỗ ngồi')),axis());inner.append(header);for(const seat of seats.filter(matches)){const row=document.createElement('div');row.className='timeline-row'+(picked.has(seat.id)?' chosen':'');const b=document.createElement('button');b.textContent=seatLabel(seat.code)+(seat.capacity===6?' · '+t('6 chỗ'):'');b.title=seat.label;b.onclick=()=>choose(seat);row.append(b,track(seat,true));inner.append(row)}$('allTimeline').append(inner)}
async function refresh(full=false){const seq=++sequence,day=$('day').value;refreshing=true;if(loadedDay!==day)ready=false;render();try{const [cfg,data,spaceData]=await Promise.all([api('/api/settings'),api('/api/bookings?day='+day),api('/api/space')]);if(seq!==sequence||day!==$('day').value)return;const previous=policy;policy=cfg.policy;if(!previous||JSON.stringify(previous)!==JSON.stringify(policy))setTimes();if(spaceData){const redraw=!mapInitialized||space?.revision!==spaceData.space?.revision;space=spaceData.space;$('manage').textContent=spaceData.isAdmin?t('Trang quản trị ↗'):t('Đăng nhập admin ↗');$('manage').href=spaceData.isAdmin?'/admin/':'/admin/login/';if(space){$('spaceName').textContent=t('Chọn chỗ và xem giờ');$('layoutUpdated').textContent=t('Bố trí đã áp dụng · {value}',{value:space.updatedAt?formatDateTime(space.updatedAt):t('Phiên bản {number}',{number:space.revision})});if(redraw){buildMap(space.data);mapInitialized=true;}}else if(redraw){const sample={objects:model.editItems.map(i=>({id:i.id,label:i.label,position:i.object.position.toArray(),rotation:i.object.rotation.toArray().slice(0,3),scale:i.object.scale.toArray(),bookable:i.kind==='chair'&&['startup','teams'].includes(i.object.userData.zone),deleted:false}))};buildMap(sample,true);mapInitialized=true;}}reservations=data.reservations.filter(r=>r.status==='active').map(r=>({...r,mine:false}));mine=data.mine;lastUpdate=Date.now();loadedDay=day;ready=true;$('updatedAt').textContent=t('Cập nhật {time}',{time:new Date(lastUpdate).toLocaleTimeString(current()==='en'?'en-GB':'vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})});render();}catch(e){if(seq!==sequence)return;ready=false;render();$('summary').textContent=t('Chưa tải được dữ liệu. Tạm ngừng đăng ký để tránh chọn nhầm ghế.');toast(e.message)}finally{if(seq===sequence)refreshing=false}}
const startClock=mountClockPicker($('startTrigger'),$('start'),()=>policy,()=>{requestId=null;render()},'start',t),endClock=mountClockPicker($('endTrigger'),$('end'),()=>policy,()=>{requestId=null;render()},'end',t);
$('dayView').onclick=()=>{mapScope='day';render()};$('rangeView').onclick=()=>{mapScope='range';render()};
$('clearSeats').onclick=()=>{picked.clear();requestId=null;render()};$('selectTable').onclick=()=>{for(const seat of seats.filter(s=>s.capacity===1&&(!activeTable||s.tableId===activeTable)&&seatStatus(s)==='free')){picked.add(seat.id);selected=seat}requestId=null;render()};
$('workingArea').onclick=()=>openArea('working');$('meetingArea').onclick=()=>openArea('meeting');$('backOverview').onclick=()=>{activeArea=null;selected=null;picked.clear();requestId=null;render()};
$('day').value=localDay();$('day').min='';$('day').onchange=()=>{requestId=null;return refresh()};for(const id of ['start','end'])$(id).onchange=()=>{requestId=null;render()};$('search').oninput=()=>{drawDetailMap();render()};$('onlyFree').onchange=()=>{drawDetailMap();render()};$('refresh').onclick=()=>refresh(true);$('mapTab').onclick=()=>{view='map';render()};$('timelineTab').onclick=()=>{view='timeline';render()};function applyZoom(){for(const map of document.querySelectorAll('.booking-map'))map.style.setProperty('width',(zoom*100)+'%','important')}$('zoomIn').onclick=()=>{zoom=Math.min(2.5,zoom+.25);applyZoom()};$('zoomOut').onclick=()=>{zoom=Math.max(1,zoom-.25);applyZoom()};
$('proceed').onclick=()=>{if($('proceed').disabled)return;bookingContext={seatIds:[...picked].sort(),attendees:pickedSeats().reduce((sum,s)=>sum+s.capacity,0),day:$('day').value,startMinute:start(),endMinute:end()};recurrenceRequestKey='';recurrenceRequestIds=[];$('formSeat').textContent=t('Đặt {count} chỗ ngồi',{count:bookingContext.attendees});$('formSeats').replaceChildren();for(const group of placeGroups(pickedSeats())){const row=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('span');row.className='place-summary-row';name.textContent=seatLabel(group.title);detail.textContent=seatLabel(group.detail);row.append(name,detail);$('formSeats').append(row)}$('formRange').textContent=formatDay($('day').value)+' · '+time(start())+'–'+time(end());$('formError').textContent='';$('formConflict').textContent='';$('formConflictBack').hidden=true;$('repeatWeekly').checked=false;$('repeatUntil').value=addWeeks(bookingContext.day,4);syncRepeatOptions();$('bookingModal').showModal()};$('closeForm').onclick=()=>{if(!submitting)$('bookingModal').close()};$('formConflictBack').onclick=$('closeForm').onclick;$('bookingModal').addEventListener('cancel',e=>{if(submitting)e.preventDefault()});
try{$('displayName').value=localStorage.getItem('uii-booking-name')||'';$('organization').value=localStorage.getItem('uii-booking-org')||''}catch{}

function addWeeks(day,weeks){return new Date(Date.parse(day+'T00:00:00Z')+weeks*7*86400000).toISOString().slice(0,10)}
function syncRepeatOptions(){
 const enabled=$('repeatWeekly').checked;
 $('repeatOptions').hidden=!enabled;
 $('repeatUntil').min=bookingContext?.day||$('day').value;
 if(enabled&&!$('repeatUntil').value)$('repeatUntil').value=addWeeks(bookingContext?.day||$('day').value,4);
 renderRepeatPreview();
}
function renderRepeatPreview(){
 if(!$('repeatWeekly').checked){$('repeatPreview').textContent=t('Chỉ tạo một lượt đặt.');return}
 try{
  const dates=weeklyOccurrences(bookingContext?.day||$('day').value,$('repeatUntil').value);
  $('repeatPreview').textContent=t('Sẽ tạo {count} lượt, cùng thứ và cùng khung giờ ({start}–{end}).',{count:dates.length,start:time(bookingContext?.startMinute??start()),end:time(bookingContext?.endMinute??end())});
  $('repeatPreview').className='repeat-preview';
 }catch(error){$('repeatPreview').textContent=guestMessage(error.message);$('repeatPreview').className='repeat-preview error'}
}
$('repeatWeekly').onchange=syncRepeatOptions;
$('repeatUntil').onchange=renderRepeatPreview;
$('bookingForm').onsubmit=async e=>{e.preventDefault();if(submitting||$('submit').disabled||$('proceed').disabled||!bookingContext)return;submitting=true;$('bookingFields').disabled=true;requestId??=crypto.randomUUID();$('submit').disabled=true;$('formError').textContent='';$('formConflict').textContent='';$('formConflictBack').hidden=true;const payload={requestId,resourceType:'seat',...bookingContext};for(const id of ['displayName','organization','email','phone','leader','subject','description','groupType'])payload[id]=$(id).value;if($('repeatWeekly').checked){let dates;try{dates=weeklyOccurrences(bookingContext.day,$('repeatUntil').value)}catch(error){$('formError').textContent=guestMessage(error.message);submitting=false;$('bookingFields').disabled=false;$('submit').disabled=false;return}const key=dates.join(',')+'|'+bookingContext.startMinute+'|'+bookingContext.endMinute+'|'+bookingContext.seatIds.join(',');if(key!==recurrenceRequestKey){recurrenceRequestKey=key;recurrenceRequestIds=dates.map(()=>crypto.randomUUID())}payload.occurrences=dates.map((day,index)=>({requestId:recurrenceRequestIds[index],day,startMinute:bookingContext.startMinute,endMinute:bookingContext.endMinute}));payload.requestId=payload.occurrences[0].requestId;}try{const result=await api('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});try{localStorage.setItem('uii-booking-name',payload.displayName);localStorage.setItem('uii-booking-org',payload.organization)}catch{}$('bookingModal').close();requestId=null;recurrenceRequestKey='';recurrenceRequestIds=[];picked.clear();toast(result.count>1?t('Đặt chỗ thành công ({count} lượt).',{count:result.count}):t('Đặt chỗ thành công.'));await refresh();}catch(e){$('formError').textContent=e.message;
 if(e.conflictDay&&Array.isArray(e.conflictSeatIds)){
  const labels=pickedSeats().filter(seat=>e.conflictSeatIds.includes(seat.id)).map(seat=>seatLabel(seat.code));
  if(labels.length){
   $('formConflict').textContent=t('Trùng ngày {date} · {seats}.',{date:formatDay(e.conflictDay),seats:labels.join(', ')});
   $('formConflictBack').hidden=false;
  }
 }
 await refresh();if(mine.some(r=>r.id===requestId)){requestId=null;picked.clear();$('bookingModal').close();toast(t('Đặt chỗ thành công.'))}}finally{submitting=false;$('bookingFields').disabled=false;renderDetails()}};
$('guestLanguageToggle').onclick=()=>{
 toggle();
 paintLanguageToggle();
 startClock.close();endClock.close();
 const isAdmin=String($('manage').href||'').endsWith('/admin/');
 $('manage').textContent=t(isAdmin?'Trang quản trị ↗':'Đăng nhập admin ↗');
 if(lastUpdate)$('updatedAt').textContent=t('Cập nhật {time}',{
  time:new Date(lastUpdate).toLocaleTimeString(current()==='en'?'en-GB':'vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})
 });
 if(space)$('layoutUpdated').textContent=t('Bố trí đã áp dụng · {value}',{
  value:space.updatedAt?formatDateTime(space.updatedAt):t('Phiên bản {number}',{number:space.revision})
 });
 $('toast').style.display='none';
 drawOverview();drawDetailMap();render();applyZoom();
};
await refresh(true);setInterval(()=>{if(!document.hidden&&!submitting&&!refreshing&&!dragging)refresh()},15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!refreshing)refresh()});
