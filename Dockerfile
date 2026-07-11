# =========================================================
# Stage 1: Build Phase
# =========================================================
FROM node:18-alpine AS builder

WORKDIR /app

# Install package files for caching
COPY package*.json ./
RUN npm ci

# Copy the entire source tree
COPY . .

# Build Vite frontend and Bundle Express server via esbuild
RUN npm run build

# =========================================================
# Stage 2: Production Runtime
# =========================================================
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy over build outputs and package manifest
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Install only production dependencies
RUN npm ci --only=production

# Copy container entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Port 3000 is the standard port for the Express backend
EXPOSE 3000

# Set dynamic configuration generation as entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]

# Start the application
CMD ["npm", "start"]
