from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
import redis.asyncio as aioredis
from app.config import settings

redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def dispatch(self, request: Request, call_next):
        # ข้าม rate limit หากเป็น health check (optional)
        if request.url.path == "/health":
            return await call_next(request)

        # ห้ามใช้ใน environment dev/testing ถ้าไม่ได้ mock redis
        if settings.ENVIRONMENT == "development" and not settings.REDIS_URL:
            return await call_next(request)

        try:
            ip = request.client.host
            key = f"ratelimit:{ip}"
            
            # Redis rate limit
            current = await redis_client.incr(key)
            if current == 1:
                await redis_client.expire(key, self.window_seconds)

            if current > self.max_requests:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "มีการส่งคำขอมากเกินไป กรุณาลองใหม่ภายหลัง"}
                )
        except Exception:
            # Fallback หาก Redis มีปัญหา ให้ปล่อยผ่านเพื่อไม่ให้บริการสะดุดหมด
            pass

        return await call_next(request)
