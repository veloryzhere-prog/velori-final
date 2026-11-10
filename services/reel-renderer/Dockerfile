FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data/exports \
  && chown -R node:node /data

WORKDIR /app
COPY --chown=node:node services/reel-renderer/server.mjs services/reel-renderer/server.mjs
COPY --chown=node:node src/lib/reel-editor/export-pipeline.mjs src/lib/reel-editor/export-pipeline.mjs

ENV NODE_ENV=production
ENV PORT=8788
ENV VELORI_RENDER_OUTPUT_DIR=/data/exports
ENV VELORI_FFMPEG_FONT_FILE=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
EXPOSE 8788
VOLUME ["/data/exports"]
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8788/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "services/reel-renderer/server.mjs"]
