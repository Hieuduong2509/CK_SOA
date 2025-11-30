import redis
import os

_redis_client = None

def get_redis() -> redis.Redis:
    """
    Khởi tạo và trả về một kết nối Redis duy nhất.
    """
    global _redis_client
    if _redis_client:
        try:
            # Kiểm tra nhanh xem kết nối
            _redis_client.ping()
            return _redis_client
        except redis.exceptions.ConnectionError:
            print("Redis connection lost. Reconnecting...")
            _redis_client = None

    # Ưu tiên đọc Biến Môi trường
    REDIS_URL = os.environ.get("REDIS_URL")

    if not REDIS_URL:
        REDIS_URL = "rediss://red-d3uc6tfdiees73e5gnmg:HmvfAQGsccc8C6j6A6r1VFxs7MI2fhdx@oregon-keyvalue.render.com:6379"

    print(f"Connecting to Redis...")

    _redis_client = redis.from_url(
        REDIS_URL,
        decode_responses=True # Tự động giải mã bytes thành string
    )
    _redis_client.ping()
    print("Redis connection successful!")
    return _redis_client