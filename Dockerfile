# Calibre Librarian MCP Server
# Multi-stage build for smaller final image

# Stage 1: Build
FROM node:24-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY tsconfig.json xmcp.config.ts xmcp-env.d.ts ./
COPY src/ ./src/

# Build the project
RUN pnpm run build

# Stage 2: Production
FROM node:24-slim AS production

# Install Calibre CLI tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    calibre \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Environment variables (can be overridden at runtime)
ENV NODE_ENV=production
ENV CALIBRE_DB_COMMAND=calibredb
ENV CALIBRE_COMMAND_TIMEOUT_MS=15000
ENV MCP_SERVER_NAME="Calibre Librarian MCP"

# The library path must be mounted at runtime
# Example: docker run -v /path/to/calibre:/library -e CALIBRE_LIBRARY_PATH=/library ...

# Entry point for stdio transport
CMD ["node", "dist/stdio.js"]
