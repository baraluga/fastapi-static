const app = document.getElementById("app");
let currentPath = "/";

function breadcrumb(path) {
  const parts = path.split("/").filter(Boolean);
  let html = `<nav><div><a href="#" onclick="navigate('/');return false">root</a>`;
  let built = "";
  for (const p of parts) {
    built += "/" + p;
    html += `<span>/</span><a href="#" onclick="navigate('${built}');return false">${p}</a>`;
  }
  html += `</div><div><button class="upload-btn" onclick="createFolder()">New Folder</button>`;
  html += `<button class="upload-btn" onclick="downloadZip('${path}')">Download as zip</button>`;
  html += `<button class="upload-btn" onclick="document.getElementById('fileInput').click()">Upload</button></div></nav>`;
  return html;
}

async function navigate(path) {
  currentPath = path;
  const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
  if (!res.ok) return (app.innerHTML = `<div class="empty">Error loading files</div>`);
  const files = await res.json();
  let html = breadcrumb(path);
  if (!files.length) { app.innerHTML = html + `<div class="empty">Empty folder</div>`; return; }
  html += "<ul>";
  for (const f of files) {
    if (f.is_dir) {
      const next = (path === "/" ? "/" : path + "/") + f.name;
      html += `<li><span class="icon">📁</span><a href="#" onclick="navigate('${next}');return false">${f.name}</a>`;
      html += `<span class="rename-icon" onclick="renameItem('${next}', '${f.name}', event)" title="rename">✏️</span>`;
      html += `<span class="spacer"></span><span class="download-icon" onclick="downloadZip('${next}')" title="download as zip">📥</span></li>`;
    } else {
      const filePath = (path === "/" ? "/" : path + "/") + f.name;
      html += `<li class="file"><span class="icon">📄</span><a href="#" onclick="viewFile('${filePath}');return false">${f.name}</a>`;
      html += `<span class="rename-icon" onclick="renameItem('${filePath}', '${f.name}', event)" title="rename">✏️</span><span class="spacer"></span></li>`;
    }
  }
  app.innerHTML = html + "</ul>";
}

function viewFile(path) {
  window.open(`/api/download?path=${encodeURIComponent(path)}`, '_blank');
}

async function uploadFile() {
  const input = document.getElementById("fileInput");
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`/api/upload?path=${encodeURIComponent(currentPath)}`, {
    method: "POST",
    body: formData,
  });
  if (res.ok) {
    alert("File uploaded successfully!");
    navigate(currentPath);
  } else {
    alert("Upload failed");
  }
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
