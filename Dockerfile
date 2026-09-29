# Stage 1: Build
# Node 22 is required: @supabase/supabase-js needs native WebSocket, which
# Node 20 lacks. On Node 20 the Supabase auth client fails to initialise and
# every /api route answers 503.
FROM node:22-alpine AS builder

WORKDIR /app

# The Vite config is inlined into the bundle at BUILD time, not read at
# runtime, so these have to be present while `npm run build` runs. They used
# to come from a .env file, but .dockerignore excludes .env*, so the Docker
# build saw no Supabase configuration at all: VITE_SUPABASE_URL and
# VITE_SUPABASE_ANON_KEY inlined as undefined, supabaseConfigured was false,
# and Google sign-in rendered permanently disabled as "Google Entry Sealed"
# with no error anywhere. Nothing caught it because every server route is
# authenticated by its own env var, which is read at runtime and worked fine.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

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
