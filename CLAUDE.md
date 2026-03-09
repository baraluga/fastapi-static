# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A minimal file browser built with FastAPI (backend) and vanilla JS (frontend). Browse directories, search files, upload files and folders (button or drag-and-drop), create folders, rename items, delete files/folders, download files/folders as zip. No auth.

## Development

```bash
# Install dependencies
pip3 install -r requirements.txt

# Run dev server
python3 -m uvicorn main:app --reload

# Run tests
python3 -m pytest test_main.py -v

# Test the API
curl 'http://127.0.0.1:8000/api/files?path=/'
curl 'http://127.0.0.1:8000/api/search?query=test'
curl 'http://127.0.0.1:8000/api/download?path=/hello.txt'
curl -X POST 'http://127.0.0.1:8000/api/upload?path=/' -F 'file=@test.txt'
curl -X POST 'http://127.0.0.1:8000/api/upload?path=/&relative_path=folder/test.txt' -F 'file=@test.txt'
curl -X POST 'http://127.0.0.1:8000/api/create-folder?path=/&name=new-folder'
curl -X POST 'http://127.0.0.1:8000/api/rename?path=/old-name&new_name=new-name'
curl -X POST 'http://127.0.0.1:8000/api/delete?path=/file-or-folder'
```

The app serves at http://127.0.0.1:8000.

## Architecture

**Backend (main.py)** — FastAPI app with 8 endpoints:
- `GET /api/files?path=/` — list files/folders, returns `{name, is_dir}[]`
- `GET /api/search?query=` — search files/folders by name (case-insensitive, limit 50)
- `GET /api/download?path=` — download individual file
- `GET /api/download-zip?path=` — download directory as zip (streaming)
- `POST /api/upload?path=/&relative_path=folder/file.txt` — upload file(s) to directory (chunked, 1MB), optional relative_path for folder uploads
- `POST /api/create-folder?path=&name=` — create a new folder
- `POST /api/rename?path=&new_name=` — rename a file or folder
- `POST /api/delete?path=` — delete a file or folder (recursive for folders)
- Shared helpers: `sanitize_name()` for filename validation, `validate_path()` for security-critical path validation, `to_relative_path()` for consistent path formatting
- Request logging on all endpoints via Python `logging`
- Mounts `static/` at root with `html=True`
- Reads from `ROOT_DIR` env var (defaults to `./sandbox`)

**Frontend:**
- **static/index.html** — HTML shell with inline CSS (#007acd theme), animated transitions, drag-and-drop overlay, search UI, folder upload input
- **static/app.js** — Vanilla JS, DOM manipulation, breadcrumb navigation
- Live search with 300ms debouncing, results navigate to parent folder
- Multi-file upload via XHR with progress bar (0-95% upload, "Processing..." server write, 100% confirmed)
- Folder upload support via button (webkitdirectory) and drag-and-drop (FileSystemEntry API)
- Drag-and-drop upload support with full-page drop zone and visual indicator (supports files and folders)
- Inline rename and delete via hover icons (🗑️), folder creation via nav button, confirmation dialog before deletion
- Staggered list animations, loading spinner, ephemeral storage disclaimer

**Testing:**
- **test_main.py** — 49 tests using pytest + FastAPI TestClient
- Covers all endpoints, path traversal, sanitization, large file upload, folder upload with relative paths, search functionality, recursive folder deletion

**CI/CD:**
- **GitHub Actions** — `.github/workflows/ci.yml` runs pytest on push/PR
- **Render** — `render.yaml` for deployment (waits for CI to pass)

**sandbox/** — Dummy directory tree for development

## Key Constraints

- **Security:** Path traversal guarded via `validate_path()` helper using `Path.is_relative_to(ROOT_DIR)` on all endpoints; folder upload sanitizes each path component individually
- **Filenames:** `sanitize_name()` blocks `/`, `\`, `..`, null bytes, empty/whitespace names; folder uploads gracefully skip invalid components
- **Large files:** Upload reads in 1MB chunks; zip download streams in 1MB chunks per file (ZIP_STORED, no compression, to avoid buffering)
- **Folder uploads:** Preserve structure, merge on conflict (mkdir with parents=True, exist_ok=True)
- **Search:** Case-insensitive filename matching, limited to 50 results to avoid performance issues
- **No frameworks:** Vanilla JS, no Jinja2, no build step
- **Minimal:** Keep codebase tight, avoid over-engineering
