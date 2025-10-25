const playBtn = document.getElementById("playBtn");
const downloadBtn = document.getElementById("downloadBtn");
const clearBtn = document.getElementById("clearBtn");
const video = document.getElementById("videoPlayer");
const linkInput = document.getElementById("streamLink");

playBtn.addEventListener("click", () => {
  const link = linkInput.value.trim();
  if (!link) {
    alert("Please paste a valid video link.");
    return;
  }
  video.src = link;
  video.style.display = "block";
  video.play().catch((e) => console.error("Error playing video:", e));
});

downloadBtn.addEventListener("click", async () => {
  const link = linkInput.value.trim();
  if (!link) {
    alert("Paste a valid link first!");
    return;
  }
  try {
    const a = document.createElement("a");
    a.href = link;
    a.download = "video.mp4";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    alert("Download not supported for this link.");
  }
});

clearBtn.addEventListener("click", () => {
  video.src = "";
  linkInput.value = "";
});
