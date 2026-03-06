import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
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


app.mount("/", StaticFiles(directory="static", html=True), name="static")
