# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A minimal file browser POC built with FastAPI (backend) and vanilla JS (frontend). No auth, no uploads, no downloads — just directory browsing.

## Development

```bash
# Install dependencies
pip3 install -r requirements.txt

# Run dev server
python3 -m uvicorn main:app --reload

# Test the API
curl 'http://127.0.0.1:8000/api/files?path=/'
```

The app serves at http://127.0.0.1:8000. No test suite exists yet.

## Architecture

- **main.py** — FastAPI app. Single endpoint `GET /api/files?path=` returns JSON list of `{name, is_dir}`. Mounts `static/` at root with `html=True`. Reads from `ROOT_DIR` env var (defaults to `./sandbox`).
- **static/index.html** — Bare HTML shell, loads `app.js`. No template engine.
- **static/app.js** — Fetches `/api/files`, renders clickable folder navigation. Pure DOM manipulation, no framework.
- **sandbox/** — Dummy directory tree used as default browsing root for development.

## Key Constraints

- Path traversal is guarded via `Path.is_relative_to(ROOT_DIR)` — preserve this on any endpoint that touches the filesystem.
- No Jinja2 or template engines — frontend is static files only.
- Keep the codebase minimal (currently ~75 lines total across all files).
