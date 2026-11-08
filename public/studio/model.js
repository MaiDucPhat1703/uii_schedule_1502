import * as THREE from './assets/three.module.js';
// Positions trace the unannotated plan on PDF p.10. Equipment sizes use the Word schedule.
export const scale=.0255;
export const editItems=[];
export const modelAudit={startupModules:[],startupChairs:[],hexTables:[],staffDesks:[],pods:[],equipment:[]};
const X=p=>(p-340)*scale,Z=p=>(p-340)*scale;
export const zones=[
{id:'startup',name:'Startup & Intern',sub:'8 cụm · 32 chỗ ngồi',icon:'▤',pos:[X(390),1.3,Z(245)],text:'Hai dãy bàn, mỗi dãy gồm 4 cụm 4 chỗ: tổng cộng 8 cụm và 32 ghế. Mỗi cụm 2.000 × 1.000 × 750 mm, mặt vân sồi trắng. Vách ngăn bàn rời: 6 cái theo danh mục.'},
{id:'teams',name:'Bàn cộng tác nhóm',sub:'6 bàn lục giác · 2 hàng × 3',icon:'⬡',pos:[X(380),1.1,Z(475)],text:'Giữ đủ 6 bàn lục giác hiện hữu theo mặt bằng. B&B, Edtronaut ở hàng trên; Yobite, SSVN ở hàng dưới. Hai bàn còn lại không gán tên dự án trong mặt bằng tổng thể.'},
{id:'perimeter',name:'Lãnh đạo & chuyên viên USI',sub:'Bố trí theo mặt bằng',icon:'▥',pos:[X(590),1.35,Z(70)],text:'Bàn lãnh đạo chữ L sát vách kính Internal. Bàn chuyên viên dọc tường trên và mép phải. Lưu ý: mặt bằng thể hiện 5 bàn chuyên viên; Word liệt kê 6 bộ. Chưa tự đặt thêm bàn thứ 6 khi chưa có vị trí xác nhận.'},
{id:'meeting',name:'Internal Meeting',sub:'Vách kính 4.500 × 2.400 mm',icon:'▣',pos:[X(890),.4,Z(155)],text:'Khu họp riêng ở phần mở rộng bên phải, ngăn bằng vách kính cường lực 12 mm. Giữ trống nội thất bên trong như bản vẽ; không tự thêm bàn ghế phòng họp.'},
{id:'pods',name:'Office Pod cách âm',sub:'2 cabin · 6 người / cabin',icon:'▣',pos:[X(103),2.4,Z(355)],text:'Hai cabin họp cách âm nằm phía trái như phối cảnh PDF, không phải cầu thang. Mỗi cabin 2.600 × 2.000 × 2.250 mm, hai ghế băng đối diện, bàn giữa và TV 24 inch. Có thể ẩn mái để xem bên trong.'},
{id:'utilities',name:'Pantry, locker & trưng bày',sub:'Tiện ích dọc tường dưới và bên phải',icon:'▥',pos:[X(525),1.8,Z(625)],text:'Kệ trưng bày ở tường dưới, locker 24 ngăn và quầy pantry ở góc dưới phải; tủ hồ sơ và máy photocopy ở mép phải, dưới dãy bàn chuyên viên. Vị trí đối chiếu các phối cảnh trang 19–24 của PDF.'}
];
export function buildModel(){
 const root=new THREE.Group(),groups={},walls=new THREE.Group(),roofs=new THREE.Group();root.add(walls);root.add(roofs);zones.forEach(z=>{groups[z.id]=new THREE.Group();groups[z.id].userData.zone=z.id;root.add(groups[z.id])});const materials={};
 function capture(parent,label,kind,fn){const old=new Set(parent.children);fn();const added=parent.children.filter(c=>!old.has(c));const g=new THREE.Group();g.userData.label=label;g.userData.kind=kind;parent.add(g);for(const c of added)g.attach(c);return g}
 const mat=(c)=>materials[c]??=new THREE.MeshStandardMaterial({color:c,roughness:.82});
 function box(w,h,d,x,y,z,c,p=root,outline=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;p.add(m);if(outline){const e=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:0x626963,transparent:true,opacity:.52}));m.add(e)}return m}
 function cyl(r,h,x,y,z,c,n=24,p=root){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,n),mat(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;p.add(m);return m}
 function bp(w,h,d,x,y,z,c,p=root){const m=box(w*scale,h,d*scale,X(x),y,Z(z),c,p);if(p===walls){m.userData.kind='wall';m.userData.label='Tường ngăn'}return m}
 function desk(x,z,w,d,p,c=0xeeeeea,rotation=0,electric=false){const g=new THREE.Group();g.position.set(X(x),0,Z(z));g.rotation.y=rotation;p.add(g);g.userData.kind='desk';g.userData.label=p===groups.startup?'Cụm bàn Startup 4 chỗ':'Bàn làm việc';box(w,.055,d,0,.75,0,c,g);if(electric){for(const sx of [-w/2+.13,w/2-.13]){box(.07,.7,.08,sx,.36,0,0xc4c7c3,g);box(.11,.05,d-.08,sx,.04,0,0x8b948d,g)}}else for(const dx of [-w/2+.08,w/2-.08])for(const dz of [-d/2+.06,d/2-.06])box(.045,.72,.045,dx,.36,dz,0x424a45,g);return g}
 function chairWorld(x,z,r,p,c=0x303733,type='office'){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=r;p.add(g);g.userData.kind='chair';g.userData.label='Ghế';box(.45,.09,.43,0,.45,0,c,g);box(.44,type==='office'?.52:.35,.065,0,type==='office'?.75:.65,.2,c,g);if(type==='office'){box(.29,.12,.07,0,1.08,.22,c,g);for(const s of [-1,1]){box(.035,.2,.035,s*.28,.57,0,0x424942,g);box(.1,.035,.33,s*.28,.68,0,0x424942,g)}cyl(.032,.38,0,.23,0,0x737e77,10,g);for(let i=0;i<5;i++){const a=i*Math.PI*.4;const leg=box(.035,.035,.26,Math.sin(a)*.12,.06,Math.cos(a)*.12,0x606960,g);leg.rotation.y=a;cyl(.035,.04,Math.sin(a)*.24,.04,Math.cos(a)*.24,0x272d29,8,g)}}else{for(const a of [-.17,.17])for(const b of [-.16,.16])box(.035,.41,.035,a,.22,b,0x787a6e,g)}return g}
 const chair=(x,z,r,p,c,type)=>chairWorld(X(x),Z(z),r,p,c,type);
 function monitor(parent,x=0,z=-.1,r=0){const g=new THREE.Group();g.position.set(x,.785,z);g.rotation.y=r;parent.add(g);box(.53,.33,.035,0,.25,0,0x3c4540,g);box(.47,.27,.008,0,.25,.022,0xb0c3cd,g,false);box(.035,.16,.035,0,.05,0,0x737e78,g);box(.22,.025,.12,0,-.01,0,0x6c746e,g);box(.28,.015,.1,0,0,.19,0x69726e,g);box(.035,.34,.34,.4,-.56,0,0x454e49,g)}
 function glass(w,h,d,x,y,z,p=walls){const m=box(w,h,d,x,y,z,0xc2d6df,p,false);m.material=new THREE.MeshStandardMaterial({color:0xc5dbe1,roughness:.12,transparent:true,opacity:.18,depthWrite:false});return m}
 const floorShape=new THREE.Shape();[[58,16],[1011,16],[1011,239],[600,239],[600,660],[48,660],[58,16]].forEach(([x,z],i)=>i?floorShape.lineTo(X(x),-Z(z)):floorShape.moveTo(X(x),-Z(z)));const floor=new THREE.Mesh(new THREE.ExtrudeGeometry(floorShape,{depth:.18,bevelEnabled:false}),mat(0xf5f5f0));floor.rotation.x=-Math.PI/2;floor.position.y=-.18;floor.receiveShadow=true;root.add(floor);
 // Perimeter: rear wall, Internal wing and actual corridor boundary at the pods.
 bp(953,2.7,5,534.5,1.35,18,0xb2c0c5,walls);bp(5,2.7,218,1008,1.35,128,0xb2c0c5,walls);bp(411,2.7,5,805,1.35,237,0xb2c0c5,walls);bp(5,2.7,423,599,1.35,449,0xe5e8e5,walls);bp(552,2.7,5,324,1.35,657,0xe5e8e5,walls);
 // Solid boundary behind the pods, with two glass entrance doors above and below.
 bp(5,2.7,410,57,1.35,353,0xb2c0c5,walls);
 for(const [za,zb] of [[68,150],[552,638]]){capture(walls,'Cửa kính lối vào','glass',()=>{const dz=(zb-za)*scale,c=Z((za+zb)/2);glass(.045,2.35,dz,X(58),1.17,c);for(const z of [Z(za),Z(zb)])box(.06,2.4,.06,X(58),1.2,z,0x5b6768,walls);box(.06,.06,dz,X(58),2.4,c,0x5b6768,walls);box(.04,2.35,.04,X(58),1.17,c,0x5b6768,walls);box(.08,.28,.025,X(60),1.1,c+.1,0x465257,walls)});}
 // Internal glass wall: nominal overall length 4.5 m from schedule, at the drawn x position.
 capture(walls,'Vách kính Internal Meeting','glass',()=>{const gx=X(781),gz=Z(128);for(let i=0;i<5;i++){const z=gz-2.25+.45+i*.9;glass(.025,2.4,.86,gx,1.2,z);box(.055,2.4,.035,gx,1.2,z-.45,0x3c4748,walls)}box(.06,.06,4.5,gx,2.4,gz,0x3c4748,walls);box(.06,.05,4.5,gx,.025,gz,0x3c4748,walls);box(.04,2.4,.04,gx,1.2,gz+2.25,0x3c4748,walls);});
 // Eight 2 x 1 m modules. Four modules compose each 8 m row, 16 chairs per row.
 const startup=groups.startup;for(let row=0;row<2;row++){const z=[196,293][row];for(let j=0;j<4;j++){const x=274+j*2/scale;const g=desk(x,z,2,1,startup,0xe8e5dc);modelAudit.startupModules.push({x,z,width:2,depth:1,height:.75});box(2,.045,.018,0,.795,0,0x99b052,g);for(const dx of [-.5,.5])for(const side of [-1,1]){const seat={x:X(x)+dx,z:Z(z)+side*.91};chairWorld(seat.x,seat.z,side===1?0:Math.PI,startup);modelAudit.startupChairs.push(seat)}}}
 // Six movable dividers in the schedule, distributed 3 per row.
 for(const z of [196,293])for(let i=0;i<3;i++)box(.5,.4,.02,X(310+i*2/scale),.98,Z(z),0xc7d69b,startup);
 // Six retained hexagonal tables, exact two-by-three arrangement from the PDF.
 const teams=groups.teams;for(const z of [425,532])for(const x of [271,379,480]){const g=new THREE.Group();g.position.set(X(x),0,Z(z));teams.add(g);g.userData.kind='hex';g.userData.label='Bàn lục giác';const top=new THREE.Mesh(new THREE.CylinderGeometry(.96,.96,.055,6),mat(0xf1f1ed));top.position.y=.75;top.rotation.y=Math.PI/6;g.add(top);const edge=new THREE.LineSegments(new THREE.EdgesGeometry(top.geometry),new THREE.LineBasicMaterial({color:0x616963}));top.add(edge);for(let i=0;i<6;i++){const a=i*Math.PI/3;box(.045,.72,.045,Math.cos(a)*.64,.36,Math.sin(a)*.64,0x646a66,g)}modelAudit.hexTables.push({x,z});}
 for(const z of [425,532])for(const x of [271,379,480])for(let i=0;i<6;i++){const angle=i*Math.PI/3;chairWorld(X(x)+Math.sin(angle)*1.12,Z(z)+Math.cos(angle)*1.12,angle,groups.teams)}
 const per=groups.perimeter;
 // Only the five staff desks actually located on the supplied plan, not a guessed sixth.
 for(const [x,z,r] of [[477,56,0],[568,56,0],[688,201,0],[568,261,Math.PI/2],[568,323,Math.PI/2]]){const g=desk(x,z,1.4,.6,per,0xf3f3f1,r,true);monitor(g);const dx=Math.sin(r)*.64,dz=Math.cos(r)*.64;chairWorld(X(x)+dx,Z(z)+dz,r,per);modelAudit.staffDesks.push({x,z,width:1.4,depth:.6,rotation:r})}
 // Leader workstation, L surface and side storage next to the glass partition.
 const leader=new THREE.Group();leader.userData.kind='desk';leader.userData.label='Bàn lãnh đạo chữ L';leader.position.set(X(727),0,Z(83));leader.rotation.y=Math.PI/2;per.add(leader);box(1.6,.065,.7,0,.75,0,0xe8e6df,leader);box(.5,.065,.5,.55,.75,.6,0xe8e6df,leader);box(.48,.65,.48,.55,.335,.58,0xbbbcb4,leader);for(const sx of [-.7,.7])box(.055,.72,.055,sx,.36,-.26,0x606962,leader);monitor(leader);chair(764,83,Math.PI/2,per,0xe5e4da);for(const z of [65,95])chair(689,z,Math.PI/2,per,0xe5e4da,'visitor');
 // Retained rectangular table and four round stools at the upper left.
 const util=groups.utilities;desk(227,82,3.3,.75,util,0xa28c70);for(const x of [195,227,258]){chair(x,48,Math.PI,util,0xb7a184,'visitor');chair(x,116,0,util,0xb7a184,'visitor')}for(const [x,z] of [[315,57],[360,62],[314,99],[360,102]]){cyl(.32,.06,X(x),.52,Z(z),0xe9e9e1,24,util);cyl(.035,.49,X(x),.25,Z(z),0x717b73,12,util)}
 // Two real acoustic pods: doors, transparent fronts, benches, central table and a 24-inch screen.
 const pods=groups.pods;for(const pz of [260,448]){const px=105,cx=X(px),cz=Z(pz),w=2,d=2.6,h=2.25;const cabin=new THREE.Group();cabin.position.set(cx,0,cz);pods.add(cabin);cabin.userData.kind='pod';cabin.userData.label='Office Pod';box(w,.12,d,0,.06,0,0x626c6c,cabin);box(.10,h,d,-w/2,h/2,0,0x7f898c,cabin);for(const zz of [-d/2,d/2])box(w,h,.1,0,h/2,zz,0x7f898c,cabin);glass(.035,h,d-.18,w/2,h/2,0,cabin);for(const zz of [-d/2,0,d/2])box(.08,h,.05,w/2,h/2,zz,0x333c3e,cabin);box(.1,.08,d,w/2,h-.04,0,0x333c3e,cabin);box(.08,.08,d,w/2,.12,0,0x333c3e,cabin);box(.05,.4,.04,w/2+.025,1.1,.12,0x252d2d,cabin);for(const zz of [-.94,.94]){box(1.65,.12,.53,0,.45,zz,0x9fada8,cabin);box(1.65,.55,.13,0,.76,zz+Math.sign(zz)*.2,0x9fada8,cabin);box(1.65,.36,.5,0,.22,zz,0x606b66,cabin)}box(1.2,.055,.65,0,.75,0,0xd6c9a9,cabin);box(.08,.68,.35,0,.38,0,0x596660,cabin);box(.025,.32,.55,-.93,1.3,0,0x273b40,cabin);box(.027,.25,.48,-.91,1.3,0,0x8ab3bd,cabin);const roof=box(w+.06,.12,d+.06,0,h+.06,0,0x3b4142,cabin);roof.userData.isRoof=true;const cap=box(.65,.025,.6,0,h+.13,0,0x202c2d,cabin);cap.userData.isRoof=true;modelAudit.pods.push({x:px,z:pz,width:w,depth:d,height:h});}
 capture(util,'Tủ hồ sơ','cabinet',()=>{
// Cabinet at right: office storage 1.6 x .4 x 2m, rotated to face the room.
 const cX=X(585),cZ=Z(455);box(.4,2,1.6,cX,1,cZ,0xb8a488,util);for(let i=0;i<4;i++)box(.415,.025,1.55,cX, .4+i*.4,cZ,0x8e816a,util);for(const dz of [-.4,.4])box(.025,.15,.025,cX-.22,.97,cZ+dz,0x535e54,util);
 });
 capture(util,'Máy photocopy','equipment',()=>{
// Photocopier sits immediately above the storage cabinet.
 const printerX=X(582),printerZ=Z(393);box(.58,.7,.57,printerX,.35,printerZ,0xcdd3d0,util);box(.64,.13,.61,printerX,.77,printerZ,0xf1f2ef,util);box(.47,.035,.38,printerX,.85,printerZ,0x566762,util);box(.25,.08,.19,printerX-.15,.83,printerZ+.28,0x5c7276,util);for(let i=0;i<3;i++)box(.53,.015,.02,printerX,.15+i*.17,printerZ+.29,0x5c6764,util);
 });
 capture(util,'Tủ trưng bày','cabinet',()=>{
// Innovation showcase: 3 x .7 x 2m on the lower boundary, transparent both ways.
 const sx=X(263),sz=Z(637);box(3,.1,.7,sx,.05,sz,0xe0dfd6,util);box(3,.08,.7,sx,2,sz,0xd8d9d0,util);for(let i=0;i<=4;i++)box(.035,2,.7,sx-1.5+i*.75,1,sz,0xc0c7bf,util);for(let i=1;i<4;i++)box(3,.035,.7,sx,i*.5,sz,0xc4cbc4,util);glass(3,1.9,.02,sx,1,sz+.35,util);glass(3,1.9,.02,sx,1,sz-.35,util);for(let i=0;i<10;i++){const x=sx-1.2+(i%4)*.75,y=.55+Math.floor(i/4)*.5;box(.22,.3,.2,x,y,sz,i%2?0xc3ae77:0x819693,util)}
 });
 capture(util,'Locker 24 ngăn','cabinet',()=>{
// 24-compartment locker along lower edge near the pantry, 2.4 x .4 x 1.8m.
 const lx=X(484),lz=Z(638);box(2.4,1.8,.4,lx,.9,lz,0xc8b28d,util);for(let row=0;row<4;row++)for(let col=0;col<6;col++){const x=lx-1.2+(col+.5)*.4,y=(row+.5)*.45;box(.385,.435,.018,x,y,lz-.21,0xd6c29d,util);box(.03,.06,.03,x+.12,y,lz-.235,0x687066,util)}
 });
 capture(util,'Quầy pantry & lò vi sóng','cabinet',()=>{
// L-shaped pantry in lower-right corner, sink + microwave.
 const panx=X(580),panz=Z(581);box(.45,.88,2,panx,.44,panz,0xe5dfcf,util);box(.5,.045,2.06,panx,.90,panz,0xa7aaa2,util);box(1.05,.88,.45,panx-.3,.44,Z(633),0xe5dfcf,util);box(1.1,.045,.5,panx-.3,.90,Z(633),0xa7aaa2,util);box(.32,.02,.45,panx,.93,panz+.38,0x697f7f,util);box(.025,.3,.025,panx+.09,1.06,panz+.38,0x8c9690,util);box(.18,.025,.025,panx+.01,1.21,panz+.38,0x8c9690,util);box(.46,.28,.36,panx-.4,1.065,Z(633),0xd8dcd7,util);box(.36,.19,.018,panx-.4,1.065,Z(633)-.19,0x2d3d3e,util);
 });
 modelAudit.equipment.push('locker24','showcase','officeCabinet','photocopier','pantry','microwave','internalGlass');
 root.updateMatrixWorld(true);
 const counters={};for(const [zone,parent] of [...Object.entries(groups),['walls',walls]])for(const node of [...parent.children]){
 const kind=node.userData.kind||((zone==='startup')?'divider':'equipment');const n=counters[kind]=(counters[kind]||0)+1;
 const wrapper=new THREE.Group();parent.add(wrapper);wrapper.attach(node);root.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(wrapper),center=bounds.getCenter(new THREE.Vector3());const base=new THREE.Vector3(center.x,bounds.min.y,center.z);
 wrapper.position.copy(base);node.position.sub(base);wrapper.userData.editId=`${kind}-${n}`;wrapper.userData.kind=kind;wrapper.userData.label=node.userData.label||({divider:'Vách ngăn bàn',equipment:'Tiện ích'}[kind])||kind;
 wrapper.userData.label += ' '+n;wrapper.userData.zone=zone;editItems.push({id:wrapper.userData.editId,kind,label:wrapper.userData.label,object:wrapper});
 }
 root.updateMatrixWorld(true);
 return {root,groups,walls,roofs,modelAudit,editItems};
}
