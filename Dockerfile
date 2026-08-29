# DEMO/REFERENCE SCAFFOLD Dockerfile for the Spec-Ingest Tool.
# Builds and runs the CLI scaffold described in Spec-Ingest-Tool.md.
# This is not a production image; no runtime dependencies are required
# per the brief (section 2/3), so the build stage exists only for the
# TypeScript compile step.

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
COPY package.json ./
COPY cli.mjs mcp.mjs ./
COPY --from=build /app/dist ./dist
ENTRYPOINT ["node", "cli.mjs"]
