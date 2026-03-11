/* === Icons === */
const ICON_FOLDER = `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 6a2 2 0 0 1 2-2h3.172a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 10.828 6H16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" fill="#f59e0b"/></svg>`;
const ICON_FILE   = `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4a2 2 0 0 1 2-2h5.172a2 2 0 0 1 1.414.586l2.828 2.828A2 2 0 0 1 16 6.828V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" fill="#dbeafe" stroke="#93c5fd" stroke-width="1" stroke-linejoin="round"/></svg>`;
const ICON_RENAME = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
const ICON_DELETE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
const ICON_DOWNLOAD = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const ICON_SEARCH = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

const app = document.getElementById("app");
let currentPath = "/";
let currentSearchQuery = "";
let searchTimeout = null;
let selectedPaths = new Set();

function joinPath(base, name) {
  return (base === "/" ? "/" : base + "/") + name;
}

function breadcrumb(path) {
  const parts = path.split("/").filter(Boolean);
  let html = `<nav><div class="breadcrumbs"><a href="#" onclick="navigate('/');return false">root</a>`;
  let built = "";
  for (const p of parts) {
    built += "/" + p;
    html += `<span class="sep">/</span><a href="#" onclick="navigate('${built}');return false">${p}</a>`;
  }
  html += `</div>`;
  html += `<div class="search-container">`;
  html += `<span class="search-icon">${ICON_SEARCH}</span>`;
  html += `<input type="text" class="search-input" placeholder="Search..." `;
  html += `oninput="handleSearchInput(event)" value="${currentSearchQuery}">`;
  if (currentSearchQuery) {
    html += `<span class="search-clear" onclick="clearSearch()">×</span>`;
  }
  html += `</div>`;
  html += `<div class="nav-actions">`;
  html += `<button class="btn btn-secondary" onclick="downloadZip('${path}')">Download zip</button>`;
  html += `<button class="btn btn-secondary" onclick="document.getElementById('folderInput').click()">Upload Folder</button>`;
  html += `<button class="btn" onclick="document.getElementById('fileInput').click()">Upload Files</button>`;
  html += `</div></nav>`;
  return html;
}

async function navigate(path) {
  currentPath = path;
  selectedPaths.clear();
  app.innerHTML = `<div class="loading"><span class="spinner"></span></div>`;
  const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
  if (!res.ok) return (app.innerHTML = `<div class="empty">Error loading files</div>`);
  const files = await res.json();
  let html = breadcrumb(path);

  html += `<div class="content-actions"><button class="btn btn-secondary btn-sm" onclick="createFolder()">+ New Folder</button></div>`;

  if (!files.length) {
    app.innerHTML = html + `<div class="empty"><div class="empty-icon">📂</div>This folder is empty</div>`;
    return;
  }
  html += "<ul>";
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const escapedPath = (f.is_dir ? joinPath(path, f.name) : joinPath(path, f.name)).replace(/'/g, "\\'");
    if (f.is_dir) {
      const next = joinPath(path, f.name);
      html += `<li style="--i:${i}" data-path="${next}">`;
      html += `<input type="checkbox" class="select-cb" onchange="toggleSelect('${escapedPath}', this.checked)">`;
      html += `<span class="icon">${ICON_FOLDER}</span><a href="#" onclick="navigate('${next}');return false">${f.name}</a>`;
      html += `<span class="action-btn" onclick="renameItem('${next}', '${f.name}', event)" title="Rename">${ICON_RENAME}</span>`;
      html += `<span class="action-btn delete" onclick="deleteItem('${next}', '${f.name}', true, event)" title="Delete">${ICON_DELETE}</span>`;
      html += `<span class="spacer"></span><span class="download-btn" onclick="downloadZip('${next}')" title="Download as zip">${ICON_DOWNLOAD}</span></li>`;
    } else {
      const filePath = joinPath(path, f.name);
      html += `<li class="file" style="--i:${i}" data-path="${filePath}">`;
      html += `<input type="checkbox" class="select-cb" onchange="toggleSelect('${escapedPath}', this.checked)">`;
      html += `<span class="icon">${ICON_FILE}</span><a href="#" onclick="viewFile('${filePath}');return false">${f.name}</a>`;
      html += `<span class="action-btn" onclick="renameItem('${filePath}', '${f.name}', event)" title="Rename">${ICON_RENAME}</span>`;
      html += `<span class="action-btn delete" onclick="deleteItem('${filePath}', '${f.name}', false, event)" title="Delete">${ICON_DELETE}</span>`;
      html += `<span class="spacer"></span></li>`;
    }
  }
  app.innerHTML = html + "</ul>";
}

function viewFile(path) {
  window.open(`/api/download?path=${encodeURIComponent(path)}`, '_blank');
}

function uploadOneFile(file, path, relativePath = null) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) updateProgress(Math.round((e.loaded / e.total) * 95));
    };
    xhr.upload.onload = () => updateProgressLabel("Processing...");
    xhr.onload = () => { updateProgress(100); resolve(xhr.status >= 200 && xhr.status < 300); };
    xhr.onerror = () => resolve(false);

    let url = `/api/upload?path=${encodeURIComponent(path)}`;
    if (relativePath) {
      url += `&relative_path=${encodeURIComponent(relativePath)}`;
    }

    xhr.open("POST", url);
    xhr.send(formData);
  });
}

function showProgress(label) {
  const nav = app.querySelector("nav");
  if (!nav) return;
  const existing = app.querySelector(".upload-progress");
  if (existing) existing.remove();
  nav.insertAdjacentHTML("afterend",
    `<div class="upload-progress"><div class="upload-progress-label">${label}</div>` +
    `<div class="upload-progress-track"><div class="upload-progress-bar"></div></div></div>`);
}

function updateProgress(pct) {
  const bar = app.querySelector(".upload-progress-bar");
  if (bar) bar.style.width = pct + "%";
}

function updateProgressLabel(text) {
  const label = app.querySelector(".upload-progress-label");
  if (label) label.textContent = text;
}

function hideProgress() {
  const el = app.querySelector(".upload-progress");
  if (el) el.remove();
}

async function uploadFiles(filesWithPaths) {
  const failed = [];
  const total = filesWithPaths.length;
  for (let i = 0; i < total; i++) {
    const { file, relativePath } = filesWithPaths[i];
    const displayName = relativePath || file.name;

    const label = total > 1
      ? `Uploading ${i + 1}/${total}: ${displayName}`
      : `Uploading ${displayName}`;

    showProgress(label);
    updateProgress(0);

    const ok = await uploadOneFile(file, currentPath, relativePath);
    if (!ok) failed.push(displayName);
  }
  hideProgress();
  if (failed.length) {
    alert(`Failed to upload: ${failed.join(", ")}`);
  }
  navigate(currentPath);
}

async function uploadFile() {
  const input = document.getElementById("fileInput");
  const files = Array.from(input.files);
  if (!files.length) return;

  const filesWithPaths = files.map((file) => ({
    file: file,
    relativePath: null,
  }));

  await uploadFiles(filesWithPaths);
  input.value = "";
}

async function uploadFolder() {
  const input = document.getElementById("folderInput");
  const files = Array.from(input.files);
  if (!files.length) return;

  const filesWithPaths = files.map((file) => ({
    file: file,
    relativePath: file.webkitRelativePath,
  }));

  await uploadFiles(filesWithPaths);
  input.value = "";
}

function downloadZip(path) {
  window.open(`/api/download-zip?path=${encodeURIComponent(path)}`, '_blank');
}

async function createFolder() {
  const folderName = prompt("Enter folder name:");
  if (!folderName) return;
  const res = await fetch(`/api/create-folder?path=${encodeURIComponent(currentPath)}&name=${encodeURIComponent(folderName)}`, {
    method: "POST",
  });
  if (res.ok) {
    navigate(currentPath);
  } else {
    const error = await res.json();
    alert(error.detail || "Failed to create folder");
  }
}

async function renameItem(itemPath, oldName, event) {
  event.stopPropagation();
  const newName = prompt("Rename to:", oldName);
  if (!newName || newName === oldName) return;
  const res = await fetch(`/api/rename?path=${encodeURIComponent(itemPath)}&new_name=${encodeURIComponent(newName)}`, {
    method: "POST",
  });
  if (res.ok) {
    navigate(currentPath);
  } else {
    const error = await res.json();
    alert(error.detail || "Failed to rename");
  }
}

async function deleteItem(itemPath, name, isDir, event) {
  event.stopPropagation();
  const message = isDir
    ? `Delete folder '${name}' and all its contents? This cannot be undone.`
    : `Delete '${name}'? This cannot be undone.`;
  const ok = confirm(message);
  if (!ok) return;
  const res = await fetch(`/api/delete?path=${encodeURIComponent(itemPath)}`, {
    method: "POST",
  });
  if (res.ok) {
    navigate(currentPath);
  } else {
    const error = await res.json();
    alert(error.detail || "Failed to delete");
  }
}

// === UI Sound Effects ===
let uiAudioCtx = null;
let lastHoverSoundTime = 0;

function getUIAudioCtx() {
  if (!uiAudioCtx) {
    uiAudioCtx = new (window.AudioContext || window["webkitAudioContext"])();
  }
  return uiAudioCtx;
}

function playHoverSound() {
  const now = Date.now();
  if (now - lastHoverSoundTime < 80) return; // debounce rapid movements
  lastHoverSoundTime = now;

  const ctx = getUIAudioCtx();
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1100, ctx.currentTime);
  env.gain.setValueAtTime(0, ctx.currentTime);
  env.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.005);
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  osc.connect(env);
  env.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.06);
}

function playClickSound() {
  const ctx = getUIAudioCtx();
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.08);
  env.gain.setValueAtTime(0, ctx.currentTime);
  env.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.005);
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  osc.connect(env);
  env.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.12);
}

const UI_INTERACTIVE = 'button, a, input[type="checkbox"], .action-btn, .download-btn, .search-clear';

document.addEventListener("mouseover", (e) => {
  if (e.target.closest(UI_INTERACTIVE)) playHoverSound();
});

document.addEventListener("mousedown", (e) => {
  if (e.target.closest(UI_INTERACTIVE)) playClickSound();
});

// === Elevator Music ===
let elevatorCtx = null;
let elevatorGain = null;
let elevatorLoopTimer = null;

// Aerith's Theme — FF7 (durations in seconds)
const ELEVATOR_MELODY = [
  [220.00, 0.5], // A3
  [293.66, 0.5], // D4
  [329.63, 0.5], // E4
  [369.99, 0.8], // F#4
  [392.00, 0.2], // G4
  [369.99, 0.5], // F#4
  [329.63, 0.5], // E4
  [293.66, 1.4], // D4  (slightly longer tail before loop)
];

function playElevatorNote(freq, start, dur) {
  const osc = elevatorCtx.createOscillator();
  const env = elevatorCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, start);
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(0.2, start + 0.05);
  env.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(env);
  env.connect(elevatorGain);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function scheduleElevatorLoop() {
  if (!elevatorCtx) return;
  let t = elevatorCtx.currentTime + 0.05;
  let totalDur = 0;
  for (const [freq, dur] of ELEVATOR_MELODY) {
    playElevatorNote(freq, t, dur);
    t += dur;
    totalDur += dur;
  }
  elevatorLoopTimer = setTimeout(scheduleElevatorLoop, (totalDur - 0.2) * 1000);
}

function startElevatorMusic() {
  if (elevatorCtx) return;
  elevatorCtx = new (window.AudioContext || window["webkitAudioContext"])();
  elevatorGain = elevatorCtx.createGain();
  elevatorGain.gain.setValueAtTime(0.6, elevatorCtx.currentTime);
  elevatorGain.connect(elevatorCtx.destination);
  scheduleElevatorLoop();
}

function stopElevatorMusic() {
  if (!elevatorCtx) return;
  clearTimeout(elevatorLoopTimer);
  elevatorLoopTimer = null;
  elevatorGain.gain.linearRampToValueAtTime(0, elevatorCtx.currentTime + 0.4);
  const ctx = elevatorCtx;
  elevatorCtx = null;
  elevatorGain = null;
  setTimeout(() => ctx.close(), 500);
}

function toggleSelect(path, checked) {
  if (checked) {
    selectedPaths.add(path);
  } else {
    selectedPaths.delete(path);
  }
  updateSelectionUI();
}

function updateSelectionUI() {
  const ul = app.querySelector("ul");
  if (ul) {
    ul.classList.toggle("has-selection", selectedPaths.size > 0);
  }

  // Update selected class on list items
  app.querySelectorAll("li[data-path]").forEach((li) => {
    const isSelected = selectedPaths.has(li.dataset.path);
    li.classList.toggle("selected", isSelected);
  });

  // Show/hide selection bar
  const existing = app.querySelector(".selection-bar");
  if (selectedPaths.size === 0) {
    if (existing) existing.remove();
    stopElevatorMusic();
    return;
  }

  const count = selectedPaths.size;
  const barHTML =
    `<div class="selection-bar">` +
    `<span>${count} item${count > 1 ? "s" : ""} selected</span>` +
    `<span class="selection-bar-actions">` +
    `<button class="btn btn-sm btn-secondary" onclick="clearSelection()">Cancel</button>` +
    `<button class="btn btn-sm btn-secondary" onclick="downloadSelected()">Download zip</button>` +
    `<button class="btn btn-sm btn-danger" onclick="deleteSelected()">Delete</button>` +
    `</span></div>`;

  if (existing) {
    existing.outerHTML = barHTML;
  } else {
    const contentActions = app.querySelector(".content-actions");
    if (contentActions) {
      contentActions.insertAdjacentHTML("afterend", barHTML);
    }
    startElevatorMusic();
  }
}

function clearSelection() {
  selectedPaths.clear();
  app.querySelectorAll(".select-cb").forEach((cb) => (cb.checked = false));
  app.querySelectorAll("li.selected").forEach((li) => li.classList.remove("selected"));
  stopElevatorMusic();
  updateSelectionUI();
}

async function deleteSelected() {
  const count = selectedPaths.size;
  if (!count) return;

  const ok = confirm(`Delete ${count} item${count > 1 ? "s" : ""}? This cannot be undone.`);
  if (!ok) return;

  const paths = Array.from(selectedPaths);
  const res = await fetch("/api/batch-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths }),
  });

  if (res.ok) {
    const data = await res.json();
    const failures = data.results.filter((r) => r.status === "error");
    if (failures.length > 0) {
      alert(
        `Failed to delete ${failures.length} item(s):\n` +
          failures.map((f) => `${f.path}: ${f.detail}`).join("\n")
      );
    }
  } else {
    alert("Failed to delete items");
  }

  selectedPaths.clear();
  navigate(currentPath);
}

async function downloadSelected() {
  const count = selectedPaths.size;
  if (!count) return;

  const paths = Array.from(selectedPaths);
  const res = await fetch("/api/batch-download-zip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths }),
  });

  if (res.ok) {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "selected.zip";
    a.click();
    URL.revokeObjectURL(url);
  } else {
    alert("Failed to download items");
  }
}

function handleSearchInput(event) {
  const query = event.target.value;
  currentSearchQuery = query;

  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  searchTimeout = setTimeout(() => {
    searchFiles(query);
  }, 300);
}

function clearSearch() {
  currentSearchQuery = "";
  navigate(currentPath);
}

async function searchFiles(query) {
  if (!query.trim()) {
    navigate(currentPath);
    return;
  }

  app.innerHTML = `<div class="loading"><span class="spinner"></span></div>`;
  const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
  if (!res.ok) {
    app.innerHTML = `<div class="empty">Error searching files</div>`;
    return;
  }
  const results = await res.json();
  displaySearchResults(results, query);
}

function displaySearchResults(results, query) {
  let html = breadcrumb(currentPath);
  html += `<div class="content-actions"><button class="btn btn-secondary btn-sm" onclick="createFolder()">+ New Folder</button></div>`;
  html += `<div class="search-results-header">Results for: <strong>${query}</strong></div>`;

  if (!results.length) {
    app.innerHTML = html + `<div class="empty"><div class="empty-icon">🔍</div>No files found for: ${query}</div>`;
    return;
  }

  html += "<ul>";
  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    const icon = item.is_dir ? ICON_FOLDER : ICON_FILE;
    const pathDisplay = item.parent_path === "/" ? "/" : item.parent_path;
    html += `<li style="--i:${i}">`;
    html += `<span class="icon">${icon}</span>`;
    html += `<a href="#" onclick="navigateToParent('${item.parent_path}');return false">${item.name}</a>`;
    html += `<span style="margin-left: 8px; font-size: 12px; color: #9ca3af;">${pathDisplay}</span>`;
    html += `<span class="spacer"></span>`;
    html += `</li>`;
  }
  app.innerHTML = html + "</ul>";
}

function navigateToParent(parentPath) {
  currentSearchQuery = "";
  navigate(parentPath);
}

navigate("/");

// Drag and drop support
let dragDepth = 0;
const dragOverlay = document.getElementById("dragOverlay");

document.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragDepth++;
  if (dragDepth === 1) {
    dragOverlay.classList.add("active");
  }
});

document.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragDepth--;
  if (dragDepth === 0) {
    dragOverlay.classList.remove("active");
  }
});

document.addEventListener("dragover", (e) => {
  e.preventDefault();
});

document.addEventListener("drop", async (e) => {
  e.preventDefault();
  dragDepth = 0;
  dragOverlay.classList.remove("active");

  const items = Array.from(e.dataTransfer.items);
  if (!items.length) return;

  const filesWithPaths = await collectFilesFromDrop(items);

  if (!filesWithPaths.length) {
    alert("No files found to upload.");
    return;
  }

  await uploadFiles(filesWithPaths);
});

// Recursively collect files from dropped folders
async function collectFilesFromDrop(items) {
  const filesWithPaths = [];

  for (const item of items) {
    const entry = item.webkitGetAsEntry();
    if (entry) {
      await traverseEntry(entry, "", filesWithPaths);
    }
  }

  return filesWithPaths;
}

// Recursive traversal of FileSystemEntry tree
async function traverseEntry(entry, parentPath, filesWithPaths) {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((file) => {
        const relativePath = parentPath
          ? `${parentPath}/${file.name}`
          : file.name;
        filesWithPaths.push({ file, relativePath });
        resolve();
      });
    });
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader();

    // Handle readEntries() batch limit (max ~100 per call)
    const readAllEntries = async () => {
      return new Promise((resolve) => {
        const allEntries = [];
        const readBatch = () => {
          dirReader.readEntries((entries) => {
            if (entries.length === 0) {
              resolve(allEntries);
            } else {
              allEntries.push(...entries);
              readBatch();
            }
          });
        };
        readBatch();
      });
    };

    const entries = await readAllEntries();
    for (const childEntry of entries) {
      const newPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      await traverseEntry(childEntry, newPath, filesWithPaths);
    }
  }
}
