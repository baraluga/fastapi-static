const app = document.getElementById("app");

function breadcrumb(path) {
  const parts = path.split("/").filter(Boolean);
  let html = `<nav><a href="#" onclick="navigate('/');return false">root</a>`;
  let built = "";
  for (const p of parts) {
    built += "/" + p;
    html += `<span>/</span><a href="#" onclick="navigate('${built}');return false">${p}</a>`;
  }
  return html + "</nav>";
}

async function navigate(path) {
  const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
  if (!res.ok) return (app.innerHTML = `<div class="empty">Error loading files</div>`);
  const files = await res.json();
  let html = breadcrumb(path);
  if (!files.length) { app.innerHTML = html + `<div class="empty">Empty folder</div>`; return; }
  html += "<ul>";
  for (const f of files) {
    if (f.is_dir) {
      const next = (path === "/" ? "/" : path + "/") + f.name;
      html += `<li><span class="icon">📁</span><a href="#" onclick="navigate('${next}');return false">${f.name}</a></li>`;
    } else {
      html += `<li class="file"><span class="icon">📄</span>${f.name}</li>`;
    }
  }
  app.innerHTML = html + "</ul>";
}

navigate("/");
