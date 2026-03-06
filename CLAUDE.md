# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A minimal file browser built with FastAPI (backend) and vanilla JS (frontend). Browse directories, upload files, create folders, rename items, download files/folders as zip. No auth.

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
curl 'http://127.0.0.1:8000/api/download?path=/hello.txt'
curl -X POST 'http://127.0.0.1:8000/api/upload?path=/' -F 'file=@test.txt'
curl -X POST 'http://127.0.0.1:8000/api/create-folder?path=/&name=new-folder'
curl -X POST 'http://127.0.0.1:8000/api/rename?path=/old-name&new_name=new-name'
```

The app serves at http://127.0.0.1:8000.

## Architecture

**Backend (main.py)** — FastAPI app with 6 endpoints:
- `GET /api/files?path=/` — list files/folders, returns `{name, is_dir}[]`
- `GET /api/download?path=` — download individual file
- `GET /api/download-zip?path=` — download directory as zip (streaming)
- `POST /api/upload?path=` — upload file(s) to directory (chunked, 1MB)
- `POST /api/create-folder?path=&name=` — create a new folder
- `POST /api/rename?path=&new_name=` — rename a file or folder
- Shared `sanitize_name()` helper for filename validation
- Request logging on all endpoints via Python `logging`
- Mounts `static/` at root with `html=True`
- Reads from `ROOT_DIR` env var (defaults to `./sandbox`)

**Frontend:**
- **static/index.html** — HTML shell with inline CSS (#007acd theme), animated transitions
- **static/app.js** — Vanilla JS, DOM manipulation, breadcrumb navigation
- Multi-file upload via XHR with progress bar (0-95% upload, "Processing..." server write, 100% confirmed)
- Inline rename via hover icons, folder creation via nav button
- Staggered list animations, loading spinner, ephemeral storage disclaimer

**Testing:**
- **test_main.py** — 26 tests using pytest + FastAPI TestClient
- Covers all endpoints, path traversal, sanitization, large file upload

**CI/CD:**
- **GitHub Actions** — `.github/workflows/ci.yml` runs pytest on push/PR
- **Render** — `render.yaml` for deployment (waits for CI to pass)

**sandbox/** — Dummy directory tree for development

## Key Constraints

- **Security:** Path traversal guarded via `Path.is_relative_to(ROOT_DIR)` on all endpoints
- **Filenames:** `sanitize_name()` blocks `/`, `\`, `..`, null bytes, empty/whitespace names
- **Large files:** Upload reads in 1MB chunks; zip download streams incrementally
- **No frameworks:** Vanilla JS, no Jinja2, no build step
- **Minimal:** Keep codebase tight, avoid over-engineering
