#!/usr/bin/env python3
"""
Daily backup: pg_dump → compress → upload to MinIO
รัน: python backup.py หรือ schedule ด้วย cron/celery beat ทุกวัน 02:00
"""
import subprocess
import os
from datetime import datetime
from minio import Minio
from app.config import settings

def run_backup():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dump_filename = f"lemcs_backup_{timestamp}.sql.gz"
    dump_path = f"/tmp/{dump_filename}"

    print(f"Starting backup for {settings.POSTGRES_DB}...")

    # 1. pg_dump + compress
    cmd = [
        "pg_dump",
        f"--host={settings.POSTGRES_HOST}",
        f"--port={settings.POSTGRES_PORT}",
        f"--username={settings.POSTGRES_USER}",
        f"--dbname={settings.POSTGRES_DB}",
        "--no-password",
        "--format=plain",
    ]
    env = os.environ.copy()
    env["PGPASSWORD"] = settings.POSTGRES_PASSWORD

    with open(dump_path, "wb") as f:
        dump_proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, env=env)
        gzip_proc = subprocess.Popen(["gzip", "-c"], stdin=dump_proc.stdout, stdout=f)
        dump_proc.stdout.close()
        gzip_proc.communicate()

    # 2. Upload to MinIO
    client = Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=False,
    )

    bucket = settings.MINIO_BUCKET_BACKUPS if hasattr(settings, 'MINIO_BUCKET_BACKUPS') else "lemcs-backups"
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)

    print(f"Uploading {dump_filename} to MinIO bucket '{bucket}'...")
    client.fput_object(bucket, f"daily/{dump_filename}", dump_path)

    # 3. Cleanup local file
    os.remove(dump_path)

    print(f"✅ Backup สำเร็จ: {dump_filename}")
    return dump_filename

if __name__ == "__main__":
    run_backup()
