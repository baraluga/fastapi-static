# File Browser

A minimal, self-hosted file browser built with FastAPI and vanilla JavaScript. Browse directories, search files, upload files (button or drag-and-drop), create folders, rename items, and download files or folders as zip archives. No authentication, no build step.

## Getting Started

```bash
pip install -r requirements.txt
python3 -m uvicorn main:app --reload
```

Open http://127.0.0.1:8000.

By default, the app serves files from `./sandbox`. Override with the `ROOT_DIR` environment variable:

```bash
ROOT_DIR=/path/to/files python3 -m uvicorn main:app --reload
```

## Features

- Browse directories with breadcrumb navigation
- Live search with debouncing (finds files and folders by name)
- Upload files via button or drag-and-drop with progress bar
- Download individual files or entire folders as zip
- Create new folders
- Rename files and folders inline
- Animated UI with loading states and drag overlay
- Streaming uploads and zip downloads for large files
- Request logging on all endpoints

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/files?path=/` | List files and folders |
| `GET` | `/api/search?query=name` | Search files/folders by name (case-insensitive) |
| `GET` | `/api/download?path=/file.txt` | Download a file |
| `GET` | `/api/download-zip?path=/dir` | Download a directory as zip |
| `POST` | `/api/upload?path=/` | Upload a file (multipart form) |
| `POST` | `/api/create-folder?path=/&name=new` | Create a new folder |
| `POST` | `/api/rename?path=/old&new_name=new` | Rename a file or folder |

## Testing

```bash
python3 -m pytest test_main.py -v
```

34 tests covering all endpoints, path traversal protection, filename sanitization, search functionality, and large file handling.

## Deployment

A `render.yaml` is included for one-click deployment to [Render](https://render.com). Storage is ephemeral on the free tier.

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs tests on every push and PR.

## Project Structure

```
main.py            # FastAPI backend (7 endpoints, path helpers)
test_main.py       # pytest test suite (34 tests)
static/
  index.html       # HTML shell + inline CSS + drag overlay + search UI
  app.js           # Vanilla JS frontend (271 lines)
sandbox/           # Default root directory for development
render.yaml        # Render deployment config
requirements.txt   # Python dependencies
.gitignore         # Python and pytest artifacts
```

## Security

- Path traversal protection via `Path.is_relative_to()` on all endpoints
- Filename sanitization blocks `/`, `\`, `..`, and null bytes
- No authentication — intended for local or trusted network use
