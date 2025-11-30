#!/bin/bash
# Script để seed dữ liệu trong Docker container

echo "Đang seed dữ liệu vào database..."
echo ""

# Seed auth database
echo "1. Seeding auth database..."
docker-compose exec -T auth-service python -c "
import sys
import os
sys.path.insert(0, '/app')
from scripts.seed_data import seed_auth_db
seed_auth_db()
"

# Seed main database  
echo "2. Seeding main database..."
docker-compose exec -T user-service python -c "
import sys
import os
sys.path.insert(0, '/app')
from scripts.seed_data import seed_main_db
seed_main_db()
"

echo ""
echo "✓ Hoàn tất seed dữ liệu!"
echo ""
echo "Kiểm tra dữ liệu:"
docker-compose exec -T user-service python /app/scripts/check_data.py

