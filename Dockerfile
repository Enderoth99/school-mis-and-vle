FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates && rm -rf /var/lib/apt/lists/* \
 && python3 -m venv /opt/pdf && /opt/pdf/bin/pip install --no-cache-dir 'reportlab>=4,<5' 'pypdf>=6,<7'
WORKDIR /app
COPY . ./
RUN mkdir -p .data
RUN chown -R node:node /app
USER node
ENV NODE_ENV=production WIST_PYTHON=/opt/pdf/bin/python HOST=0.0.0.0 WIST_SEED_DIR=/app/deploy/seed
EXPOSE 8080
CMD ["node","server.mjs"]

