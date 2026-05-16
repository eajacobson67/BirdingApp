FROM python:3.11-slim

# ffmpeg is required by birdnetlib for audio decoding
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the BirdNET model at build time so the container starts instantly
RUN python -c "from birdnetlib.analyzer import Analyzer; Analyzer()"

COPY birdnet_server.py .

ENV PORT=8080
CMD ["python", "birdnet_server.py"]
