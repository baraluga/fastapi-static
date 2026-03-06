import os
import zipfile
from io import BytesIO
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()
ROOT_DIR = Path(os.getenv("ROOT_DIR", "./sandbox")).resolve()


@app.get("/api/files")
def list_files(path: str = Query("/")):
    target = (ROOT_DIR / path.lstrip("/")).resolve()
    if not target.is_relative_to(ROOT_DIR) or not target.is_dir():
        raise HTTPException(400, "Invalid path")
    return [
        {"name": entry.name, "is_dir": entry.is_dir()}
        for entry in sorted(target.iterdir())
    ]


@app.get("/api/download")
def download_file(path: str = Query(...)):
    target = (ROOT_DIR / path.lstrip("/")).resolve()
    if not target.is_relative_to(ROOT_DIR) or not target.is_file():
        raise HTTPException(400, "Invalid path")
    return FileResponse(target)


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), path: str = Query("/")):
    filename = file.filename.replace("/", "").replace("\\", "").replace("..", "")
    if not filename or "\x00" in filename:
        raise HTTPException(400, "Invalid filename")
    target_dir = (ROOT_DIR / path.lstrip("/")).resolve()
    if not target_dir.is_relative_to(ROOT_DIR) or not target_dir.is_dir():
        raise HTTPException(400, "Invalid path")
    target_file = target_dir / filename
    with open(target_file, "wb") as f:
        f.write(await file.read())
    return {"status": "success", "filename": filename}


@app.get("/api/download-zip")
def download_zip(path: str = Query("/")):
    target = (ROOT_DIR / path.lstrip("/")).resolve()
    if not target.is_relative_to(ROOT_DIR) or not target.is_dir():
        raise HTTPException(400, "Invalid path")
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, dirs, files in os.walk(target):
            for file in files:
                file_path = Path(root) / file
                arcname = file_path.relative_to(target)
                zip_file.write(file_path, arcname)
    zip_buffer.seek(0)
    zip_name = target.name if target.name else "files"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_name}.zip"'},
    )


app.mount("/", StaticFiles(directory="static", html=True), name="static")
