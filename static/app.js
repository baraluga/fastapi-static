const app = document.getElementById("app");
let currentPath = "/";

async function navigate(path) {
  currentPath = path;
  const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
  if (!res.ok) return (app.textContent = "Error loading files");
  const files = await res.json();
  let html = `<p><b>${path}</b></p>`;
  if (path !== "/") {
    const parent = path.replace(/\/[^/]+\/?$/, "") || "/";
    html += `<div><a href="#" onclick="navigate('${parent}');return false">..</a></div>`;
  }
  for (const f of files) {
    if (f.is_dir) {
      const next = (path === "/" ? "/" : path + "/") + f.name;
      html += `<div><a href="#" onclick="navigate('${next}');return false">${f.name}/</a></div>`;
    } else {
      html += `<div>${f.name}</div>`;
    }
  }
  app.innerHTML = html;
}

navigate("/");
