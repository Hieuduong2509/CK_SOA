FROM python:3.11-alpine

# Cài các thư viện cần thiết để cài Python package
RUN apk add --no-cache \
    gcc musl-dev libffi-dev \
    jpeg-dev zlib-dev freetype-dev \
    lcms2-dev openjpeg-dev tiff-dev \
    tk-dev tcl-dev harfbuzz-dev fribidi-dev \
    libxcb-dev

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Cài Python package
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
