import {adminLanguage, adminSeatLabel, applyAdminLanguage, captureAdminCopy, t, toggleAdminLanguage} from '/admin/language.js';
import {formatDay,formatDateText} from '/booking/date-format.js';
import {placeSummary} from '/booking/place-summary.js';
import {mountClockPicker,timeChoices} from '/booking/clock-picker.js';
import {bookingResources} from '/booking/resources.js';
import {normalizeBookingLayout} from '/booking/layout-normalization.js';
import {drawBookingMap} from './booking-map.js?v=18';
const PAGE_SIZE=6;
const $=id=>document.getElementById(id),names={pending:'Chờ duyệt',active:'Đã duyệt',rejected:'Từ chối'};let loadSequence=0,offset=0,searchTimer,lastSnapshot='';const weekdayNames=['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
let latestTotals=[],updatedAt=null,weekdayLabels=[];
let totalCount=0,data=[],space=null,reviewId=null,wholeMap=false,policyConfig=null,policyRevision=0,decision=null,editing=null;const editPicked=new Set();
captureAdminCopy(document.documentElement);
applyAdminLanguage();
function paintLanguageToggle(){
 const english=adminLanguage()==='en';
 $('languageToggle').textContent=english?'EN / VI':'VI / EN';
 $('languageToggle').setAttribute('aria-label',english?'Chuyển sang tiếng Việt':'Switch to English');
 $('languageToggle').title=english?'Chuyển sang tiếng Việt':'Switch to English';
}
paintLanguageToggle();
$('languageToggle').onclick=()=>{
 toggleAdminLanguage();
 paintLanguageToggle();
 paintViewCopy();
 renderPages(totalCount);
 renderTotals();
 renderUpdated();
 weekdayLabels.forEach((node,day)=>{node.textContent=t(weekdayNames[day])});
 render();
};
const editStartClock=mountClockPicker($('editStartTrigger'),$('editStart'),()=>policyConfig,()=>editStartClock.sync(),'start',t),editEndClock=mountClockPicker($('editEndTrigger'),$('editEnd'),()=>policyConfig,()=>editEndClock.sync(),'end',t);
function toast(msg){$('toast').textContent=msg;$('toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.display='none',4500)}
async function api(path,options){const r=await fetch(path,{...options,signal:AbortSignal.timeout(20000)});const b=await r.json();if(r.status===401){location.replace('/admin/login/');throw Error(t('Vui lòng đăng nhập admin.'))}if(!r.ok)throw Error(formatDateText(t((b.error||'Không kết nối được hệ thống').replace('và mục đích.','và tiêu đề.'))));return b}
const time=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
function render(){const rows=data;$('requests').replaceChildren();if(!rows.some(b=>b.id===reviewId)){reviewId=rows[0]?.id||null;wholeMap=false;if($('reviewModal').open)$('reviewModal').close()}
$('resultCount').textContent=t('{count} lượt',{count:rows.length?(offset+1)+'–'+(offset+rows.length)+' / '+totalCount:0});
if(!rows.length){const p=document.createElement('p');p.className='empty-list';p.textContent=t('Không có lượt đặt phù hợp. Thử đổi ngày hoặc trạng thái.');$('requests').append(p)}else{
const table=document.createElement('table');table.className='booking-table';const caption=document.createElement('caption');caption.textContent=t('Danh sách đặt chỗ Phòng 15.02');caption.className='sr-only';const head=document.createElement('thead'),header=document.createElement('tr');for(const label of [t('Ngày sử dụng'),t('Khung giờ'),t('Người đăng ký / Đơn vị'),t('Chỗ đăng ký'),t('Tiêu đề'),t('Trạng thái'),t('Thao tác')]){const th=document.createElement('th');th.scope='col';th.textContent=label;header.append(th)}head.append(header);const body=document.createElement('tbody');
for(const b of rows){const row=document.createElement('tr');row.className=b.id===reviewId&&$('reviewModal').open?'current':'';const values=[formatDay(b.day),time(b.start_minute??b.start_slot*30)+'–'+time(b.end_minute??b.end_slot*30),b.display_name,adminSeatLabel(placeSummary(b.seat_label)),b.subject||'—'];for(let i=0;i<values.length;i++){const cell=document.createElement('td');cell.textContent=values[i];if(i===2){const sub=document.createElement('small');sub.textContent=b.organization||'—';cell.append(sub)}if(i===3)cell.className='places-cell';row.append(cell)}const statusCell=document.createElement('td'),tag=document.createElement('select');tag.className='status status-select '+b.status;tag.setAttribute('aria-label',t('Cập nhật trạng thái lượt đặt của {name}',{name:b.display_name}));for(const [value,label] of Object.entries(names))tag.add(new Option(t(label),value));tag.value=b.status;tag.onclick=e=>e?.stopPropagation();tag.onchange=async()=>{const next=tag.value;if(next===b.status)return;tag.disabled=true;try{await api('/api/admin/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.id,action:({pending:'reopen',active:'approve',rejected:'reject'})[next],expectedToken:b.edit_token,note:b.admin_note||''})});toast(t('Đã cập nhật trạng thái.'));await load()}catch(e){tag.value=b.status;toast(e.message)}finally{tag.disabled=false}};statusCell.append(tag);row.append(statusCell);const actionCell=document.createElement('td'),button=document.createElement('button');button.type='button';button.className='view-booking';button.textContent=t('Xem chi tiết');button.setAttribute('aria-label',t('Xem chi tiết lượt đặt của {name} ngày {date}',{name:b.display_name,date:formatDay(b.day)}));const open=()=>{reviewId=b.id;wholeMap=false;renderReview();if(!$('reviewModal').open)$('reviewModal').showModal()};button.onclick=e=>{e?.stopPropagation();open()};row.onclick=open;actionCell.className='row-actions';actionCell.append(button);for(const [action,label] of [['delete',t('Xóa')]]){const btn=document.createElement('button');btn.type='button';btn.textContent=label;btn.className=action==='delete'?'delete-booking':action==='approve'?'approve-booking':'';btn.setAttribute('aria-label',t('{action} lượt đặt của {name}',{action:label,name:b.display_name}));btn.onclick=e=>{e?.stopPropagation();openDecision(b,action)};actionCell.append(btn)}row.append(actionCell);body.append(row)}table.append(caption,head,body);$('requests').append(table)}renderReview()}
function detailsFields(b){return [[t('Chỗ đăng ký'),adminSeatLabel(placeSummary(b.seat_label))],[t('Người đăng ký'),b.display_name],[t('Đơn vị'),b.organization],['Email',b.email],[t('Điện thoại'),b.phone],[t('Người phụ trách'),b.leader],[t('Tiêu đề'),b.subject],[t('Mô tả'),b.description],[t('Số chỗ'),b.attendees],[t('Ghi chú quản lý'),b.admin_note],[t('Mã yêu cầu'),b.id]]}
function fillFields(node,fields){node.replaceChildren();for(const [key,value] of fields){const row=document.createElement('div'),label=document.createElement('small'),text=document.createElement('strong');label.textContent=key;text.textContent=value||'—';row.append(label,text);node.append(row)}}
function renderReview(){const b=data.find(b=>b.id===reviewId);$('reviewEmpty').hidden=!!b;$('reviewContent').hidden=!b;if(!b)return;$('reviewName').textContent=b.display_name;$('reviewOrg').textContent=b.organization||'';$('reviewTime').textContent=formatDay(b.day)+' · '+time(b.start_minute??b.start_slot*30)+'–'+time(b.end_minute??b.end_slot*30);$('reviewStatus').className='status '+b.status;$('reviewStatus').textContent=t(names[b.status]);const map=drawBookingMap($('reviewMap'),space,b,wholeMap);$('reviewArea').textContent=map.area+' · '+t('{count} chỗ',{count:b.attendees});$('mapWarning').textContent=map.missing.length?t('Có {count} vị trí không còn trên bố trí hiện tại. Kiểm tra danh sách ghế trước khi xử lý.',{count:map.missing.length}):'';$('mapScope').textContent=wholeMap?t('Xem khu vực đặt'):t('Xem toàn không gian');fillFields($('reviewFacts'),[[t('Tiêu đề'),b.subject],[t('Liên hệ'),b.phone+' · '+b.email]]);fillFields($('reviewDetails'),detailsFields(b));$('reviewActions').replaceChildren();const editButton=document.createElement('button');editButton.textContent=t('Sửa thông tin / thời gian');editButton.disabled=!policyConfig;editButton.onclick=()=>openEdit(b);$('reviewActions').append(editButton);for(const [action,label] of b.status==='pending'?[['approve',t('Duyệt yêu cầu')],['reject',t('Từ chối')]]:[]){const button=document.createElement('button');button.textContent=label;button.className=action==='approve'?'primary':'';button.onclick=()=>openDecision(b,action);$('reviewActions').append(button)}for(const [action,label] of [['delete',t('Xóa lượt đặt')]]){const btn=document.createElement('button');btn.textContent=label;btn.className=action==='delete'?'danger':'';btn.onclick=()=>openDecision(b,action);$('reviewActions').append(btn)}}
function paintViewCopy(){
 const editor=!$('editorView').hidden&&$('editorLink').className==='selected';
 const settings=!$('policyFold').hidden;
 $('pageTitle').textContent=t(editor?'Chỉnh sơ đồ':settings?'Cấu hình đặt chỗ':'Danh sách đặt chỗ');
 $('pageHelp').textContent=t(editor?'Chỉnh trực tiếp tại đây. Lưu để cập nhật bố trí cho trang đặt chỗ.':
  settings?'Điều chỉnh giờ hoạt động và quy định nhận đăng ký.':'Chọn một lượt đặt để xem đầy đủ thông tin, vị trí và xử lý yêu cầu.');
}
function showView(config){const wasEditor=!$('editorView').hidden;$('editorView').hidden=true;$('editorLink').className='';$('editorLink').setAttribute('aria-current','false');$('bookingView').hidden=config;$('policyFold').hidden=!config;$('policyFold').open=config;$('refresh').hidden=config;paintViewCopy();for(const [id,active] of [['bookingsLink',!config],['policyLink',config]]){$(id).className=active?'selected':'';$(id).setAttribute('aria-current',active?'page':'false')}if(window.matchMedia('(max-width: 800px)').matches){closeMenu()}if(wasEditor&&!config)load()}
$('editorLink').onclick=()=>{showView(false);$('bookingView').hidden=true;$('editorView').hidden=false;$('refresh').hidden=true;$('bookingsLink').className='';$('bookingsLink').setAttribute('aria-current','false');$('editorLink').className='selected';$('editorLink').setAttribute('aria-current','page');paintViewCopy();if(!$('editorFrame').src)$('editorFrame').src='/studio/index.html?embedded=1'};
$('policyLink').onclick=()=>showView(true);$('bookingsLink').onclick=()=>showView(false);
function closeMenu(){document.body.classList.remove('menu-open');$('menuBackdrop').hidden=true;$('menuToggle').setAttribute('aria-expanded','false')}
$('menuToggle').setAttribute('aria-expanded',String(!window.matchMedia('(max-width: 800px)').matches));
$('closeMenu').onclick=closeMenu;$('menuBackdrop').onclick=closeMenu;
$('menuToggle').onclick=()=>{const mobile=window.matchMedia('(max-width: 800px)').matches;const active=document.body.classList.toggle(mobile?'menu-open':'menu-collapsed');$('menuToggle').setAttribute('aria-expanded',String(mobile?active:!active));$('menuBackdrop').hidden=!(mobile&&active)};
$('closeReview').onclick=()=>$('reviewModal').close();
document.addEventListener('pointerdown',e=>{if(!$('accountMenu').contains(e.target))$('accountMenu').open=false});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('accountMenu').open){$('accountMenu').open=false;$('accountMenu').querySelector('summary').focus()}});
$('mapScope').onclick=()=>{wholeMap=!wholeMap;renderReview()};
function renderPages(total){const pages=Math.max(1,Math.ceil(total/PAGE_SIZE)),current=Math.floor(offset/PAGE_SIZE)+1;$('pageNumbers').replaceChildren();let last=0;for(const page of [...new Set([1,pages,current-1,current,current+1])].filter(p=>p>=1&&p<=pages).sort((a,b)=>a-b)){if(last&&page-last>1){const dots=document.createElement('span');dots.textContent='…';$('pageNumbers').append(dots)}const btn=document.createElement('button');btn.type='button';btn.textContent=String(page);btn.setAttribute('aria-label',t('Trang {page}',{page}));if(page===current){btn.className='selected';btn.setAttribute('aria-current','page')}btn.onclick=()=>{offset=(page-1)*PAGE_SIZE;return load()};$('pageNumbers').append(btn);last=page}$('pageLabel').textContent=t('Trang {page} / {pages}',{page:current,pages})}
function renderTotals(){
 $('totals').replaceChildren();for(const status of ['pending','active','rejected']){const card=document.createElement('button');card.type='button';card.className='stat '+status+($('status').value===status?' chosen':'');card.setAttribute('aria-pressed',String($('status').value===status));card.onclick=()=>{$('status').value=status;return resetFilter()};const count=document.createElement('strong'),label=document.createElement('span');count.textContent=latestTotals.find(t=>t.status===status)?.n||0;label.textContent=t(names[status]);card.append(count,label);$('totals').append(card)}
}
function renderUpdated(){
 if(!updatedAt)return;
 const time=updatedAt.toLocaleTimeString(adminLanguage()==='en'?'en-GB':'vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
 $('updated').textContent=t('Cập nhật {time}',{time});
}
async function load(){const seq=++loadSequence;if($('dayFrom').value&&$('dayTo').value&&$('dayFrom').value>$('dayTo').value){toast(t('Từ ngày phải trước hoặc bằng Đến ngày.'));return}try{const [b,layout]=await Promise.all([api('/api/admin/bookings?'+new URLSearchParams({status:$('status').value,from:$('dayFrom').value,to:$('dayTo').value,limit:String(PAGE_SIZE),resourceType:'seat',excludeCancelled:'1',search:$('search').value,offset:String(offset)})),api('/api/space').catch(()=>({space:null}))]);if(seq!==loadSequence)return;data=b.bookings;offset=b.offset??offset;totalCount=Number(b.totalCount??offset+(b.hasMore?PAGE_SIZE+1:data.length));renderPages(totalCount);$('previousPage').disabled=offset===0;$('nextPage').disabled=!b.hasMore;space=layout.space;latestTotals=b.totals;renderTotals();const snapshot=JSON.stringify({data,space,offset,totalCount});if(snapshot!==lastSnapshot){lastSnapshot=snapshot;render()}updatedAt=new Date();renderUpdated();}catch(e){if(seq===loadSequence)toast(e.message)}}
const todayParts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));const today=todayParts.year+'-'+todayParts.month+'-'+todayParts.day;$('dayFrom').value=today;$('dayTo').value='';
const auth=await fetch('/api/admin/auth').then(r=>r.json());if(!auth.authenticated){location.replace('/admin/login/')}else{$('dashboard').hidden=false;await load()}
$('refresh').onclick=load;const resetFilter=()=>{clearTimeout(searchTimer);offset=0;return load()};$('status').onchange=resetFilter;$('dayFrom').onchange=resetFilter;$('dayTo').onchange=resetFilter;$('search').oninput=()=>{++loadSequence;clearTimeout(searchTimer);searchTimer=setTimeout(resetFilter,250)};$('previousPage').onclick=()=>{offset=Math.max(0,offset-PAGE_SIZE);return load()};$('nextPage').onclick=()=>{offset+=PAGE_SIZE;return load()};setInterval(()=>{if(!document.hidden&&$('editorView').hidden&&!$('decisionModal').open&&!$('editModal').open)load()},15000);
$('logout').onclick=async()=>{$('accountMenu').open=false;try{await api('/api/admin/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});location.replace('/admin/login/')}catch(e){toast(e.message)}};
$('passwordButton').onclick=()=>{$('accountMenu').open=false;$('passwordModal').showModal()};$('closePassword').onclick=()=>$('passwordModal').close();$('passwordForm').onsubmit=async e=>{e.preventDefault();if($('newPassword').value!==$('confirmPassword').value){$('passwordError').textContent=t('Hai mật khẩu mới chưa trùng nhau.');return}$('savePassword').disabled=true;try{await api('/api/admin/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'password',currentPassword:$('currentPassword').value,newPassword:$('newPassword').value})});location.replace('/admin/login/')}catch(e){$('passwordError').textContent=e.message;$('savePassword').disabled=false}};


function showDetails(b){$('detailsContent').replaceChildren();const fields=[[t('Loại'),b.resource_type==='room'?t('Đăng ký phòng'):t('Đặt ghế')],[t('Phòng / ghế'),adminSeatLabel(placeSummary(b.seat_label))],[t('Cơ sở'),b.campus],[t('Ngày / giờ'),formatDay(b.day)+' · '+time(b.start_minute??b.start_slot*30)+'–'+time(b.end_minute??b.end_slot*30)],[t('Nhóm'),{startup:'Startup',faculty:t('Thầy / Cô'),staff:t('Cán bộ / Nhân sự'),other:t('Khác')}[b.group_type]||b.group_type],[t('Người đăng ký'),b.display_name],[t('Đơn vị / dự án'),b.organization],['Email',b.email],[t('Điện thoại'),b.phone],[t('Người chủ trì'),b.leader],[t('Tiêu đề'),b.subject],[t('Mô tả'),b.description],[t('Số người'),b.attendees],[t('Trạng thái'),t(names[b.status])],[t('Ghi chú quản lý'),b.admin_note],[t('Mã đăng ký'),b.id]];for(const [label,value] of fields){const div=document.createElement('div');div.textContent=label+': '+(value||'—');$('detailsContent').append(div)}$('detailsModal').showModal()}
function openDecision(b,action){$('decisionStatusField').hidden=action!=='status';$('deleteWarning').hidden=action!=='delete';$('decisionNoteField').hidden=action==='delete';$('decisionStatus').replaceChildren();for(const [value,label] of [['reopen',t('Chờ duyệt')],['approve',t('Đã duyệt')],['reject',t('Từ chối')]])if(({reopen:'pending',approve:'active',reject:'rejected'})[value]!==b.status)$('decisionStatus').add(new Option(label,value));$('decisionStatus').value=b.status==='pending'?'approve':'reopen';$('confirmAction').textContent=action==='delete'?t('Xóa vĩnh viễn'):t('Xác nhận');decision={b,action};$('decisionTitle').textContent={approve:t('Duyệt đăng ký'),reject:t('Từ chối đăng ký'),status:t('Cập nhật trạng thái'),delete:t('Xóa lượt đặt')}[action];$('decisionSummary').textContent=b.display_name+' · '+t('{count} chỗ',{count:b.attendees})+'\n'+adminSeatLabel(placeSummary(b.seat_label))+'\n'+formatDay(b.day)+' · '+time(b.start_minute??b.start_slot*30)+'–'+time(b.end_minute??b.end_slot*30);$('decisionNote').value=b.admin_note||'';const map=drawBookingMap($('decisionMap'),space,b,false);$('decisionMapNote').textContent=map.missing.length?t('Có vị trí không còn trên sơ đồ hiện tại. Kiểm tra trước khi xác nhận.'):t('Màu cam là các chỗ thuộc lượt đặt đang xử lý.');$('decisionModal').showModal()}
$('closeDetails').onclick=()=>$('detailsModal').close();$('closeDecision').onclick=()=>$('decisionModal').close();$('decisionForm').onsubmit=async e=>{e.preventDefault();if(!decision)return;$('confirmAction').disabled=true;try{await api('/api/admin/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:decision.b.id,action:decision.action==='status'?$('decisionStatus').value:decision.action,expectedToken:decision.b.edit_token,note:$('decisionNote').value})});$('decisionModal').close();toast(t('Đã xử lý đăng ký.'));await load()}catch(e){toast(e.message)}finally{$('confirmAction').disabled=false}};
const minutes=s=>{const [h,m]=s.split(':').map(Number);return h*60+m};
async function loadConfig(){try{const cfg=await api('/api/settings');policyConfig=cfg.policy;policyRevision=cfg.revision;$('roomsOpen').checked=false;$('seatsOpen').checked=policyConfig.seatsOpen;$('unlimitedBooking').checked=policyConfig.unlimitedBooking!==false;$('openTime').value=time(policyConfig.openMinute);$('closeTime').value=time(policyConfig.closeMinute);for(const id of ['minMinutes','maxRoomMinutes','maxSeatMinutes','stepMinutes','advanceDays','bufferMinutes','notice'])$(id).value=policyConfig[id];const syncUnlimited=()=>{const unlimited=$('unlimitedBooking').checked;$('maxSeatMinutes').disabled=unlimited;$('advanceDays').disabled=unlimited};$('unlimitedBooking').onchange=syncUnlimited;syncUnlimited();$('weekdays').replaceChildren();weekdayLabels=[];for(let d=0;d<7;d++){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=d;input.checked=policyConfig.weekdays.includes(d);const dayLabel=document.createTextNode(t(weekdayNames[d]));weekdayLabels.push(dayLabel);label.append(input,dayLabel);$('weekdays').append(label)}}catch(e){toast(e.message)}}
$('policyForm').onsubmit=async e=>{e.preventDefault();$('savePolicy').disabled=true;const policy={...policyConfig,roomsOpen:$('roomsOpen').checked,seatsOpen:$('seatsOpen').checked,unlimitedBooking:$('unlimitedBooking').checked,openMinute:minutes($('openTime').value),closeMinute:minutes($('closeTime').value),weekdays:[...$('weekdays').querySelectorAll('input:checked')].map(i=>Number(i.value)),notice:$('notice').value};for(const id of ['minMinutes','maxRoomMinutes','maxSeatMinutes','stepMinutes','advanceDays','bufferMinutes'])policy[id]=Number($(id).value);try{const result=await api('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({policy,revision:policyRevision})});policyConfig=result.policy;policyRevision=result.revision;toast(t(policy.seatsOpen?'Đã lưu cấu hình. Đặt ghế đang mở.':'Đã lưu cấu hình. Đặt ghế đã đóng.'))}catch(e){toast(e.message)}finally{$('savePolicy').disabled=false}};
if(auth.authenticated){await loadConfig();renderReview()}



// Keep trigger labels in sync after the shared popup commits.
$('editStart').onchange=()=>editStartClock.sync();$('editEnd').onchange=()=>editEndClock.sync();
function renderEditSeats(){
 const resources=space?bookingResources(normalizeBookingLayout(space.data)):[];
 const list=$('editSeats'),maps=$('editMap'),inputs=new Map();
 list.replaceChildren();
 maps.replaceChildren();
 const syncSelection=()=>{
  for(const [id,input] of inputs)input.checked=editPicked.has(id);
  for(const node of maps.querySelectorAll('[data-resource-id]')){
   const chosen=editPicked.has(node.getAttribute('data-resource-id'));
   if(node.getAttribute('role')==='button')node.setAttribute('aria-pressed',String(chosen));
   node.classList.toggle('requested',chosen);
  }
 };
 const pick=seat=>{
  if(editPicked.has(seat.id))editPicked.delete(seat.id);
  else{
   if(seat.capacity===6||resources.some(r=>r.capacity===6&&editPicked.has(r.id)))editPicked.clear();
   editPicked.add(seat.id);
  }
  syncSelection();
 };
 for(const seat of resources){
  const label=document.createElement('label'),input=document.createElement('input');
  input.type='checkbox';
  inputs.set(seat.id,input);
  label.className='edit-seat';
  label.append(input,document.createTextNode(adminSeatLabel(seat.code)+(seat.capacity===6?' · '+t('{count} chỗ',{count:6}):'')));
  input.onchange=()=>pick(seat);
  list.append(label);
 }
 const preview={...editing,seat_ids:'[]',seat_label:''};
 for(const [area,label,capacity] of [['working','Khu 1 · Bàn 1–6',1],['meeting','Khu 2 · Bàn 7 bên trong',6]]){
  if((resources.length||area==='meeting')&&!resources.some(seat=>seat.capacity===capacity))continue;
  const panel=document.createElement('div');
  drawBookingMap(panel,space,{...preview,seat_label:t(label)},false,{area,onPick:pick});
  maps.append(panel);
 }
 syncSelection();
}
function openEdit(b){editing=b;editPicked.clear();for(const id of b.seat_ids?JSON.parse(b.seat_ids):[b.seat_id])editPicked.add(id);$('editDay').value=b.day;const fields={editName:b.display_name,editOrg:b.organization,editGroup:b.group_type,editEmail:b.email,editPhone:b.phone,editLeader:b.leader,editSubject:b.subject,editDescription:b.description,editNote:b.admin_note};for(const [id,value] of Object.entries(fields))$(id).value=value||'';for(const [id,kind,value] of [['editStart','start',b.start_minute??b.start_slot*30],['editEnd','end',b.end_minute??b.end_slot*30]]){$(id).replaceChildren();const choices=timeChoices(policyConfig,kind);if(!choices.includes(value))choices.push(value);for(const m of choices.sort((a,b)=>a-b))$(id).add(new Option(time(m),m));$(id).value=value}editStartClock.sync();editEndClock.sync();$('editError').textContent='';renderEditSeats();$('editModal').showModal()}
$('closeEdit').onclick=()=>{editStartClock.close();editEndClock.close();$('editModal').close()};
$('editForm').onsubmit=async e=>{e.preventDefault();if(!editing)return;$('saveEdit').disabled=true;$('editError').textContent='';const b={action:'edit',id:editing.id,expectedToken:editing.edit_token,seatIds:[...editPicked],day:$('editDay').value,startMinute:Number($('editStart').value),endMinute:Number($('editEnd').value),displayName:$('editName').value,organization:$('editOrg').value,groupType:$('editGroup').value,email:$('editEmail').value,phone:$('editPhone').value,leader:$('editLeader').value,subject:$('editSubject').value,description:$('editDescription').value,adminNote:$('editNote').value};try{await api('/api/admin/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});editStartClock.close();editEndClock.close();$('editModal').close();toast(t('Đã lưu thay đổi.'));await load()}catch(e){$('editError').textContent=e.message}finally{$('saveEdit').disabled=false}};
