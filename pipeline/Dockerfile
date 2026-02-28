FROM python:3.12-slim@sha256:f3fa41d74a768c2fce8016b98c191ae8c1bacd8f1152870a3f9f87d350920b7c

# Install cron (no other system deps needed — psycopg2-binary is self-contained)
RUN apt-get update \
    && apt-get install -y --no-install-recommends cron \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies before copying scripts so this layer caches well
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy pipeline scripts
COPY scripts/ ./scripts/
RUN chmod +x ./scripts/daily_pipeline.sh

# Install crontab and entrypoint
COPY crontab /etc/cron.d/pipeline
COPY entrypoint.sh ./entrypoint.sh
RUN chmod 0644 /etc/cron.d/pipeline \
    && crontab /etc/cron.d/pipeline \
    && chmod +x entrypoint.sh

# Pre-create writable dirs (price_history and logs will be mounted as volumes)
RUN mkdir -p ./scripts/price_history ./scripts/logs

ENTRYPOINT ["./entrypoint.sh"]
