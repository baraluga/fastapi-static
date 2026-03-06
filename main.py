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
    sanitized = name.replace("/", "").replace("\\", "").replace("..", "").strip()
    if not sanitized or "\x00" in sanitized:
        raise HTTPException(400, "Invalid name")
    return sanitized


@app.get("/api/files")
def list_files(path: str = Query("/")):
    target = (ROOT_DIR / path.lstrip("/")).resolve()
    if not target.is_relative_to(ROOT_DIR) or not target.is_dir():
        raise HTTPException(400, "Invalid path")
    entries = [
        {"name": entry.name, "is_dir": entry.is_dir()}
        for entry in sorted(target.iterdir())
    ]
    log.info("LIST %s (%d items)", path, len(entries))
    return entries


@app.get("/api/download")
def download_file(path: str = Query(...)):
    target = (ROOT_DIR / path.lstrip("/")).resolve()
    if not target.is_relative_to(ROOT_DIR) or not target.is_file():
        raise HTTPException(400, "Invalid path")
    log.info("DOWNLOAD %s", path)
    return FileResponse(target)


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), path: str = Query("/")):
    filename = sanitize_name(file.filename)
    target_dir = (ROOT_DIR / path.lstrip("/")).resolve()
    if not target_dir.is_relative_to(ROOT_DIR) or not target_dir.is_dir():
        raise HTTPException(400, "Invalid path")
    target_file = target_dir / filename
    size = 0
    with open(target_file, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)
            size += len(chunk)
    log.info("UPLOAD %s/%s (%d bytes)", path, filename, size)
    return {"status": "success", "filename": filename}


@app.get("/api/download-zip")
def download_zip(path: str = Query("/")):
    target = (ROOT_DIR / path.lstrip("/")).resolve()
    if not target.is_relative_to(ROOT_DIR) or not target.is_dir():
        raise HTTPException(400, "Invalid path")

    def generate_zip():
        buffer = BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_STORED) as zf:
            for root, dirs, files in os.walk(target):
                for file in files:
                    file_path = Path(root) / file
                    arcname = str(file_path.relative_to(target))
                    with open(file_path, "rb") as src, \
                            zf.open(arcname, "w") as dest:
                        while chunk := src.read(1024 * 1024):
                            dest.write(chunk)
                    buffer.seek(0)
                    yield buffer.read()
                    buffer.seek(0)
                    buffer.truncate()
        buffer.seek(0)
        remaining = buffer.read()
        if remaining:
            yield remaining

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
    target_dir = (ROOT_DIR / path.lstrip("/")).resolve()
    if not target_dir.is_relative_to(ROOT_DIR) or not target_dir.is_dir():
        raise HTTPException(400, "Invalid path")
    new_folder = target_dir / folder_name
    if new_folder.exists():
        raise HTTPException(400, "Folder already exists")
    new_folder.mkdir()
    log.info("MKDIR %s/%s", path, folder_name)
    return {"status": "success", "name": folder_name}


@app.post("/api/rename")
def rename_item(path: str = Query(...), new_name: str = Query(...)):
    new_name_sanitized = sanitize_name(new_name)
    target = (ROOT_DIR / path.lstrip("/")).resolve()
    if not target.is_relative_to(ROOT_DIR) or not target.exists():
        raise HTTPException(400, "Invalid path")
    new_path = target.parent / new_name_sanitized
    if new_path.exists():
        raise HTTPException(400, "Name already exists")
    target.rename(new_path)
    log.info("RENAME %s -> %s", path, new_name_sanitized)
    return {"status": "success", "new_name": new_name_sanitized}


app.mount("/", StaticFiles(directory="static", html=True), name="static")
