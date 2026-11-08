# Production Dockerfile for Meow Cute (เหมียวน่ารัก 3:4 Studio)
# Compatible with Hugging Face Spaces (100% Free 24/7 without GitHub), Render, Railway, or VPS

FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system packages (FFmpeg, Node.js 20, OpenCV system runtime libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    libsm6 \
    libxext6 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy full application codebase
COPY . .

# Set default cloud port (Hugging Face default is 7860, Render uses $PORT)
ENV PORT=7860
EXPOSE 7860

CMD ["node", "server.js"]
