/* === Icons === */
const ICON_FOLDER   = `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 6a2 2 0 0 1 2-2h3.172a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 10.828 6H16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" fill="#f59e0b"/></svg>`;
const ICON_FILE     = `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4a2 2 0 0 1 2-2h5.172a2 2 0 0 1 1.414.586l2.828 2.828A2 2 0 0 1 16 6.828V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" fill="#dbeafe" stroke="#93c5fd" stroke-width="1" stroke-linejoin="round"/></svg>`;
const ICON_RENAME   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
const ICON_DELETE   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
const ICON_DOWNLOAD = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const ICON_SEARCH   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

/* === State === */
const app = document.getElementById("app");
let currentPath = "/";
let currentSearchQuery = "";
let searchTimeout = null;
let selectedPaths = new Set();

/* === Utilities === */
function joinPath(base, name) {
  return (base === "/" ? "/" : base + "/") + name;
}

function escapeAttr(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* === Rendering === */
function renderNav(path) {
  const parts = path.split("/").filter(Boolean);
  let html = `<nav><div class="breadcrumbs"><a href="#" data-action="navigate" data-path="/">root</a>`;
  let built = "";
  for (const p of parts) {
    built += "/" + p;
    html += `<span class="sep">/</span><a href="#" data-action="navigate" data-path="${escapeAttr(built)}">${p}</a>`;
  }
  html += `</div>`;
  html += `<div class="search-container">`;
  html += `<span class="search-icon">${ICON_SEARCH}</span>`;
  html += `<input type="text" class="search-input" placeholder="Search..." value="${escapeAttr(currentSearchQuery)}">`;
  if (currentSearchQuery) {
    html += `<span class="search-clear" data-action="clear-search">×</span>`;
  }
  html += `</div>`;
  html += `<div class="nav-actions">`;
  html += `<button class="btn btn-secondary" data-action="download-zip" data-path="${escapeAttr(path)}">Download zip</button>`;
  html += `<button class="btn btn-secondary" data-action="upload-folder">Upload Folder</button>`;
  html += `<button class="btn" data-action="upload-files">Upload Files</button>`;
  html += `</div></nav>`;
  return html;
}

function renderFileItem(f, path, i) {
  const itemPath = joinPath(path, f.name);
  const ePath = escapeAttr(itemPath);
  const eName = escapeAttr(f.name);
  if (f.is_dir) {
    return (
      `<li style="--i:${i}" data-path="${ePath}">` +
      `<input type="checkbox" class="select-cb">` +
      `<span class="icon">${ICON_FOLDER}</span>` +
      `<a href="#" data-action="navigate" data-path="${ePath}">${f.name}</a>` +
      `<span class="action-btn" data-action="rename" data-path="${ePath}" data-name="${eName}" title="Rename">${ICON_RENAME}</span>` +
      `<span class="action-btn delete" data-action="delete" data-path="${ePath}" data-name="${eName}" data-is-dir="true" title="Delete">${ICON_DELETE}</span>` +
      `<span class="spacer"></span>` +
      `<span class="download-btn" data-action="download-zip" data-path="${ePath}" title="Download as zip">${ICON_DOWNLOAD}</span>` +
      `</li>`
    );
  } else {
    return (
      `<li class="file" style="--i:${i}" data-path="${ePath}">` +
      `<input type="checkbox" class="select-cb">` +
      `<span class="icon">${ICON_FILE}</span>` +
      `<a href="#" data-action="view-file" data-path="${ePath}">${f.name}</a>` +
      `<span class="action-btn" data-action="rename" data-path="${ePath}" data-name="${eName}" title="Rename">${ICON_RENAME}</span>` +
      `<span class="action-btn delete" data-action="delete" data-path="${ePath}" data-name="${eName}" data-is-dir="false" title="Delete">${ICON_DELETE}</span>` +
      `<span class="spacer"></span>` +
      `</li>`
    );
  }
}

async function navigate(path) {
  currentPath = path;
  selectedPaths.clear();
  app.innerHTML = `<div class="loading"><span class="spinner"></span></div>`;
  const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
  if (!res.ok) return (app.innerHTML = `<div class="empty">Error loading files</div>`);
  const files = await res.json();
  let html = renderNav(path);
  html += `<div class="content-actions"><button class="btn btn-secondary btn-sm" data-action="create-folder">+ New Folder</button></div>`;
  if (!files.length) {
    app.innerHTML = html + `<div class="empty"><div class="empty-icon">📂</div>This folder is empty</div>`;
    return;
  }
  html += "<ul>";
  for (let i = 0; i < files.length; i++) {
    html += renderFileItem(files[i], path, i);
  }
  app.innerHTML = html + "</ul>";
}

function viewFile(path) {
  window.open(`/api/download?path=${encodeURIComponent(path)}`, "_blank");
}

function displaySearchResults(results, query) {
  let html = renderNav(currentPath);
  html += `<div class="content-actions"><button class="btn btn-secondary btn-sm" data-action="create-folder">+ New Folder</button></div>`;
  html += `<div class="search-results-header">Results for: <strong>${query}</strong></div>`;
  if (!results.length) {
    app.innerHTML = html + `<div class="empty"><div class="empty-icon">🔍</div>No files found for: ${query}</div>`;
    return;
  }
  html += "<ul>";
  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    const pathDisplay = item.parent_path === "/" ? "/" : item.parent_path;
    html += (
      `<li style="--i:${i}">` +
      `<span class="icon">${item.is_dir ? ICON_FOLDER : ICON_FILE}</span>` +
      `<a href="#" data-action="navigate-parent" data-path="${escapeAttr(item.parent_path)}">${item.name}</a>` +
      `<span style="margin-left: 8px; font-size: 12px; color: #9ca3af;">${pathDisplay}</span>` +
      `<span class="spacer"></span>` +
      `</li>`
    );
  }
  app.innerHTML = html + "</ul>";
}

function navigateToParent(parentPath) {
  currentSearchQuery = "";
  navigate(parentPath);
}

/* === Search === */
function handleSearchInput(event) {
  currentSearchQuery = event.target.value;
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => searchFiles(currentSearchQuery), 300);
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
  displaySearchResults(await res.json(), query);
}

/* === Upload === */
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
    if (relativePath) url += `&relative_path=${encodeURIComponent(relativePath)}`;
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
    showProgress(total > 1 ? `Uploading ${i + 1}/${total}: ${displayName}` : `Uploading ${displayName}`);
    updateProgress(0);
    const ok = await uploadOneFile(file, currentPath, relativePath);
    if (!ok) failed.push(displayName);
  }
  hideProgress();
  if (failed.length) alert(`Failed to upload: ${failed.join(", ")}`);
  navigate(currentPath);
}

async function uploadFile() {
  const input = document.getElementById("fileInput");
  const files = Array.from(input.files);
  if (!files.length) return;
  await uploadFiles(files.map((file) => ({ file, relativePath: null })));
  input.value = "";
}

async function uploadFolder() {
  const input = document.getElementById("folderInput");
  const files = Array.from(input.files);
  if (!files.length) return;
  await uploadFiles(files.map((file) => ({ file, relativePath: file.webkitRelativePath })));
  input.value = "";
}

/* === File Operations === */
function downloadZip(path) {
  window.open(`/api/download-zip?path=${encodeURIComponent(path)}`, "_blank");
}

async function postAndNavigate(url, errorMsg) {
  const res = await fetch(url, { method: "POST" });
  if (res.ok) {
    navigate(currentPath);
  } else {
    const error = await res.json();
    alert(error.detail || errorMsg);
  }
}

async function createFolder() {
  const folderName = prompt("Enter folder name:");
  if (!folderName) return;
  await postAndNavigate(
    `/api/create-folder?path=${encodeURIComponent(currentPath)}&name=${encodeURIComponent(folderName)}`,
    "Failed to create folder"
  );
}

async function renameItem(itemPath, oldName) {
  const newName = prompt("Rename to:", oldName);
  if (!newName || newName === oldName) return;
  await postAndNavigate(
    `/api/rename?path=${encodeURIComponent(itemPath)}&new_name=${encodeURIComponent(newName)}`,
    "Failed to rename"
  );
}

async function deleteItem(itemPath, name, isDir) {
  const message = isDir
    ? `Delete folder '${name}' and all its contents? This cannot be undone.`
    : `Delete '${name}'? This cannot be undone.`;
  if (!confirm(message)) return;
  await postAndNavigate(
    `/api/delete?path=${encodeURIComponent(itemPath)}`,
    "Failed to delete"
  );
}

/* === Selection === */
function toggleSelect(path, checked) {
  if (checked) selectedPaths.add(path);
  else selectedPaths.delete(path);
  updateSelectionUI();
}

function updateSelectionUI() {
  const ul = app.querySelector("ul");
  if (ul) ul.classList.toggle("has-selection", selectedPaths.size > 0);

  app.querySelectorAll("li[data-path]").forEach((li) => {
    li.classList.toggle("selected", selectedPaths.has(li.dataset.path));
  });

  const existing = app.querySelector(".selection-bar");
  if (selectedPaths.size === 0) {
    if (existing) existing.remove();
    stopElevatorMusic();
    return;
  }

  const count = selectedPaths.size;
  const barHTML = (
    `<div class="selection-bar">` +
    `<span>${count} item${count > 1 ? "s" : ""} selected</span>` +
    `<span class="selection-bar-actions">` +
    `<button class="btn btn-sm btn-secondary" data-action="clear-selection">Cancel</button>` +
    `<button class="btn btn-sm btn-secondary" data-action="download-selected">Download zip</button>` +
    `<button class="btn btn-sm btn-danger" data-action="delete-selected">Delete</button>` +
    `</span></div>`
  );
  if (existing) {
    existing.outerHTML = barHTML;
  } else {
    const contentActions = app.querySelector(".content-actions");
    if (contentActions) contentActions.insertAdjacentHTML("afterend", barHTML);
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
  if (!confirm(`Delete ${count} item${count > 1 ? "s" : ""}? This cannot be undone.`)) return;

  const res = await fetch("/api/batch-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths: Array.from(selectedPaths) }),
  });
  if (res.ok) {
    const failures = (await res.json()).results.filter((r) => r.status === "error");
    if (failures.length > 0) {
      alert(`Failed to delete ${failures.length} item(s):\n` + failures.map((f) => `${f.path}: ${f.detail}`).join("\n"));
    }
  } else {
    alert("Failed to delete items");
  }
  selectedPaths.clear();
  navigate(currentPath);
}

async function downloadSelected() {
  if (!selectedPaths.size) return;
  const res = await fetch("/api/batch-download-zip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths: Array.from(selectedPaths) }),
  });
  if (res.ok) {
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "selected.zip";
    a.click();
    URL.revokeObjectURL(url);
  } else {
    alert("Failed to download items");
  }
}

/* === UI Sound Effects === */
let uiAudioCtx = null;
let lastHoverSoundTime = 0;

function getUIAudioCtx() {
  if (!uiAudioCtx) uiAudioCtx = new (window.AudioContext || window["webkitAudioContext"])();
  return uiAudioCtx;
}

function playHoverSound() {
  const now = Date.now();
  if (now - lastHoverSoundTime < 80) return;
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
document.addEventListener("mouseover", (e) => { if (e.target.closest(UI_INTERACTIVE)) playHoverSound(); });
document.addEventListener("mousedown", (e) => { if (e.target.closest(UI_INTERACTIVE)) playClickSound(); });

/* === Elevator Music === */
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
  [293.66, 1.4], // D4
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

/* === Drag and Drop === */
let dragDepth = 0;
const dragOverlay = document.getElementById("dragOverlay");

document.addEventListener("dragenter", (e) => {
  e.preventDefault();
  if (++dragDepth === 1) dragOverlay.classList.add("active");
});
document.addEventListener("dragleave", (e) => {
  e.preventDefault();
  if (--dragDepth === 0) dragOverlay.classList.remove("active");
});
document.addEventListener("dragover", (e) => { e.preventDefault(); });
document.addEventListener("drop", async (e) => {
  e.preventDefault();
  dragDepth = 0;
  dragOverlay.classList.remove("active");
  const items = Array.from(e.dataTransfer.items);
  if (!items.length) return;
  const filesWithPaths = await collectFilesFromDrop(items);
  if (!filesWithPaths.length) { alert("No files found to upload."); return; }
  await uploadFiles(filesWithPaths);
});

async function readAllEntries(dirReader) {
  return new Promise((resolve) => {
    const allEntries = [];
    const readBatch = () => {
      dirReader.readEntries((entries) => {
        if (entries.length === 0) resolve(allEntries);
        else { allEntries.push(...entries); readBatch(); }
      });
    };
    readBatch();
  });
}

async function traverseEntry(entry, parentPath, filesWithPaths) {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((file) => {
        const relativePath = parentPath ? `${parentPath}/${file.name}` : file.name;
        filesWithPaths.push({ file, relativePath });
        resolve();
      });
    });
  } else if (entry.isDirectory) {
    const entries = await readAllEntries(entry.createReader());
    for (const childEntry of entries) {
      const newPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      await traverseEntry(childEntry, newPath, filesWithPaths);
    }
  }
}

async function collectFilesFromDrop(items) {
  const filesWithPaths = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry();
    if (entry) await traverseEntry(entry, "", filesWithPaths);
  }
  return filesWithPaths;
}

/* === Event Delegation === */
app.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  e.preventDefault();
  const { action, path, name, isDir } = el.dataset;
  switch (action) {
    case "navigate":          navigate(path); break;
    case "navigate-parent":   navigateToParent(path); break;
    case "view-file":         viewFile(path); break;
    case "download-zip":      downloadZip(path); break;
    case "rename":            renameItem(path, name); break;
    case "delete":            deleteItem(path, name, isDir === "true"); break;
    case "create-folder":     createFolder(); break;
    case "upload-files":      document.getElementById("fileInput").click(); break;
    case "upload-folder":     document.getElementById("folderInput").click(); break;
    case "clear-search":      clearSearch(); break;
    case "clear-selection":   clearSelection(); break;
    case "download-selected": downloadSelected(); break;
    case "delete-selected":   deleteSelected(); break;
  }
});

app.addEventListener("change", (e) => {
  if (e.target.classList.contains("select-cb")) {
    const li = e.target.closest("li[data-path]");
    if (li) toggleSelect(li.dataset.path, e.target.checked);
  }
});

app.addEventListener("input", (e) => {
  if (e.target.classList.contains("search-input")) handleSearchInput(e);
});

/* === Init === */
navigate("/");
