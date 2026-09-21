'use strict';
const B=Bookmarks, $=id=>document.getElementById(id);
let bookmarks=[], folders=[], sources=[], selected=new Set(), history=[], view='all', activeFolder=null, page=0, editing=null, folderMode='move', busy=false;
const PAGE_SIZE=80;
let messageTimer;
function message(text) { $('status').textContent=text; clearTimeout(messageTimer); messageTimer=setTimeout(()=>$('status').textContent='',9000); }
function snapshot() { history.push(JSON.stringify({bookmarks,folders,sources})); if(history.length>15) history.shift(); }
function groups() {return B.duplicateGroups(bookmarks,$('relaxed').checked);}
function visible() {
  const query=$('search').value.toLocaleLowerCase('de');
  const dupIds=new Set(groups().flat().map(b=>b.id));
  const sort=$('sort').value;
  const key=b=>sort==='domain'?domain(b.url):sort==='folder'?b.folder.join(' / '):sort==='source'?b.source:b.title;
  return bookmarks.filter(b=>(view!=='duplicates'||dupIds.has(b.id))&&(view!=='folder'||activeFolder.every((s,i)=>b.folder[i]===s))&&[b.title,b.url,b.folder.join(' / '),...b.tags].join(' ').toLocaleLowerCase('de').includes(query)).sort((a,b)=>{
    if(view==='duplicates') {const difference=B.urlKey(a.url,$('relaxed').checked).localeCompare(B.urlKey(b.url,$('relaxed').checked),'de');if(difference)return difference;}
    return key(a).localeCompare(key(b),'de')||a.title.localeCompare(b.title,'de');
  });
}
function domain(url) { try{return new URL(url).hostname||url;}catch{return url;} }
function safeLink(url) {try{return ['http:','https:'].includes(new URL(url).protocol);}catch{return false;} }
function render() {
  const allFolders=B.allFolders(bookmarks,folders), duplicates=groups(), dupIds=new Set(duplicates.flat().map(b=>b.id));
  $('count').textContent=bookmarks.length; $('folders-count').textContent=allFolders.length;
  $('duplicates-count').textContent=duplicates.reduce((n,g)=>n+g.length-1,0); $('sources-count').textContent=sources.length;
  $('undo').disabled=!history.length; $('export').disabled=!bookmarks.length&&!folders.length;
  $('remove-empty-folders').disabled=!B.emptyFolders(bookmarks,folders).length;
  $('all').classList.toggle('active',view==='all');$('duplicates').classList.toggle('active',view==='duplicates');
  $('view-title').textContent=view==='duplicates'?'Duplikate prüfen':view==='folder'?activeFolder.join(' / '):'Alle Lesezeichen';
  $('view-description').textContent=view==='duplicates'?'Gleiche URLs stehen zusammen. Du entscheidest, was bleibt.':'Deine Sammlungen, übersichtlich an einem Ort.';
  $('duplicate-options').hidden=view!=='duplicates';
  $('folder-list').replaceChildren();
  allFolders.forEach(path=>{const button=document.createElement('button');button.className='nav';button.textContent='▱ '+path.join(' / ');button.classList.toggle('active',view==='folder'&&B.pathKey(path)===B.pathKey(activeFolder));button.onclick=()=>{view='folder';activeFolder=path;page=0;selected.clear();render();};$('folder-list').append(button);});
  $('folder-suggestions').replaceChildren(...allFolders.map(path=>{const o=document.createElement('option');o.value=path.join(' / ');return o;}));
  const items=visible();page=Math.max(0,Math.min(page,Math.ceil(items.length/PAGE_SIZE)-1));
  const pageItems=items.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  $('list').innerHTML=pageItems.map(b=>`<div class="row"><input type="checkbox" data-select="${b.id}" aria-label="${B.escape(b.title)} auswählen" ${selected.has(b.id)?'checked':''}><div class="site-icon">${B.escape((domain(b.url)[0]||'↗').toUpperCase())}</div><div>${safeLink(b.url)?`<a class="row-title" href="${B.escape(b.url)}" target="_blank" rel="noopener noreferrer">${B.escape(b.title)}</a>`:`<span class="row-title">${B.escape(b.title)}</span>`}${dupIds.has(b.id)?'<span class="badge">Doppelt</span>':''}<div class="url" title="${B.escape(b.url)}">${B.escape(b.url)}</div><div class="meta">${B.escape(b.folder.join(' / ')||'Ohne Ordner')} · ${B.escape(b.source)}${b.tags.length?' · '+B.escape(b.tags.map(t=>'#'+t).join(' ')):''}</div></div><button data-edit="${b.id}" aria-label="${B.escape(b.title)} bearbeiten">Bearbeiten</button></div>`).join('');
  if(!items.length) $('list').innerHTML=`<div class="empty"><div class="symbol">${bookmarks.length?'⌕':'▥'}</div><h3>${bookmarks.length?'Hier ist alles übersichtlich.':'Bereit für einen frischen Überblick?'}</h3><p>${bookmarks.length?'Keine passenden Lesezeichen für diese Ansicht.':'Importiere deine erste Datei. Deine Ordner ziehen mit ein.'}</p></div>`;
  $('selected-count').textContent=selected.size+' ausgewählt';$('move').disabled=$('delete').disabled=!selected.size;
  $('select-all').checked=pageItems.length>0&&pageItems.every(b=>selected.has(b.id));$('select-all').indeterminate=pageItems.some(b=>selected.has(b.id))&&!$('select-all').checked;
  $('pagination').replaceChildren();
  if(items.length>PAGE_SIZE){const prev=document.createElement('button'),next=document.createElement('button'),label=document.createElement('span');prev.textContent='←';next.textContent='→';prev.disabled=page===0;next.disabled=(page+1)*PAGE_SIZE>=items.length;prev.onclick=()=>{page--;render();};next.onclick=()=>{page++;render();};label.textContent=`${page+1} / ${Math.ceil(items.length/PAGE_SIZE)} · ${items.length} Einträge`;$('pagination').append(prev,label,next);}
}
async function importFiles(files) {
  if(busy)return;busy=true;$('import').disabled=true;
  const imported=[],importedFolders=[],importedSources=[],errors=[];
  try {
    for(const file of files) {
      try {
        if(/\.jsonlz4$/i.test(file.name))throw new Error('Komprimierte .jsonlz4-Dateien bitte zuerst entpacken oder aus Firefox als HTML exportieren.');
        if(file.size>50*1024*1024)throw new Error('Die Datei ist größer als 50 MB.');
        const text=await file.text();
        const result=/\.json$/i.test(file.name)||/^\s*[\[{]/.test(text)?B.parseJSON(text,file.name):B.parseHTML(text,file.name);
        imported.push(...result.bookmarks.map(b=>({...b,id:crypto.randomUUID()})));importedFolders.push(...result.folders);importedSources.push(file.name);
      } catch(error){errors.push(`${file.name}: ${error.message}`);}
    }
    if(importedSources.length){snapshot();bookmarks.push(...imported);folders.push(...importedFolders);sources.push(...importedSources);page=0;render();}
    message(`${imported.length} Lesezeichen aus ${importedSources.length} Dateien importiert.${errors.length?' '+errors.join(' '):' Originaldateien bleiben unverändert.'}`);
  } finally {busy=false;$('import').disabled=false;$('files').value='';}
}
$('import').onclick=()=>$('files').click();$('files').onchange=e=>importFiles([...e.target.files]);
for(const name of ['dragenter','dragover'])$('dropzone').addEventListener(name,e=>{e.preventDefault();$('dropzone').classList.add('drag');});
$('dropzone').ondragleave=()=>$('dropzone').classList.remove('drag');$('dropzone').ondrop=e=>{e.preventDefault();$('dropzone').classList.remove('drag');importFiles([...e.dataTransfer.files]);};
// Prevent accidental navigation when a file is dropped outside the import area.
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
$('all').onclick=()=>{view='all';page=0;selected.clear();render();};$('duplicates').onclick=()=>{view='duplicates';page=0;selected.clear();render();};
$('search').oninput=()=>{page=0;selected.clear();render();};$('sort').onchange=()=>{page=0;render();};$('relaxed').onchange=()=>{selected.clear();page=0;render();};
$('list').onchange=e=>{const id=e.target.dataset.select;if(id){if(e.target.checked)selected.add(id);else selected.delete(id);render();}};
$('select-all').onchange=e=>{visible().slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).forEach(b=>e.target.checked?selected.add(b.id):selected.delete(b.id));render();};
$('dedupe').onclick=()=>{const ids=new Set(visible().map(b=>b.id));selected=new Set(groups().flatMap(g=>g.slice(1)).filter(b=>ids.has(b.id)).map(b=>b.id));render();message(`${selected.size} überzählige Einträge ausgewählt. Mit „Entfernen“ löschen; „Rückgängig“ stellt sie wieder her.`);};
$('delete').onclick=()=>{snapshot();const count=selected.size;bookmarks=bookmarks.filter(b=>!selected.has(b.id));selected.clear();render();message(`${count} Lesezeichen entfernt. Rückgängig ist möglich.`);};
$('remove-empty-folders').onclick=()=>{
  const empty=new Set(B.emptyFolders(bookmarks,folders).map(B.pathKey));
  if(!empty.size)return;
  snapshot();folders=folders.filter(path=>!empty.has(B.pathKey(path)));
  if(view==='folder'&&empty.has(B.pathKey(activeFolder))){view='all';activeFolder=null;page=0;selected.clear();}
  render();message(`${empty.size} leere Ordner entfernt. Rückgängig ist möglich.`);
};
$('undo').onclick=()=>{const state=JSON.parse(history.pop());({bookmarks,folders,sources}=state);selected.clear();render();message('Letzte Änderung rückgängig gemacht.');};
$('list').onclick=e=>{const id=e.target.closest('[data-edit]')?.dataset.edit;if(!id)return;editing=id;const b=bookmarks.find(b=>b.id===id),f=$('edit-form').elements;f.title.value=b.title;f.url.value=b.url;f.folder.value=b.folder.join(' / ');f.tags.value=b.tags.join(', ');$('edit-dialog').showModal();};
const parsePath=value=>B.allFolders(bookmarks,folders).find(path=>path.join(' / ')===value)||value.split('/').map(s=>s.trim()).filter(Boolean);
$('edit-form').onsubmit=e=>{e.preventDefault();const f=e.target.elements;snapshot();const b=bookmarks.find(b=>b.id===editing);Object.assign(b,{title:f.title.value.trim()||f.url.value.trim(),url:f.url.value.trim(),folder:parsePath(f.folder.value),tags:f.tags.value.split(',').map(s=>s.trim()).filter(Boolean)});$('edit-dialog').close();render();};
function folderDialog(mode){folderMode=mode;$('folder-dialog-title').textContent=mode==='move'?'Auswahl in Ordner verschieben':'Ordner anlegen';$('folder-form').elements.folder.value='';$('folder-dialog').showModal();}
$('move').onclick=()=>folderDialog('move');$('new-folder').onclick=()=>folderDialog('new');
$('folder-form').onsubmit=e=>{e.preventDefault();const path=parsePath(e.target.elements.folder.value);snapshot();if(path.length)folders.push(path);if(folderMode==='move'){bookmarks.forEach(b=>{if(selected.has(b.id))b.folder=path.slice();});selected.clear();}$('folder-dialog').close();render();};
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
$('export').onclick=()=>$('export-dialog').showModal();
function download(content,type,extension){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=`lesezeichen-${new Date().toISOString().slice(0,10)}.${extension}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Export erstellt. Deine Sammlung ist bereit.');}
$('export-html').onclick=()=>download(B.exportHTML(bookmarks,folders),'text/html;charset=utf-8','html');
$('export-json').onclick=()=>download(JSON.stringify({format:'bookmark-workshop',version:1,bookmarks,folders:B.allFolders(bookmarks,folders)},null,2),'application/json','json');
window.addEventListener('beforeunload',e=>{if(bookmarks.length||folders.length){e.preventDefault();e.returnValue='';}});
render();
