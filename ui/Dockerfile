# DEMO/REFERENCE SCAFFOLD Dockerfile for the Spec-Ingest Tool's lightweight
# browser UI (ui/server.mjs). Build from the REPO ROOT so this stage can
# reach ../src, ../package.json, and ../ingestRunner.mjs:
#
#   docker build -f ui/Dockerfile -t spec-ingest-ui .
#   docker run --rm -p 8787:8787 -v /path/to/your/files:/data spec-ingest-ui
#
# Then open http://localhost:8787 — it lists whatever is mounted at /data
# and runs the same sniff-and-read loop as `node cli.mjs`, rendered as
# server-side HTML (no client-side JavaScript, per the shared invariant).

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV INGEST_DATA_DIR=/data
ENV PORT=8787
COPY --from=build /app/dist ./dist
COPY ingestRunner.mjs ./
COPY ui/server.mjs ui/style.css ui/package.json ./ui/
EXPOSE 8787
VOLUME ["/data"]
ENTRYPOINT ["node", "ui/server.mjs"]
