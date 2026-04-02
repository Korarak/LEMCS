import hashlib
import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.config import settings

def hash_pii(plaintext: str) -> str:
    """แปลงข้อมูลบัตร ปชช เป็น Hash เพื่อใช้ค้นหา/ล็อกอิน"""
    salt = settings.SECRET_KEY.encode()  # ใช้ secret_key เป็น salt กลาง
    return hashlib.sha256(plaintext.encode() + salt).hexdigest()

def encrypt_pii(plaintext: str) -> str:
    """เข้ารหัสข้อมูล ปชช แบบ Reversible AESGCM"""
    key = settings.ENCRYPTION_KEY.encode()[:32]
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return base64.b64encode(nonce + ciphertext).decode()

def decrypt_pii(encrypted: str) -> str:
    """ถอดรหัสข้อมูลไว้ใช้งานในระบบรายงาน"""
    key = settings.ENCRYPTION_KEY.encode()[:32]
    aesgcm = AESGCM(key)
    data = base64.b64decode(encrypted)
    nonce = data[:12]
    ciphertext = data[12:]
    return aesgcm.decrypt(nonce, ciphertext, None).decode()
