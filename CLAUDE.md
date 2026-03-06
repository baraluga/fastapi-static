# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A minimal file browser built with FastAPI (backend) and vanilla JS (frontend). Browse directories, upload files, download files/folders as zip. No auth.

## Development

```bash
# Install dependencies
pip3 install -r requirements.txt

# Run dev server
python3 -m uvicorn main:app --reload

# Test the API
curl 'http://127.0.0.1:8000/api/files?path=/'
curl 'http://127.0.0.1:8000/api/download?path=/hello.txt'
curl -X POST 'http://127.0.0.1:8000/api/upload?path=/' -F 'file=@test.txt'
```

The app serves at http://127.0.0.1:8000. No test suite exists yet.

## Architecture

**Backend (main.py)** — FastAPI app with 4 endpoints:
- `GET /api/files?path=/` — list files/folders, returns `{name, is_dir}[]`
- `GET /api/download?path=` — download individual file
- `GET /api/download-zip?path=` — download directory as zip (recursive)
- `POST /api/upload?path=` — upload file to directory
- Mounts `static/` at root with `html=True`
- Reads from `ROOT_DIR` env var (defaults to `./sandbox`)

**Frontend:**
- **static/index.html** — HTML shell with inline CSS (#007acd theme), no template engine
- **static/app.js** — Vanilla JS, DOM manipulation, breadcrumb navigation
- Uploads via FormData, downloads via `window.open()`

**sandbox/** — Dummy directory tree for development

## Key Constraints

- **Security:** Path traversal guarded via `Path.is_relative_to(ROOT_DIR)` on all endpoints
- **Filenames:** Upload sanitizes (`/`, `\`, `..`, null bytes blocked)
- **No frameworks:** Vanilla JS, no Jinja2, no build step
- **Minimal:** Keep codebase tight, avoid over-engineering
