from minio import Minio
from minio.error import S3Error
import os
from io import BytesIO

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "portfolios")

minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=False
)


def ensure_bucket(bucket_name: str):
    try:
        if not minio_client.bucket_exists(bucket_name):
            minio_client.make_bucket(bucket_name)
    except S3Error as e:
        print(f"Error ensuring bucket: {e}")


def upload_file(bucket_name: str, object_name: str, file_data: bytes, content_type: str = "application/octet-stream"):
    ensure_bucket(bucket_name)
    try:
        minio_client.put_object(
            bucket_name,
            object_name,
            BytesIO(file_data),
            length=len(file_data),
            content_type=content_type
        )
        return f"http://{MINIO_ENDPOINT}/{bucket_name}/{object_name}"
    except S3Error as e:
        print(f"Error uploading file: {e}")
        raise


def delete_file(bucket_name: str, object_name: str):
    try:
        minio_client.remove_object(bucket_name, object_name)
    except S3Error as e:
        print(f"Error deleting file: {e}")

