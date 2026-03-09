import logging
import os
import zipfile
from io import BytesIO
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s"
)
log = logging.getLogger(__name__)

app = FastAPI()
ROOT_DIR = Path(os.getenv("ROOT_DIR", "./sandbox")).resolve()


def sanitize_name(name: str) -> str:
    """Sanitize file/folder names to prevent path traversal."""
    sanitized = (
        name.replace("/", "").replace("\\", "").replace("..", "").strip()
    )
    if not sanitized or "\x00" in sanitized:
        raise HTTPException(400, "Invalid name")
    return sanitized


def validate_path(
    path: str, must_be_dir: bool = False, must_be_file: bool = False
) -> Path:
    """Resolve and validate path is within ROOT_DIR.

    Args:
        path: The path to validate (relative to ROOT_DIR)
        must_be_dir: If True, path must be a directory
        must_be_file: If True, path must be a file

    Returns:
        Resolved Path object

    Raises:
        HTTPException: If path is invalid or doesn't meet requirements
    """
    target = (ROOT_DIR / path.lstrip("/")).resolve()
    if not target.is_relative_to(ROOT_DIR):
        raise HTTPException(400, "Invalid path")
    if must_be_dir and not target.is_dir():
        raise HTTPException(400, "Invalid path")
    if must_be_file and not target.is_file():
        raise HTTPException(400, "Invalid path")
    if not must_be_dir and not must_be_file and not target.exists():
        raise HTTPException(400, "Invalid path")
    return target


def to_relative_path(path: Path) -> str:
    """Convert absolute path to API-relative path format."""
    if path == ROOT_DIR:
        return "/"
    return "/" + str(path.relative_to(ROOT_DIR))


@app.get("/api/files")
def list_files(path: str = Query("/")):
    target = validate_path(path, must_be_dir=True)
    entries = [
        {"name": entry.name, "is_dir": entry.is_dir()}
        for entry in sorted(target.iterdir())
    ]
    log.info("LIST %s (%d items)", path, len(entries))
    return entries


@app.get("/api/download")
def download_file(path: str = Query(...)):
    target = validate_path(path, must_be_file=True)
    log.info("DOWNLOAD %s", path)
    return FileResponse(target)


@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    path: str = Query("/"),
    relative_path: str = Query(None)
):
    target_dir = validate_path(path, must_be_dir=True)

    if relative_path:
        # Split and sanitize each path component, filtering out invalid ones
        path_parts = []
        for part in relative_path.split("/"):
            if part:  # Skip empty parts
                # Manually sanitize to allow graceful handling of invalid components
                sanitized = (
                    part.replace("/", "")
                    .replace("\\", "")
                    .replace("..", "")
                    .strip()
                )
                # Skip components that sanitize to empty or contain null bytes
                if sanitized and "\x00" not in sanitized:
                    path_parts.append(sanitized)

        # Ensure we have at least one valid component
        if not path_parts:
            raise HTTPException(400, "Invalid relative path")

        # Create nested directories (last part is filename)
        if len(path_parts) > 1:
            nested_dir = target_dir
            for dir_part in path_parts[:-1]:
                nested_dir = nested_dir / dir_part
                nested_dir.mkdir(parents=True, exist_ok=True)
            target_file = nested_dir / path_parts[-1]
        else:
            target_file = target_dir / path_parts[0]

        result_filename = relative_path
    else:
        # Original behavior: use file.filename
        filename = sanitize_name(file.filename)
        target_file = target_dir / filename
        result_filename = filename

    # Security: validate final path is within ROOT_DIR
    if not target_file.is_relative_to(ROOT_DIR):
        raise HTTPException(400, "Invalid path")

    # Chunked write logic
    size = 0
    with open(target_file, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)
            size += len(chunk)

    log.info("UPLOAD %s/%s (%d bytes)", path, result_filename, size)
    return {"status": "success", "filename": result_filename}


@app.get("/api/download-zip")
def download_zip(path: str = Query("/")):
    target = validate_path(path, must_be_dir=True)

    def generate_zip():
        buffer = BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_STORED) as zf:
            for root, dirs, files in os.walk(target):
                for file in files:
                    file_path = Path(root) / file
                    arcname = str(file_path.relative_to(target))
                    zf.write(file_path, arcname)

        # Stream the complete, valid zip in 1MB chunks
        buffer.seek(0)
        while chunk := buffer.read(1024 * 1024):
            yield chunk

    zip_name = target.name or "files"
    log.info("ZIP %s", path)
    return StreamingResponse(
        generate_zip(),
        media_type="application/zip",
        headers={
            "Content-Disposition":
                f'attachment; filename="{zip_name}.zip"'
        },
    )


@app.post("/api/create-folder")
def create_folder(path: str = Query("/"), name: str = Query(...)):
    folder_name = sanitize_name(name)
    target_dir = validate_path(path, must_be_dir=True)
    new_folder = target_dir / folder_name
    if new_folder.exists():
        raise HTTPException(400, "Folder already exists")
    new_folder.mkdir()
    log.info("MKDIR %s/%s", path, folder_name)
    return {"status": "success", "name": folder_name}


@app.post("/api/rename")
def rename_item(path: str = Query(...), new_name: str = Query(...)):
    new_name_sanitized = sanitize_name(new_name)
    target = validate_path(path)
    new_path = target.parent / new_name_sanitized
    if new_path.exists():
        raise HTTPException(400, "Name already exists")
    target.rename(new_path)
    log.info("RENAME %s -> %s", path, new_name_sanitized)
    return {"status": "success", "new_name": new_name_sanitized}


@app.get("/api/search")
def search_files(query: str = Query("")):
    if not query:
        return []
    query_lower = query.lower()
    results = []
    for root, dirs, files in os.walk(ROOT_DIR):
        root_path = Path(root)
        # Search in directories
        for dir_name in dirs:
            if query_lower in dir_name.lower():
                full_path = root_path / dir_name
                results.append({
                    "name": dir_name,
                    "path": to_relative_path(full_path),
                    "is_dir": True,
                    "parent_path": to_relative_path(root_path)
                })
                if len(results) >= 50:
                    break
        # Search in files
        for file_name in files:
            if query_lower in file_name.lower():
                full_path = root_path / file_name
                results.append({
                    "name": file_name,
                    "path": to_relative_path(full_path),
                    "is_dir": False,
                    "parent_path": to_relative_path(root_path)
                })
                if len(results) >= 50:
                    break
        if len(results) >= 50:
            break
    log.info("SEARCH query=%s results=%d", query, len(results))
    return results


app.mount("/", StaticFiles(directory="static", html=True), name="static")
