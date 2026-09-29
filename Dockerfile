# Stage 1: Build
# Node 22 is required: @supabase/supabase-js needs native WebSocket, which
# Node 20 lacks. On Node 20 the Supabase auth client fails to initialise and
# every /api route answers 503.
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies
RUN npm ci

# Copy application source
COPY . .

# Build the frontend and backend
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built assets
COPY --from=builder /app/dist ./dist

# Start the application
CMD ["npm", "start"]
