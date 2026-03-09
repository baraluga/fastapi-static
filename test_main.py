import zipfile
from io import BytesIO
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import main
from main import app, sanitize_name


@pytest.fixture
def client(tmp_path):
    (tmp_path / "hello.txt").write_text("hello world")
    (tmp_path / "subdir").mkdir()
    (tmp_path / "subdir" / "nested.txt").write_text("nested content")
    main.ROOT_DIR = tmp_path
    return TestClient(app)


# --- sanitize_name ---


def test_sanitize_strips_slashes():
    assert sanitize_name("foo/bar") == "foobar"
    assert sanitize_name("foo\\bar") == "foobar"


def test_sanitize_strips_dotdot():
    assert sanitize_name("..etc") == "etc"
    assert sanitize_name("foo..bar") == "foobar"


def test_sanitize_rejects_empty():
    with pytest.raises(HTTPException):
        sanitize_name("")
    with pytest.raises(HTTPException):
        sanitize_name("   ")


def test_sanitize_rejects_null_bytes():
    with pytest.raises(HTTPException):
        sanitize_name("file\x00name")


# --- GET /api/files ---


def test_list_files(client):
    res = client.get("/api/files?path=/")
    assert res.status_code == 200
    names = {f["name"] for f in res.json()}
    assert "hello.txt" in names
    assert "subdir" in names


def test_list_files_subdir(client):
    res = client.get("/api/files?path=/subdir")
    assert res.status_code == 200
    names = {f["name"] for f in res.json()}
    assert "nested.txt" in names


def test_list_files_invalid_path(client):
    res = client.get("/api/files?path=/nonexistent")
    assert res.status_code == 400


def test_list_files_path_traversal(client):
    res = client.get("/api/files?path=/../../etc")
    assert res.status_code == 400


# --- GET /api/download ---


def test_download_file(client):
    res = client.get("/api/download?path=/hello.txt")
    assert res.status_code == 200
    assert res.text == "hello world"


def test_download_nonexistent(client):
    res = client.get("/api/download?path=/nope.txt")
    assert res.status_code == 400


def test_download_path_traversal(client):
    res = client.get("/api/download?path=/../../etc/passwd")
    assert res.status_code == 400


# --- POST /api/upload ---


def test_upload_file(client, tmp_path):
    res = client.post(
        "/api/upload?path=/",
        files={"file": ("test.txt", b"test content", "text/plain")},
    )
    assert res.status_code == 200
    assert res.json()["filename"] == "test.txt"
    assert (tmp_path / "test.txt").read_text() == "test content"


def test_upload_sanitizes_filename(client, tmp_path):
    res = client.post(
        "/api/upload?path=/",
        files={"file": ("../evil.txt", b"data", "text/plain")},
    )
    assert res.status_code == 200
    assert ".." not in res.json()["filename"]


def test_upload_to_subdir(client, tmp_path):
    res = client.post(
        "/api/upload?path=/subdir",
        files={"file": ("sub.txt", b"in subdir", "text/plain")},
    )
    assert res.status_code == 200
    assert (tmp_path / "subdir" / "sub.txt").read_text() == "in subdir"


def test_upload_large_file(client, tmp_path):
    data = b"x" * (2 * 1024 * 1024)  # 2MB to test chunked reading
    res = client.post(
        "/api/upload?path=/",
        files={"file": ("large.bin", data, "application/octet-stream")},
    )
    assert res.status_code == 200
    assert (tmp_path / "large.bin").stat().st_size == len(data)


def test_upload_invalid_dir(client):
    res = client.post(
        "/api/upload?path=/nonexistent",
        files={"file": ("test.txt", b"data", "text/plain")},
    )
    assert res.status_code == 400


# --- GET /api/download-zip ---


def test_download_zip(client):
    res = client.get("/api/download-zip?path=/subdir")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/zip"
    zf = zipfile.ZipFile(BytesIO(res.content))
    assert "nested.txt" in zf.namelist()


def test_download_zip_invalid_path(client):
    res = client.get("/api/download-zip?path=/nonexistent")
    assert res.status_code == 400


# --- POST /api/create-folder ---


def test_create_folder(client, tmp_path):
    res = client.post("/api/create-folder?path=/&name=newfolder")
    assert res.status_code == 200
    assert res.json()["name"] == "newfolder"
    assert (tmp_path / "newfolder").is_dir()


def test_create_folder_already_exists(client):
    res = client.post("/api/create-folder?path=/&name=subdir")
    assert res.status_code == 400


def test_create_folder_sanitizes_name(client, tmp_path):
    res = client.post("/api/create-folder?path=/&name=..%2Fevil")
    assert res.status_code == 200
    name = res.json()["name"]
    assert "/" not in name
    assert ".." not in name


# --- POST /api/rename ---


def test_rename_file(client, tmp_path):
    res = client.post("/api/rename?path=/hello.txt&new_name=renamed.txt")
    assert res.status_code == 200
    assert res.json()["new_name"] == "renamed.txt"
    assert (tmp_path / "renamed.txt").exists()
    assert not (tmp_path / "hello.txt").exists()


def test_rename_folder(client, tmp_path):
    res = client.post("/api/rename?path=/subdir&new_name=renamed_dir")
    assert res.status_code == 200
    assert (tmp_path / "renamed_dir").is_dir()
    assert not (tmp_path / "subdir").exists()


def test_rename_already_exists(client):
    res = client.post("/api/rename?path=/hello.txt&new_name=subdir")
    assert res.status_code == 400


def test_rename_nonexistent(client):
    res = client.post("/api/rename?path=/nope.txt&new_name=whatever")
    assert res.status_code == 400


def test_rename_sanitizes_name(client):
    res = client.post("/api/rename?path=/hello.txt&new_name=../evil.txt")
    assert res.status_code == 200
    assert ".." not in res.json()["new_name"]


# --- POST /api/delete ---


def test_delete_file(client, tmp_path):
    res = client.post("/api/delete?path=/hello.txt")
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    assert not (tmp_path / "hello.txt").exists()


def test_delete_folder(client, tmp_path):
    # Create an empty folder
    (tmp_path / "empty").mkdir()
    res = client.post("/api/delete?path=/empty")
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    assert not (tmp_path / "empty").exists()


def test_delete_folder_with_contents(client, tmp_path):
    # Delete folder with nested content (recursive)
    res = client.post("/api/delete?path=/subdir")
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    assert not (tmp_path / "subdir").exists()
    assert not (tmp_path / "subdir" / "nested.txt").exists()


def test_delete_nonexistent(client):
    res = client.post("/api/delete?path=/nonexistent.txt")
    assert res.status_code == 400


def test_delete_path_traversal(client):
    res = client.post("/api/delete?path=/../../etc/passwd")
    assert res.status_code == 400


def test_delete_root(client):
    res = client.post("/api/delete?path=/")
    assert res.status_code == 400


# --- GET /api/search ---


def test_search_finds_files(client):
    res = client.get("/api/search?query=hello")
    assert res.status_code == 200
    results = res.json()
    assert len(results) == 1
    assert results[0]["name"] == "hello.txt"
    assert results[0]["path"] == "/hello.txt"
    assert results[0]["is_dir"] is False
    assert results[0]["parent_path"] == "/"


def test_search_finds_nested_files(client):
    res = client.get("/api/search?query=nested")
    assert res.status_code == 200
    results = res.json()
    assert len(results) == 1
    assert results[0]["name"] == "nested.txt"
    assert results[0]["path"] == "/subdir/nested.txt"
    assert results[0]["is_dir"] is False
    assert results[0]["parent_path"] == "/subdir"


def test_search_finds_directories(client):
    res = client.get("/api/search?query=subdir")
    assert res.status_code == 200
    results = res.json()
    assert len(results) == 1
    assert results[0]["name"] == "subdir"
    assert results[0]["path"] == "/subdir"
    assert results[0]["is_dir"] is True
    assert results[0]["parent_path"] == "/"


def test_search_case_insensitive(client):
    res = client.get("/api/search?query=HELLO")
    assert res.status_code == 200
    results = res.json()
    assert len(results) == 1
    assert results[0]["name"] == "hello.txt"


def test_search_partial_match(client):
    res = client.get("/api/search?query=txt")
    assert res.status_code == 200
    results = res.json()
    names = {r["name"] for r in results}
    assert "hello.txt" in names
    assert "nested.txt" in names


def test_search_no_results(client):
    res = client.get("/api/search?query=nonexistent")
    assert res.status_code == 200
    assert res.json() == []


def test_search_empty_query(client):
    res = client.get("/api/search?query=")
    assert res.status_code == 200
    assert res.json() == []


def test_search_result_limit(client, tmp_path):
    # Create more than 50 files to test the limit
    for i in range(60):
        (tmp_path / f"file{i}.txt").write_text(f"content{i}")
    res = client.get("/api/search?query=file")
    assert res.status_code == 200
    results = res.json()
    assert len(results) == 50  # Should be limited to 50


# --- POST /api/upload with relative_path (folder upload) ---


def test_upload_file_with_relative_path(client, tmp_path):
    res = client.post(
        "/api/upload?path=/&relative_path=myFolder/subdir/file.txt",
        files={"file": ("file.txt", b"content", "text/plain")},
    )
    assert res.status_code == 200
    assert res.json()["filename"] == "myFolder/subdir/file.txt"
    assert (tmp_path / "myFolder" / "subdir" / "file.txt").read_text() == "content"


def test_upload_with_deep_nesting(client, tmp_path):
    res = client.post(
        "/api/upload?path=/&relative_path=a/b/c/d/e/file.txt",
        files={"file": ("file.txt", b"deep", "text/plain")},
    )
    assert res.status_code == 200
    assert (tmp_path / "a" / "b" / "c" / "d" / "e" / "file.txt").read_text() == "deep"


def test_upload_merge_on_conflict(client, tmp_path):
    # Create existing folder with file
    (tmp_path / "folder").mkdir()
    (tmp_path / "folder" / "old.txt").write_text("old")

    # Upload new file to same folder
    res = client.post(
        "/api/upload?path=/&relative_path=folder/new.txt",
        files={"file": ("new.txt", b"new", "text/plain")},
    )
    assert res.status_code == 200
    assert (tmp_path / "folder" / "new.txt").read_text() == "new"
    assert (tmp_path / "folder" / "old.txt").read_text() == "old"  # Old file preserved


def test_upload_relative_path_sanitization(client, tmp_path):
    # Each component should be sanitized individually
    res = client.post(
        "/api/upload?path=/&relative_path=folder../sub..dir/file.txt",
        files={"file": ("file.txt", b"content", "text/plain")},
    )
    assert res.status_code == 200
    # ".." should be stripped from each component
    assert (tmp_path / "folder" / "subdir" / "file.txt").exists()


def test_upload_relative_path_traversal_blocked(client, tmp_path):
    # Attempt path traversal with relative_path
    res = client.post(
        "/api/upload?path=/&relative_path=../../../etc/passwd",
        files={"file": ("passwd", b"evil", "text/plain")},
    )
    assert res.status_code == 200
    # Should sanitize to "etc/passwd" within ROOT_DIR
    assert (tmp_path / "etc" / "passwd").read_text() == "evil"
    # Verify it's actually within ROOT_DIR
    assert (tmp_path / "etc" / "passwd").is_relative_to(tmp_path)


def test_upload_relative_path_empty_components(client, tmp_path):
    # Malformed path with empty components
    res = client.post(
        "/api/upload?path=/&relative_path=folder//subdir///file.txt",
        files={"file": ("file.txt", b"content", "text/plain")},
    )
    assert res.status_code == 200
    # Empty components should be filtered out
    assert (tmp_path / "folder" / "subdir" / "file.txt").read_text() == "content"


def test_upload_multiple_files_to_nested_folder(client, tmp_path):
    # Upload multiple files to the same nested folder
    res1 = client.post(
        "/api/upload?path=/&relative_path=project/src/file1.txt",
        files={"file": ("file1.txt", b"content1", "text/plain")},
    )
    res2 = client.post(
        "/api/upload?path=/&relative_path=project/src/file2.txt",
        files={"file": ("file2.txt", b"content2", "text/plain")},
    )
    assert res1.status_code == 200
    assert res2.status_code == 200
    assert (tmp_path / "project" / "src" / "file1.txt").read_text() == "content1"
    assert (tmp_path / "project" / "src" / "file2.txt").read_text() == "content2"


def test_upload_relative_path_single_component(client, tmp_path):
    # relative_path with single component (no folders)
    res = client.post(
        "/api/upload?path=/&relative_path=simple.txt",
        files={"file": ("simple.txt", b"simple", "text/plain")},
    )
    assert res.status_code == 200
    assert (tmp_path / "simple.txt").read_text() == "simple"


def test_upload_relative_path_to_subdir(client, tmp_path):
    # Upload with relative_path to an existing subdir
    res = client.post(
        "/api/upload?path=/subdir&relative_path=nested/file.txt",
        files={"file": ("file.txt", b"in nested", "text/plain")},
    )
    assert res.status_code == 200
    assert (tmp_path / "subdir" / "nested" / "file.txt").read_text() == "in nested"
