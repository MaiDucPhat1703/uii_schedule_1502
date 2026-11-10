// One editor implementation, with a compact workspace when opened by management.
if(new URLSearchParams(location.search).get('embedded')==='1'){
 const root=document.documentElement;root.classList.add('embedded-editor');
 window.addEventListener('DOMContentLoaded',()=>{
  const $=id=>document.getElementById(id);
  const show=(kind,open)=>{if(open&&window.matchMedia('(max-width: 600px)').matches){const other=kind==='tools'?'properties':'tools';root.classList.remove('show-'+other);$(other==='tools'?'embedTools':'embedProperties').setAttribute('aria-expanded','false')}root.classList.toggle('show-'+kind,open);$(kind==='tools'?'embedTools':'embedProperties').setAttribute('aria-expanded',String(open))};
  $('embedTools').onclick=()=>show('tools',!root.classList.contains('show-tools'));
  $('embedProperties').onclick=()=>show('properties',!root.classList.contains('show-properties'));
  window.addEventListener('editor-selection',e=>{if(e.detail)show('properties',true)});
  const more=document.createElement('details'),summary=document.createElement('summary'),content=document.createElement('div');
  more.className='editor-more';summary.textContent='Tùy chọn';more.append(summary,content);
  for(const id of ['open','saveAs','publishSeats','reference'])content.append($(id));
  document.querySelector('.savegroup').append(more);
  document.addEventListener('pointerdown',e=>{if(!more.contains(e.target))more.open=false});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){show('tools',false);show('properties',false);more.open=false}});
 });
}
