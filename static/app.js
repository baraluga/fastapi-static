const app = document.getElementById("app");
let currentPath = "/";

function breadcrumb(path) {
  const parts = path.split("/").filter(Boolean);
  let html = `<nav><div class="breadcrumbs"><a href="#" onclick="navigate('/');return false">root</a>`;
  let built = "";
  for (const p of parts) {
    built += "/" + p;
    html += `<span class="sep">/</span><a href="#" onclick="navigate('${built}');return false">${p}</a>`;
  }
  html += `</div><div class="nav-actions">`;
  html += `<button class="btn btn-secondary" onclick="createFolder()">New Folder</button>`;
  html += `<button class="btn btn-secondary" onclick="downloadZip('${path}')">Download zip</button>`;
  html += `<button class="btn" onclick="document.getElementById('fileInput').click()">Upload</button>`;
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
  if (!files.length) { app.innerHTML = html + `<div class="empty">Empty folder</div>`; return; }
  html += "<ul>";
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.is_dir) {
      const next = (path === "/" ? "/" : path + "/") + f.name;
      html += `<li style="--i:${i}"><span class="icon">📁</span><a href="#" onclick="navigate('${next}');return false">${f.name}</a>`;
      html += `<span class="action-icon" onclick="renameItem('${next}', '${f.name}', event)" title="rename">✏️</span>`;
      html += `<span class="spacer"></span><span class="action-icon download-icon" onclick="downloadZip('${next}')" title="download as zip">📥</span></li>`;
    } else {
      const filePath = (path === "/" ? "/" : path + "/") + f.name;
      html += `<li class="file" style="--i:${i}"><span class="icon">📄</span><a href="#" onclick="viewFile('${filePath}');return false">${f.name}</a>`;
      html += `<span class="action-icon" onclick="renameItem('${filePath}', '${f.name}', event)" title="rename">✏️</span><span class="spacer"></span></li>`;
    }
  }
  app.innerHTML = html + "</ul>";
}

function viewFile(path) {
  window.open(`/api/download?path=${encodeURIComponent(path)}`, '_blank');
}

async function uploadFile() {
  const input = document.getElementById("fileInput");
  const files = Array.from(input.files);
  if (!files.length) return;
  const failed = [];
  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/upload?path=${encodeURIComponent(currentPath)}`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) failed.push(file.name);
  }
  if (failed.length) {
    alert(`Failed to upload: ${failed.join(", ")}`);
  } else {
    alert(`${files.length} file${files.length > 1 ? "s" : ""} uploaded successfully!`);
  }
  navigate(currentPath);
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

navigate("/");
