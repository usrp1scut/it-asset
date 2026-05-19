"""MinIO/S3 object storage helper.

Backend-proxied: callers stream bytes through these helpers; we never hand
the browser a presigned URL (the in-cluster `minio:9000` host isn't
browser-resolvable and presign would also need CORS). Bucket is created
lazily on first use — idempotent and safe to call repeatedly.
"""

import io
from functools import lru_cache
from urllib.parse import urlparse

from minio import Minio

from app.config import get_settings


@lru_cache
def _client() -> Minio:
    s = get_settings()
    u = urlparse(s.s3_endpoint)
    return Minio(
        u.netloc,
        access_key=s.s3_access_key,
        secret_key=s.s3_secret_key,
        secure=u.scheme == "https",
        region=s.s3_region or None,
    )


def _ensure_bucket() -> str:
    s = get_settings()
    bucket = s.s3_bucket
    if not s.s3_auto_create_bucket:
        return bucket  # pre-provisioned on managed cloud; no perms needed
    client = _client()
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
    return bucket


def put_object(key: str, data: bytes, content_type: str) -> None:
    bucket = _ensure_bucket()
    _client().put_object(
        bucket, key, io.BytesIO(data), length=len(data), content_type=content_type
    )


def get_object(key: str) -> bytes:
    bucket = _ensure_bucket()
    resp = _client().get_object(bucket, key)
    try:
        return resp.read()
    finally:
        resp.close()
        resp.release_conn()


def remove_object(key: str) -> None:
    _client().remove_object(_ensure_bucket(), key)
