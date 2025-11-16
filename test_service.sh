#!/bin/bash
# Script bash để kiểm tra services

echo "=== Kiểm Tra Docker Services ==="
echo ""

# 1. Kiểm tra Docker đang chạy
echo "1. Kiểm tra Docker..."
if docker ps > /dev/null 2>&1; then
    echo "   ✓ Docker đang chạy"
else
    echo "   ✗ Docker không chạy! Mở Docker Desktop"
    exit 1
fi

echo ""

# 2. Kiểm tra containers
echo "2. Kiểm tra containers..."
docker-compose ps

echo ""

# 3. Kiểm tra port 8001
echo "3. Kiểm tra port 8001..."
if lsof -Pi :8001 -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -an | grep :8001 | grep LISTEN > /dev/null 2>&1; then
    echo "   Port 8001 đang được sử dụng"
else
    echo "   ✓ Port 8001 trống"
fi

echo ""

# 4. Kiểm tra logs auth-service
echo "4. Logs gần nhất của auth-service:"
docker-compose logs --tail=20 auth-service

echo ""

# 5. Test health endpoint
echo "5. Test health endpoint..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/health | grep -q "200"; then
    echo "   ✓ Health check OK:"
    curl -s http://localhost:8001/health | echo "   $(cat)"
else
    echo "   ✗ Không thể kết nối đến http://localhost:8001/health"
fi

echo ""
echo "=== Hoàn thành ==="

