/* StreamPlayer web - basic offline download using IndexedDB */
const urlInput = document.getElementById('urlInput');
const playBtn = document.getElementById('playBtn');
const videoEl = document.getElementById('video');
const playPauseBtn = document.getElementById('playPause');
const back10 = document.getElementById('back10');
const forward10 = document.getElementById('forward10');
const speedSel = document.getElementById('speed');
const fullscreenBtn = document.getElementById('fullscreen');
const downloadBtn = document.getElementById('downloadBtn');
const seek = document.getElementById('seek');
const curTime = document.getElementById('curTime');
const durTime = document.getElementById('durTime');
const downloadsList = document.getElementById('downloadsList');
const toast = document.getElementById('toast');

let hls = null;

/* --- IndexedDB helper --- */
const DB_NAME = 'streamplayer-db';
const STORE = 'videos';
let dbPromise;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function putVideo(id, name, blob, meta = {}) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.put({ id, name, blob, meta, created: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getAllVideos() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteVideo(id) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/* --- UI helpers --- */
function showToast(msg, time = 3000) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), time);
}

/* --- Playback logic --- */
function attachVideoSource(url) {
  // clean old hls if exists
  if (hls) { hls.destroy(); hls = null; }

  videoEl.pause();
  videoEl.removeAttribute('src'); // remove previous
  videoEl.load();

  if (url.endsWith('.m3u8')) {
    // use hls.js
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoEl.play().catch(()=>{});
        updateDuration();
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = url;
      videoEl.addEventListener('loadedmetadata', () => videoEl.play().catch(()=>{}));
    } else {
      showToast('HLS not supported in this browser.');
    }
  } else {
    // normal mp4 or other direct sources
    videoEl.src = url;
    videoEl.addEventListener('loadedmetadata', updateDuration, { once: true });
    videoEl.play().catch(()=>{});
  }
}

playBtn.addEventListener('click', () => {
  const url = urlInput.value.trim();
  if (!url) return showToast('Paste a video URL first');
  attachVideoSource(url);
});

/* play/pause */
playPauseBtn.addEventListener('click', () => {
  if (videoEl.paused) {
    videoEl.play();
    playPauseBtn.textContent = 'Pause';
  } else {
    videoEl.pause();
    playPauseBtn.textContent = 'Play';
  }
});

/* 10s jump */
back10.addEventListener('click', () => {
  videoEl.currentTime = Math.max(0, videoEl.currentTime - 10);
});
forward10.addEventListener('click', () => {
  videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 10);
});

/* speed */
speedSel.addEventListener('change', () => {
  videoEl.playbackRate = parseFloat(speedSel.value);
});

/* fullscreen */
fullscreenBtn.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else videoEl.requestFullscreen?.();
});

/* seek slider binding */
videoEl.addEventListener('timeupdate', () => {
  if (!isNaN(videoEl.duration) && videoEl.duration > 0) {
    const pct = (videoEl.currentTime / videoEl.duration) * 100;
    seek.value = pct;
    curTime.textContent = formatTime(videoEl.currentTime);
  }
});

seek.addEventListener('input', () => {
  if (!isNaN(videoEl.duration)) {
    const t = (seek.value / 100) * videoEl.duration;
    videoEl.currentTime = t;
  }
});

function updateDuration() {
  if (!isNaN(videoEl.duration)) {
    durTime.textContent = formatTime(videoEl.duration);
  }
}

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  const min = Math.floor(s / 60);
  return `${min}:${sec}`;
}

/* --- Download for offline --- */
downloadBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) return showToast('Paste a URL to download');

  try {
    showToast('Starting download...');
    // fetch as blob (CORS required)
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const contentType = resp.headers.get('Content-Type') || 'video/mp4';
    const blob = await resp.blob();

    // name and id
    const name = (new URL(url)).pathname.split('/').pop() || `video_${Date.now()}`;
    const id = `vid_${Date.now()}`;

    // store in indexedDB
    await putVideo(id, name, blob, { url, contentType });
    showToast('Downloaded and saved offline');
    renderDownloads();
  } catch (err) {
    showToast('Download failed: ' + (err.message || err));
    console.error(err);
  }
});

/* --- Render downloads list --- */
async function renderDownloads() {
  downloadsList.innerHTML = '';
  const items = await getAllVideos();
  if (!items.length) {
    downloadsList.innerHTML = '<div style="color:var(--muted)">No downloaded videos</div>';
    return;
  }

  items.sort((a,b)=>b.created-a.created).forEach(item => {
    const div = document.createElement('div');
    div.className = 'download-item';

    const title = document.createElement('div');
    title.textContent = item.name;
    title.style.flex = '1';

    const playBtn = document.createElement('button');
    playBtn.textContent = 'Play';
    playBtn.onclick = () => playBlob(item);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.onclick = () => {
      // prompt download via anchor
      const url = URL.createObjectURL(item.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 2000);
    };

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.onclick = async () => {
      await deleteVideo(item.id);
      renderDownloads();
      showToast('Removed');
    };

    div.appendChild(title);
    div.appendChild(playBtn);
    div.appendChild(saveBtn);
    div.appendChild(delBtn);
    downloadsList.appendChild(div);
  });
}

function playBlob(item) {
  if (!item || !item.blob) return;
  if (hls) { hls.destroy(); hls = null; }
  const blobUrl = URL.createObjectURL(item.blob);
  videoEl.src = blobUrl;
  videoEl.play().catch(()=>{});
  // revoke later to avoid resource leaks
  setTimeout(()=>URL.revokeObjectURL(blobUrl), 1000*60);
}

/* --- init --- */
(async function init(){
  dbPromise = await openDb();
  renderDownloads();

  // small auto-fill sample (optional)
  // urlInput.value = 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4';

  videoEl.addEventListener('play', ()=> playPauseBtn.textContent = 'Pause');
  videoEl.addEventListener('pause', ()=> playPauseBtn.textContent = 'Play');
})();
