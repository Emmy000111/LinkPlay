/* StreamBox+ v2 — Browser Mode + Link Finder + Bookmarklet
   NOTE:
   - Set OPEN_SUBS_KEY (OpenSubtitles API key) to enable subtitle search
   - For scanning arbitrary pages, a CORS proxy is required (enter proxy URL in Proxy field).
   - The bookmarklet is the reliable way to extract links from pages when CORS/iframe blocks exist.
*/

const OPEN_SUBS_KEY = ""; // <-- put OpenSubtitles API key here to enable auto subtitle search

/**************** DOM ****************/
const linkInput = byId('linkInput');
const loadBtn = byId('loadBtn');
const player = byId('player');
const playPause = byId('playPause');
const rew10 = byId('rew10');
const fwd10 = byId('fwd10');
const seek = byId('seek');
const cur = byId('cur');
const dur = byId('dur');
const speed = byId('speed');
const vol = byId('vol');
const fullscreenBtn = byId('fullscreenBtn');
const pipBtn = byId('pipBtn');
const downloadNow = byId('downloadNow');
const addSubBtn = byId('addSubBtn');
const subFile = byId('subFile');
const searchSubsBtn = byId('searchSubsBtn');
const titleInput = byId('titleInput');
const subsList = byId('subsList');
const historyList = byId('historyList');
const downloadsList = byId('downloadsList');
const bookmarkBtn = byId('bookmarkBtn');
const historyBtn = byId('historyBtn');
const bigPlay = byId('bigPlay') || {};
const loader = byId('loader');
const linkResults = byId('foundLinks');

const browseUrl = byId('browseUrl');
const openBrowser = byId('openBrowser');
const siteFrame = byId('siteFrame');
const backBtn = byId('backBtn');
const forwardBtn = byId('forwardBtn');
const reloadBtn = byId('reloadBtn');
const proxyInput = byId('proxyInput');
const scanBtn = byId('scanBtn');
const generateBookmarklet = byId('generateBookmarklet');
const bookmarkletContainer = byId('bookmarkletContainer');

let hls = null;
let currentUrl = null;
let subtitleTrackEl = null;
let currentTitle = null;

/************ Utilities ************/
function byId(id){ return document.getElementById(id); }
function show(id, v=true){ id.classList.toggle('hidden', !v); }
function fmt(t){ if(!t||isNaN(t)) return '0:00'; const m=Math.floor(t/60); const s=String(Math.floor(t%60)).padStart(2,'0'); return `${m}:${s}`; }

/************ Player core ************/
loadBtn.addEventListener('click', ()=> loadAndPlay(linkInput.value.trim()));
playPause.addEventListener('click', ()=> player.paused ? player.play() : player.pause());
rew10.addEventListener('click', ()=> seekBy(-10));
fwd10.addEventListener('click', ()=> seekBy(10));
speed.addEventListener('change', ()=> player.playbackRate = parseFloat(speed.value));
vol.addEventListener('input', ()=> player.volume = parseFloat(vol.value));
fullscreenBtn.addEventListener('click', toggleFullscreen);
pipBtn.addEventListener('click', togglePip);
downloadNow.addEventListener('click', downloadCurrentVideo);

player.addEventListener('timeupdate', ()=>{
  if(player.duration){ seek.value = (player.currentTime/player.duration)*100; cur.textContent = fmt(player.currentTime); dur.textContent = fmt(player.duration); saveResume(); }
});
seek.addEventListener('input', ()=> { if(player.duration) player.currentTime = (seek.value/100)*player.duration; });

async function loadAndPlay(url){
  if(!url){ alert('Paste a link first'); return; }
  currentUrl = url;
  currentTitle = titleInput.value.trim() || deriveTitleFromUrl(url);
  show(loader, true);
  // cleanup
  if(hls){ try{ hls.destroy(); }catch(e){} hls = null; }
  try{
    if(url.endsWith('.m3u8')){
      if(Hls.isSupported()){
        hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(player);
        hls.on(Hls.Events.MANIFEST_PARSED, ()=> { player.play().catch(()=>{}); show(loader,false); });
      } else {
        player.src = url;
        await player.play().catch(()=>{});
        show(loader,false);
      }
    } else {
      player.src = url;
      await player.play().catch(()=>{});
      show(loader,false);
    }
    saveHistory({title:currentTitle,url:currentUrl,time:Date.now()});
    restoreResume();
    renderHistory(); renderDownloads();
  }catch(err){
    console.error(err); show(loader,false); alert('Failed to load video (CORS or network).');
  }
}

function seekBy(sec){ player.currentTime = Math.max(0, Math.min(player.duration||0, player.currentTime + sec)); }
function toggleFullscreen(){ if(document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }
async function togglePip(){ try{ if(document.pictureInPictureElement) await document.exitPictureInPicture(); else await player.requestPictureInPicture(); }catch(e){ alert('PiP not supported'); } }

/************ Bookmarklet generator ************/
generateBookmarklet.addEventListener('click', ()=>{
  const bmCode = `javascript:(function(){try{const found=[];document.querySelectorAll('video, source, a[href]').forEach(n=>{let s=n.src||n.href; if(s && (s.match(/\\.m3u8($|\\?)/i) || s.match(/\\.mp4($|\\?)/i))) found.push(s)}); if(found.length){ const txt=found.filter((v,i)=>found.indexOf(v)===i).join('\\n'); try{navigator.clipboard.writeText(txt).then(()=>alert('Copied '+found.length+' link(s) to clipboard'));}catch(e){ prompt('Copy links:', txt);} } else alert('No mp4/m3u8 links found on this page'); }catch(e){alert('Error: '+e)}})();`;
  const short = bmCode; // already compact
  bookmarkletContainer.textContent = '';
  const a = document.createElement('a'); a.href = short; a.textContent = 'Drag this to your bookmarks bar: [Extract Video Links]'; a.style.color = '#fff'; a.style.display='inline-block'; a.style.padding='6px 8px'; a.style.background='#111'; a.style.borderRadius='6px'; bookmarkletContainer.appendChild(a);
  const txtBox = document.createElement('textarea'); txtBox.rows=3; txtBox.style.width='100%'; txtBox.value = short; bookmarkletContainer.appendChild(txtBox);
  alert('Bookmarklet generated — drag to bookmarks or copy the code into a new bookmark.');
});

/************ Scan page via optional proxy ************/
openBrowser.addEventListener('click', ()=>{
  let url = browseUrl.value.trim();
  if(!url) { alert('Enter a URL to open in browser mode'); return; }
  if(!/^https?:\/\//i.test(url)) url = 'https://' + url;
  siteFrame.src = url;
});

backBtn.addEventListener('click', ()=> { try{ siteFrame.contentWindow.history.back(); }catch(e){ /* cross-origin may block */ }});
forwardBtn.addEventListener('click', ()=> { try{ siteFrame.contentWindow.history.forward(); }catch(e){} });
reloadBtn.addEventListener('click', ()=> { siteFrame.src = siteFrame.src; });

scanBtn.addEventListener('click', async ()=>{
  const pageUrl = siteFrame.src || browseUrl.value.trim();
  const proxy = proxyInput.value.trim();
  if(!pageUrl){ alert('Open the page you want to scan first'); return; }
  if(!proxy){ alert('Enter a CORS proxy URL to enable scanning (or use the bookmarklet)'); return; }
  try{
    show(loader,true);
    const fetchUrl = proxy + encodeURIComponent(pageUrl);
    const res = await fetch(fetchUrl);
    if(!res.ok) throw new Error('Fetch failed ' + res.status);
    const html = await res.text();
    const links = extractVideoLinksFromHtml(html);
    renderFoundLinks(links);
    show(loader,false);
  }catch(err){
    console.error(err); show(loader,false); alert('Scan failed: ' + err.message);
  }
});

function extractVideoLinksFromHtml(html){
  const out = [];
  const mp4s = html.match(/https?:\/\/[^"'<>\\s]+?\\.mp4(?:\\?[^"'<>\\s]*)?/ig) || [];
  const m3u8 = html.match(/https?:\/\/[^"'<>\\s]+?\\.m3u8(?:\\?[^"'<>\\s]*)?/ig) || [];
  mp4s.concat(m3u8).forEach(u=>{ if(!out.includes(u)) out.push(u); });
  return out;
}

function renderFoundLinks(links){
  linkResults.innerHTML = '';
  if(!links.length) { linkResults.innerHTML = '<div class="item">No links found</div>'; return; }
  links.forEach(l=>{
    const div = document.createElement('div'); div.className='item';
    const meta = document.createElement('div'); meta.className='meta'; meta.textContent = l;
    const copyBtn = document.createElement('button'); copyBtn.textContent='Copy'; copyBtn.onclick = ()=> { navigator.clipboard.writeText(l).then(()=>alert('Copied')); };
    const loadBtn = document.createElement('button'); loadBtn.textContent='Load'; loadBtn.onclick = ()=> { linkInput.value = l; loadAndPlay(l); };
    div.appendChild(meta); div.appendChild(copyBtn); div.appendChild(loadBtn);
    linkResults.appendChild(div);
  });
}

/************ Subtitles (OpenSubtitles quick integration) ************/
searchSubsBtn.addEventListener('click', async ()=>{
  const title = titleInput.value.trim();
  if(!title) return alert('Enter a title to search subtitles');
  if(!OPEN_SUBS_KEY) return alert('Set OpenSubtitles API key in app.js to use subtitle search');
  subsList.innerHTML = '<div class="item">Searching…</div>';
  try{
    const url = `https://api.opensubtitles.com/api/v1/subtitles?query=${encodeURIComponent(title)}&languages=en`;
    const res = await fetch(url, { headers: {'Api-Key': OPEN_SUBS_KEY} });
    if(!res.ok) throw new Error('Search failed: '+res.status);
    const j = await res.json();
    const list = j.data || [];
    subsList.innerHTML = '';
    if(!list.length) subsList.innerHTML = '<div class="item">No subtitles found</div>';
    list.slice(0,10).forEach(s=>{
      const div = document.createElement('div'); div.className='item';
      const meta = document.createElement('div'); meta.className='meta'; meta.innerHTML = `<strong>${s.attributes.filename || s.attributes.release}</strong><div style="font-size:12px;color:#bbb">${s.attributes.language}</div>`;
      const loadBtn = document.createElement('button'); loadBtn.textContent='Load'; loadBtn.onclick = ()=> fetchAndAttachSubtitle(s);
      div.appendChild(meta); div.appendChild(loadBtn); subsList.appendChild(div);
    });
  }catch(err){ console.error(err); subsList.innerHTML = '<div class="item">Search failed</div>'; }
});

async function fetchAndAttachSubtitle(subItem){
  try{
    show(loader,true);
    const fileId = subItem.attributes.files && subItem.attributes.files[0] && subItem.attributes.files[0].file_id;
    if(!fileId) { alert('No downloadable file found'); show(loader,false); return; }
    const tokenRes = await fetch('https://api.opensubtitles.com/api/v1/download', {
      method:'POST', headers: {'Api-Key': OPEN_SUBS_KEY, 'Content-Type': 'application/json'},
      body: JSON.stringify({file_id: fileId})
    });
    const json = await tokenRes.json();
    if(!json || !json.link) { alert('Failed to obtain subtitle link'); show(loader,false); return; }
    const subTextRes = await fetch(json.link);
    const subText = await subTextRes.text();
    const blob = new Blob([subText], {type:'text/vtt'});
    addSubtitleBlob(blob, subItem.attributes.filename || 'subtitle.vtt');
    show(loader,false);
  }catch(err){ console.error(err); show(loader,false); alert('Failed to fetch subtitle (CORS/rate limit)'); }
}

function addSubtitleBlob(blob, name){
  if(subtitleTrackEl) subtitleTrackEl.remove();
  const tr = document.createElement('track'); tr.kind='subtitles'; tr.label = name; tr.srclang='en'; tr.default = true;
  tr.src = URL.createObjectURL(blob);
  player.appendChild(tr);
  subtitleTrackEl = tr;
  alert('Subtitle attached');
}

/************ Downloads (IndexedDB) ************/
const DB_NAME='sb_v2_db', STORE='videos';
async function openDB(){
  return new Promise((res,rej)=>{
    const rq = indexedDB.open(DB_NAME,1);
    rq.onupgradeneeded = e => { const db=e.target.result; if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'id'}); };
    rq.onsuccess = e => res(e.target.result);
    rq.onerror = e => rej(e);
  });
}
async function saveBlob(name, blob){
  const db = await openDB(); const tx = db.transaction(STORE,'readwrite'); tx.objectStore(STORE).put({id:'v_'+Date.now(),name,blob,created:Date.now()});
  return new Promise((res,rej)=>{ tx.oncomplete = ()=> res(); tx.onerror = e => rej(e); });
}
async function getAllDownloads(){ const db = await openDB(); return new Promise((res,rej)=>{ const rq=db.transaction(STORE).objectStore(STORE).getAll(); rq.onsuccess = ()=> res(rq.result); rq.onerror = ()=> rej(rq.error); }); }
async function deleteDownload(id){ const db = await openDB(); const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).delete(id); return new Promise(res=> tx.oncomplete=()=>res()); }

async function downloadCurrentVideo(){
  if(!currentUrl) return alert('Load a video first');
  try{
    show(loader,true);
    const r = await fetch(currentUrl);
    if(!r.ok) throw new Error('Fetch failed '+r.status);
    const blob = await r.blob();
    const name = (titleInput.value.trim() || deriveTitleFromUrl(currentUrl)).replace(/\s+/g,'_');
    await saveBlob(name, blob);
    show(loader,false);
    alert('Saved to downloads');
    renderDownloads();
  }catch(err){ show(loader,false); console.error(err); alert('Download failed (CORS or large file)'); }
}

async function renderDownloads(){
  const items = await getAllDownloads();
  downloadsList.innerHTML = ''; if(!items.length) { downloadsList.innerHTML = '<div class="item">No downloads</div>'; return; }
  items.sort((a,b)=>b.created-a.created).forEach(it=>{
    const div = document.createElement('div'); div.className='item';
    const meta = document.createElement('div'); meta.className='meta'; meta.textContent = it.name;
    const play = document.createElement('button'); play.textContent='Play'; play.onclick = ()=> { loadLocalBlob(URL.createObjectURL(it.blob)); };
    const save = document.createElement('button'); save.textContent='Save'; save.onclick = ()=> { const a=document.createElement('a'); a.href=URL.createObjectURL(it.blob); a.download=it.name; document.body.appendChild(a); a.click(); a.remove(); };
    const del = document.createElement('button'); del.textContent='Delete'; del.onclick = async ()=>{ await deleteDownload(it.id); renderDownloads(); };
    div.appendChild(meta); div.appendChild(play); div.appendChild(save); div.appendChild(del); downloadsList.appendChild(div);
  });
}
function loadLocalBlob(url){ if(hls){ try{ hls.destroy(); }catch(e){} hls=null; } player.src = url; player.play().catch(()=>{}); }

/************ History & Resume ************/
const HS_KEY='sb_history';
function saveHistory(entry){ const arr = JSON.parse(localStorage.getItem(HS_KEY)||'[]'); arr.unshift(entry); localStorage.setItem(HS_KEY, JSON.stringify(arr.slice(0,50))); renderHistory(); }
function renderHistory(){ const arr = JSON.parse(localStorage.getItem(HS_KEY)||'[]'); historyList.innerHTML=''; if(!arr.length) { historyList.innerHTML='<div class="item">No history</div>'; return; } arr.forEach(it=>{ const div=document.createElement('div'); div.className='item'; const meta=document.createElement('div'); meta.className='meta'; meta.textContent=it.title || it.url; const open=document.createElement('button'); open.textContent='Open'; open.onclick=()=>{ linkInput.value=it.url; titleInput.value=it.title||''; loadAndPlay(it.url); }; div.appendChild(meta); div.appendChild(open); historyList.appendChild(div); }); }
function saveResume(){ if(!currentUrl) return; localStorage.setItem('resume_'+btoa(currentUrl), JSON.stringify({time:player.currentTime, last:Date.now(), title:currentTitle})); }
function restoreResume(){ const raw = localStorage.getItem('resume_'+btoa(currentUrl)); if(!raw) return; try{ const s=JSON.parse(raw); if(s && s.time && confirm(`Resume from ${fmt(s.time)}?`)) player.currentTime = s.time; }catch(e){} }

/************ Sub Upload ************/
addSubBtn.addEventListener('click', ()=> subFile.click());
subFile.addEventListener('change', (e)=>{ const f=e.target.files[0]; if(!f) return; if(subtitleTrackEl) subtitleTrackEl.remove(); const tr=document.createElement('track'); tr.kind='subtitles'; tr.label=f.name; tr.src=URL.createObjectURL(f); tr.default=true; player.appendChild(tr); subtitleTrackEl=tr; alert('Subtitle added'); });

/************ Helpers ************/
function deriveTitleFromUrl(url){ try{ const p=new URL(url).pathname; return decodeURIComponent(p.split('/').pop()||url); }catch(e){return url;} }

/************ Init ************/
(async function(){ renderHistory(); renderDownloads(); })();

/* expose for debugging */
window.SB = { loadAndPlay, renderDownloads, renderHistory, generateBookmarklet };
