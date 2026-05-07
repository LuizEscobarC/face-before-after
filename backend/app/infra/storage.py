"""MinIO client para armazenamento de fotos."""

import os
from io import BytesIO
from pathlib import Path

from minio import Minio
from minio.error import S3Error


class MinIOStorage:
    def __init__(self):
        self.endpoint = os.getenv("MINIO_ENDPOINT", "minio:9000")
        self.access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
        self.secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
        self.bucket_name = os.getenv("MINIO_BUCKET_NAME", "face-analysis")
        self.use_ssl = os.getenv("MINIO_USE_SSL", "false").lower() == "true"

        self.client = Minio(
            self.endpoint,
            access_key=self.access_key,
            secret_key=self.secret_key,
            secure=self.use_ssl,
        )

    def ensure_bucket(self):
        """Cria bucket se não existir."""
        try:
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
        except S3Error as e:
            print(f"Erro ao criar bucket: {e}")
            raise

    def upload_file(self, file_data: bytes, object_name: str) -> str:
        """Upload arquivo para MinIO e retorna URL pública."""
        try:
            self.client.put_object(
                self.bucket_name,
                object_name,
                BytesIO(file_data),
                length=len(file_data),
            )
            # Retorna URL de acesso
            return f"http://{self.endpoint}/{self.bucket_name}/{object_name}"
        except S3Error as e:
            print(f"Erro ao fazer upload: {e}")
            raise

    def upload_from_path(self, file_path: str, object_name: str) -> str:
        """Upload arquivo local para MinIO."""
        try:
            self.client.fput_object(self.bucket_name, object_name, file_path)
            return f"http://{self.endpoint}/{self.bucket_name}/{object_name}"
        except S3Error as e:
            print(f"Erro ao fazer upload: {e}")
            raise

    def download_file(self, object_name: str) -> bytes:
        """Download arquivo do MinIO."""
        try:
            response = self.client.get_object(self.bucket_name, object_name)
            return response.read()
        except S3Error as e:
            print(f"Erro ao fazer download: {e}")
            raise

    def delete_file(self, object_name: str) -> bool:
        """Delete arquivo do MinIO."""
        try:
            self.client.remove_object(self.bucket_name, object_name)
            return True
        except S3Error as e:
            print(f"Erro ao deletar arquivo: {e}")
            raise

    def list_files(self, prefix: str = "") -> list:
        """Lista arquivos do bucket."""
        try:
            objects = self.client.list_objects(self.bucket_name, prefix=prefix)
            return [obj.object_name for obj in objects]
        except S3Error as e:
            print(f"Erro ao listar arquivos: {e}")
            raise
