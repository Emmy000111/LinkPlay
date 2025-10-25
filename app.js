/* StreamBox+ — advanced web player
   NOTES:
   - Replace OPEN_SUBS_KEY with your OpenSubtitles API key to enable subtitle search.
   - CORS: remote video servers must allow CORS for fetching/downloading from browser.
*/

const OPEN_SUBS_KEY = ""; // <-- GET A KEY from https://www.opensubtitles.com/ or use a proxy

// DOM
const linkInput = document.getElementById('linkInput');
const loadBtn = document.getElementById('loadBtn');
const player = document.getElementById('player');
const playPause = document.getElementById('playPause');
const rew10 = document.getElementById('rew10');
const fwd10 = document.getElementById('fwd10');
const seek = document.getElementById('seek');
const curEl = document.getElementById('cur');
const durEl = document.getElementById('dur');
const speedSel = document.getElementById('speed');
const vol = document.getElementById('vol');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const pipBtn = document.getElementById('pipBtn');
const downloadNow = document.getElementById('downloadNow');
const addSubBtn = document.getElementById('addSubBtn');
const subFile = document.getElementById('subFile');
const searchSubsBtn = document.getElementById('searchSubsBtn');
const titleInput = document.getElementById('titleInput');
const subsList = document.getElementById('subsList');
const historyList = document.getElementById('historyList');
const downloadsList = document.getElementById('downloadsList');
const bookmarkBtn = document.getElementById('bookmarkBtn');
const historyBtn = document.getElementById('historyBtn');
const bigPlay = document.getElementById('bigPlay');
const loader = document.getElementById('loader');
const controlsOverlay = document.getElementById('controlsOverlay');
const downloadsPanel = document.getElementById('downloadsPanel');
const historyPanel = document.getElementById('historyPanel');

let hls = null;
let currentUrl = null;
let currentTitle = null;
let subtitleTrackEl = null;
let isPlaying = false;
let resumeKeyPrefix = 'streambox_resume_';
let bookmarksKey = 'streambox_bookmarks';
let historyKey = 'streambox_history';

// Utilities
const $ = (id) => document.getElementById(id);
function showLoader(show){ loader.classList.toggle('hidden', !show); }
function formatTime(s){ if (!s || isNaN(s)) return '0:00'; const m = Math.floor(s/60); const sec = String(Math.floor(s%60)).padStart(2,'0'); return `${m}:${sec}`; }

// Initialize UI state
(function init(){
  // event bindings
  loadBtn.addEventListener('click', () => loadAndPlay(linkInput.value.trim()));
  playPause.addEventListener('click', togglePlay);
  bigPlay.addEventListener('click', togglePlay);
  rew10.addEventListener('click', ()=> seekBy(-10));
  fwd10.addEventListener('click', ()=> seekBy(10));
  frameBack.addEventListener('click', ()=> stepFrame(-1));
  frameFwd.addEventListener('click', ()=> stepFrame(1));
  speedSel.addEventListener('change', ()=> player.playbackRate = parseFloat(speedSel.value));
  vol.addEventListener('input', ()=> player.volume = parseFloat(vol.value));
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  pipBtn.addEventListener('click', togglePip);
  downloadNow.addEventListener('click', downloadCurrentVideo);
  addSubBtn.addEventListener('click', ()=> subFile.click());
  subFile.addEventListener('change', handleSubtitleUpload);
  searchSubsBtn.addEventListener('click', searchSubtitles);
  bookmarkBtn.addEventListener('click', toggleBookmark);
  historyBtn.addEventListener('click', showHistoryPanel);

  player.addEventListener('timeupdate', onTimeUpdate);
  player.addEventListener('loadedmetadata', onLoadedMeta);
  player.addEventListener('play', ()=> isPlaying=true);
  player.addEventListener('pause', ()=> isPlaying=false);
  seek.addEventListener('input', onSeekInput);
  document.addEventListener('keydown', onKeyDown);

  // mobile gestures: tap to pause/play, horizontal swipe to seek
  let touchStartX=null;
  player.addEventListener('touchstart', e => { if(e.touches && e.touches[0]) touchStartX = e.touches[0].clientX; });
  player.addEventListener('touchend', e => {
    if(touchStartX==null) return;
    const dx = (e.changedTouches[0].clientX - touchStartX);
    if(Math.abs(dx) < 10){ togglePlay(); } else {
      seekBy(dx > 0 ? 10 : -10);
    }
    touchStartX = null;
  });

  // restore lists
  renderHistory();
  renderDownloadsList();
})();

// Load + play a link (MP4 or HLS)
async function loadAndPlay(url){
  if(!url) { alert('Paste a link first'); return; }
  currentUrl = url;
  currentTitle = titleInput.value.trim() || deriveTitleFromUrl(url);
  showLoader(true);

  // cleanup old hls
  if(hls){ try{ hls.destroy(); }catch(e){} hls = null; }

  try{
    if(url.endsWith('.m3u8')){
      if(Hls.isSupported()){
        hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(player);
        hls.on(Hls.Events.MANIFEST_PARSED, ()=> { player.play().catch(()=>{}); showLoader(false); });
      } else {
        player.src = url;
        await player.play().catch(()=>{});
        showLoader(false);
      }
    } else {
      player.src = url;
      await player.play().catch(()=>{});
      showLoader(false);
    }
    saveHistory({title:currentTitle,url:currentUrl,time:Date.now()});
    restoreResume();
    updatePoster(false);
  } catch(err){
    console.error(err);
    showLoader(false);
    alert('Failed to load the video. Check the link or CORS policy.');
  }
}

// derive title
function deriveTitleFromUrl(url){
  try {
    const p = new URL(url).pathname;
    const n = p.split('/').pop();
    return decodeURIComponent(n || 'Unknown');
  } catch { return url; }
}

// playback helpers
function togglePlay(){ if(player.paused) player.play(); else player.pause(); }
function seekBy(sec){ player.currentTime = Math.max(0, Math.min((player.duration||0), player.currentTime + sec)); }
function onLoadedMeta(){ durEl.textContent = formatTime(player.duration || 0); }
function onTimeUpdate(){
  if(!isNaN(player.duration) && player.duration>0){
    const pct = (player.currentTime / player.duration) * 100;
    seek.value = pct;
    curEl.textContent = formatTime(player.currentTime);
    durEl.textContent = formatTime(player.duration);
    saveResume();
  }
}
function onSeekInput(){ if(!isNaN(player.duration)) player.currentTime = (seek.value/100) * player.duration; }

// frame-by-frame (approx, uses small increment)
function stepFrame(frames){
  const fps = 25; // approximate
  const step = frames * (1/fps);
  player.currentTime = Math.max(0, Math.min((player.duration||0), player.currentTime + step));
}

// fullscreen
async function toggleFullscreen(){
  if(document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
}

// Picture-in-Picture
async function togglePip(){
  try{
    if(document.pictureInPictureElement) await document.exitPictureInPicture();
    else await player.requestPictureInPicture();
  }catch(e){ console.warn('PiP error',e); alert('Picture-in-Picture not supported'); }
}

// download current video (fetch -> IndexedDB)
async function downloadCurrentVideo(){
  if(!currentUrl){ alert('Load a video first'); return; }
  try{
    showLoader(true);
    const resp = await fetch(currentUrl);
    if(!resp.ok) throw new Error('Network error '+resp.status);
    const blob = await resp.blob();
    const name = (currentTitle || deriveTitleFromUrl(currentUrl)).replace(/\s+/g,'_');
    await saveBlobToIndexedDB(name, blob);
    showLoader(false);
    renderDownloadsList();
    alert('Saved to Downloads');
  }catch(err){
    showLoader(false);
    console.error(err);
    alert('Download failed (CORS or large file). Use server proxy for robust downloading.');
  }
}

/* ---------- IndexedDB helper for downloads ---------- */
const DB_NAME = 'streambox_db_v1', STORE = 'videos';
function openDB(){
  return new Promise((resolve,reject)=>{
    const rq = indexedDB.open(DB_NAME,1);
    rq.onupgradeneeded = (e) => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'id'});
    };
    rq.onsuccess = (e) => resolve(e.target.result);
    rq.onerror = (e) => reject(e.target.error);
  });
}
async function saveBlobToIndexedDB(name, blob){
  const db = await openDB();
  const tx = db.transaction(STORE,'readwrite');
  const store = tx.objectStore(STORE);
  const id = 'v_' + Date.now();
  store.put({id,name,blob,created:Date.now()});
  return new Promise((res,rej)=>{
    tx.oncomplete = ()=> res();
    tx.onerror = (e)=> rej(e);
  });
}
async function getAllDownloads(){
  const db = await openDB();
  const tx = db.transaction(STORE,'readonly');
  const store = tx.objectStore(STORE);
  return new Promise((res,rej)=>{
    const rq = store.getAll();
    rq.onsuccess = ()=> res(rq.result);
    rq.onerror = ()=> rej(rq.error);
  });
}
async function deleteDownload(id){
  const db = await openDB();
  const tx = db.transaction(STORE,'readwrite');
  tx.objectStore(STORE).delete(id);
  return new Promise((res)=> tx.oncomplete = ()=> res());
}

async function renderDownloadsList(){
  const items = await getAllDownloads();
  downloadsList.innerHTML = '';
  if(items.length === 0){ downloadsList.innerHTML = '<div class="item">No downloads</div>'; return; }
  items.sort((a,b)=>b.created-a.created).forEach(it => {
    const div = document.createElement('div'); div.className='item';
    const meta = document.createElement('div'); meta.className='meta'; meta.textContent = it.name;
    const playBtn = document.createElement('button'); playBtn.textContent='Play'; playBtn.onclick = ()=> {
      const url = URL.createObjectURL(it.blob);
      loadLocalBlob(url);
    };
    const saveBtn = document.createElement('button'); saveBtn.textContent='Save'; saveBtn.onclick = ()=> {
      const a = document.createElement('a'); a.href = URL.createObjectURL(it.blob); a.download = it.name; document.body.appendChild(a); a.click(); a.remove();
    };
    const delBtn = document.createElement('button'); delBtn.textContent='Delete'; delBtn.onclick = async ()=>{ await deleteDownload(it.id); renderDownloadsList(); };
    div.appendChild(meta); div.appendChild(playBtn); div.appendChild(saveBtn); div.appendChild(delBtn);
    downloadsList.appendChild(div);
  });
}
function loadLocalBlob(url){
  // stops hls if any
  if(hls){ try{ hls.destroy(); }catch(e){} hls=null; }
  player.src = url; player.play().catch(()=>{});
}

/* ---------- History & Bookmarks ---------- */
function saveHistory(entry){
  try{
    const arr = JSON.parse(localStorage.getItem(historyKey) || '[]');
    arr.unshift(entry);
    const trimmed = arr.slice(0,50);
    localStorage.setItem(historyKey, JSON.stringify(trimmed));
    renderHistory();
  }catch(e){}
}
function renderHistory(){
  const arr = JSON.parse(localStorage.getItem(historyKey) || '[]');
  historyList.innerHTML = '';
  if(arr.length===0){ historyList.innerHTML = '<div class="item">No history</div>'; return; }
  arr.forEach(it=>{
    const div = document.createElement('div'); div.className='item';
    const meta = document.createElement('div'); meta.className='meta'; meta.textContent = it.title;
    const openBtn = document.createElement('button'); openBtn.textContent='Open'; openBtn.onclick = ()=> { linkInput.value = it.url; titleInput.value = it.title; loadAndPlay(it.url); };
    historyList.appendChild(div); div.appendChild(meta); div.appendChild(openBtn);
  });
}
function showHistoryPanel(){ historyPanel.scrollIntoView({behavior:'smooth'}); }

/* bookmarks */
function toggleBookmark(){
  const bookmarks = JSON.parse(localStorage.getItem(bookmarksKey) || '[]');
  const exists = bookmarks.find(b=>b.url===currentUrl);
  if(exists){
    const filtered = bookmarks.filter(b=>b.url!==currentUrl);
    localStorage.setItem(bookmarksKey, JSON.stringify(filtered));
    alert('Removed bookmark');
  } else {
    bookmarks.push({url:currentUrl,title:currentTitle||deriveTitleFromUrl(currentUrl),created:Date.now()});
    localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
    alert('Bookmarked');
  }
}

/* ---------- Subtitles: upload and search ---------- */
function handleSubtitleUpload(ev){
  const file = ev.target.files[0];
  if(!file) return;
  addSubtitleFromFile(file);
}
function addSubtitleFromFile(file){
  const track = document.createElement('track');
  track.kind='subtitles'; track.label = file.name; track.srclang='en'; track.default = true;
  track.src = URL.createObjectURL(file);
  // remove old track
  if(subtitleTrackEl) subtitleTrackEl.remove();
  player.appendChild(track);
  subtitleTrackEl = track;
  alert('Subtitle added');
}

// Auto-search using OpenSubtitles
async function searchSubtitles(){
  const title = titleInput.value.trim();
  if(!title){ alert('Enter a title for subtitle search'); return; }
  if(!OPEN_SUBS_KEY){ alert('Subtitle search requires OpenSubtitles API key. Set OPEN_SUBS_KEY in app.js'); return; }
  subsList.innerHTML = '<div class="item">Searching…</div>';
  try{
    // simple search endpoint
    const q = encodeURIComponent(title);
    const url = `https://api.opensubtitles.com/api/v1/subtitles?query=${q}&languages=en`;
    const res = await fetch(url, { headers: { 'Api-Key': OPEN_SUBS_KEY, 'Content-Type': 'application/json' }});
    if(!res.ok) throw new Error('Search error '+res.status);
    const data = await res.json();
    const list = data.data || [];
    renderSubs(list);
  }catch(err){
    console.error(err);
    subsList.innerHTML = '<div class="item">Subtitle search failed (CORS or key issue)</div>';
  }
}

function renderSubs(list){
  subsList.innerHTML = '';
  if(!list.length){ subsList.innerHTML = '<div class="item">No subtitles found</div>'; return; }
  list.slice(0,10).forEach(s=>{
    const div = document.createElement('div'); div.className='item';
    const meta = document.createElement('div'); meta.className='meta'; meta.innerHTML = `<strong>${s.attributes.release || s.attributes.filename}</strong><div style="font-size:12px;color:#bbb">${s.attributes.language} • ${s.attributes.download_count || 0} downloads</div>`;
    const getBtn = document.createElement('button'); getBtn.textContent='Load'; getBtn.onclick = ()=> fetchAndAttachSubtitle(s);
    div.appendChild(meta); div.appendChild(getBtn);
    subsList.appendChild(div);
  });
}

async function fetchAndAttachSubtitle(subItem){
  // subItem.attributes.files may contain file URL or file_id to fetch
  try{
    showLoader(true);
    // try to get file download link (OpenSubtitles provides file_id downloadable via other endpoint)
    const fileId = subItem.attributes.files && subItem.attributes.files[0] && subItem.attributes.files[0].file_id;
    if(!fileId){ alert('No direct file available'); showLoader(false); return; }
    const url = `https://api.opensubtitles.com/api/v1/download`;
    const body = JSON.stringify({file_id: fileId});
    const res = await fetch(url, { method:'POST', headers: {'Api-Key': OPEN_SUBS_KEY, 'Content-Type':'application/json'}, body});
    const j = await res.json();
    if(!j || !j.link) { alert('Failed to get subtitle link'); showLoader(false); return;}
    const subResp = await fetch(j.link);
    const subText = await subResp.text();
    const blob = new Blob([subText], {type:'text/vtt'});
    addSubtitleFromBlob(blob, subItem.attributes.filename || 'subtitle.vtt');
    showLoader(false);
  }catch(err){
    showLoader(false);
    console.error(err);
    alert('Failed to fetch subtitle (CORS / key / rate limit). You may need a proxy.');
  }
}

function addSubtitleFromBlob(blob, name){
  const track = document.createElement('track');
  track.kind='subtitles'; track.label = name; track.srclang='en'; track.default = true;
  track.src = URL.createObjectURL(blob);
  if(subtitleTrackEl) subtitleTrackEl.remove();
  player.appendChild(track); subtitleTrackEl = track;
  alert('Subtitle attached');
}

/* save subtitle (download)
   Note: saves currently attached subtitle track text to disk
*/
document.getElementById('saveSub').addEventListener('click', async ()=>{
  if(!subtitleTrackEl){ alert('No subtitle attached'); return; }
  try{
    const resp = await fetch(subtitleTrackEl.src);
    const txt = await resp.blob();
    const a = document.createElement('a'); a.href = URL.createObjectURL(txt); a.download = subtitleTrackEl.label || 'subtitle.vtt'; document.body.appendChild(a); a.click(); a.remove();
  }catch(e){ alert('Save failed'); }
});

/* ---------- Resume watching ---------- */
function saveResume(){
  if(!currentUrl) return;
  const key = resumeKeyPrefix + btoa(currentUrl);
  const state = {time: player.currentTime, last: Date.now(), title: currentTitle};
  localStorage.setItem(key, JSON.stringify(state));
}
function restoreResume(){
  if(!currentUrl) return;
  const key = resumeKeyPrefix + btoa(currentUrl);
  const raw = localStorage.getItem(key);
  if(!raw) return;
  try{
    const s = JSON.parse(raw);
    if(s && s.time && confirm(`Resume from ${formatTime(s.time)}?`)) player.currentTime = s.time;
  }catch(e){}
}

/* ---------- Keyboard shortcuts ---------- */
function onKeyDown(e){
  if(e.code === 'Space'){ e.preventDefault(); togglePlay(); }
  if(e.key === 'ArrowRight') seekBy(5);
  if(e.key === 'ArrowLeft') seekBy(-5);
  if(e.key === 'f') toggleFullscreen();
  if(e.key === 'm') player.muted = !player.muted;
  if(e.key === ',') stepFrame(-1);
  if(e.key === '.') stepFrame(1);
  if(e.key === '>') player.playbackRate = Math.min(2, player.playbackRate + 0.25);
  if(e.key === '<') player.playbackRate = Math.max(0.5, player.playbackRate - 0.25);
}

/* ---------- small helpers ---------- */
function updatePoster(visible=true){
  document.getElementById('poster').style.display = visible ? 'block' : 'none';
}

/* ---------- initial render ---------- */
renderHistory();
renderDownloadsList();

/* ---------- expose some funcs for debugging ---------- */
window._sb = { loadAndPlay, renderDownloadsList, renderHistory, downloadCurrentVideo };
