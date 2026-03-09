const app = document.getElementById("app");
let currentPath = "/";
let currentSearchQuery = "";
let searchTimeout = null;

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
  html += `<input type="text" class="search-input" placeholder="Search files..." `;
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
  app.innerHTML = `<div class="loading"><span class="spinner"></span></div>`;
  const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
  if (!res.ok) return (app.innerHTML = `<div class="empty">Error loading files</div>`);
  const files = await res.json();
  let html = breadcrumb(path);

  // Add "New Folder" button before file list
  html += `<div class="content-actions"><button class="btn btn-secondary btn-sm" onclick="createFolder()">+ New Folder</button></div>`;

  if (!files.length) {
    app.innerHTML = html + `<div class="empty">Empty folder</div>`;
    return;
  }
  html += "<ul>";
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.is_dir) {
      const next = joinPath(path, f.name);
      html += `<li style="--i:${i}"><span class="icon">📁</span><a href="#" onclick="navigate('${next}');return false">${f.name}</a>`;
      html += `<span class="action-icon" onclick="renameItem('${next}', '${f.name}', event)" title="rename">✏️</span>`;
      html += `<span class="action-icon" onclick="deleteItem('${next}', '${f.name}', true, event)" title="delete">🗑️</span>`;
      html += `<span class="spacer"></span><span class="action-icon download-icon" onclick="downloadZip('${next}')" title="download as zip">📥</span></li>`;
    } else {
      const filePath = joinPath(path, f.name);
      html += `<li class="file" style="--i:${i}"><span class="icon">📄</span><a href="#" onclick="viewFile('${filePath}');return false">${f.name}</a>`;
      html += `<span class="action-icon" onclick="renameItem('${filePath}', '${f.name}', event)" title="rename">✏️</span>`;
      html += `<span class="action-icon" onclick="deleteItem('${filePath}', '${f.name}', false, event)" title="delete">🗑️</span>`;
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
    relativePath: null, // No folder structure for individual files
  }));

  await uploadFiles(filesWithPaths);
  input.value = "";
}

async function uploadFolder() {
  const input = document.getElementById("folderInput");
  const files = Array.from(input.files);
  if (!files.length) return;

  // Extract files with their relative paths (webkitRelativePath)
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
  html += `<div class="search-results-header">Search results for: <strong>${query}</strong></div>`;

  if (!results.length) {
    app.innerHTML = html + `<div class="empty">No files found for: ${query}</div>`;
    return;
  }

  html += "<ul>";
  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    const icon = item.is_dir ? "📁" : "📄";
    const pathDisplay = item.parent_path === "/" ? "/" : item.parent_path;
    html += `<li style="--i:${i}">`;
    html += `<span class="icon">${icon}</span>`;
    html += `<a href="#" onclick="navigateToParent('${item.parent_path}');return false">${item.name}</a>`;
    html += `<span style="margin-left: 8px; font-size: 12px; color: #999;">${pathDisplay}</span>`;
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
