document.addEventListener("DOMContentLoaded", () => {
  const video = document.getElementById("videoPlayer");
  const linkInput = document.getElementById("streamLink");
  const playBtn = document.getElementById("playBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const clearBtn = document.getElementById("clearBtn");
  const subBtn = document.getElementById("subBtn");
  const subtitleInput = document.getElementById("subtitleInput");
  const speedBtn = document.getElementById("speedBtn");

  playBtn.addEventListener("click", () => {
    const link = linkInput.value.trim();
    if (!link) {
      alert("Please paste a valid video link.");
      return;
    }
    video.src = link;
    video.style.display = "block";
    video.play().catch(err => console.error("Play error:", err));
  });

  downloadBtn.addEventListener("click", () => {
    const link = linkInput.value.trim();
    if (!link) {
      alert("Paste a valid link first!");
      return;
    }
    const a = document.createElement("a");
    a.href = link;
    a.download = "video.mp4";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  clearBtn.addEventListener("click", () => {
    video.src = "";
    linkInput.value = "";
  });

  subBtn.addEventListener("click", () => {
    subtitleInput.click();
  });

  subtitleInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const track = document.createElement("track");
    track.kind = "subtitles";
    track.label = "Custom Subtitles";
    track.srclang = "en";
    track.default = true;
    track.src = URL.createObjectURL(file);
    video.appendChild(track);
    alert("Subtitles added!");
  });

  let playbackRate = 1;
  speedBtn.addEventListener("click", () => {
    playbackRate = playbackRate === 2 ? 0.5 : playbackRate + 0.5;
    if (playbackRate > 2) playbackRate = 0.5;
    video.playbackRate = playbackRate;
    speedBtn.textContent = `${playbackRate}x Speed`;
  });
});
