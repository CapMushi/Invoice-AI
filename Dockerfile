# Step 1: Base Image - Use Node.js 18 Alpine for smaller image size
# Alpine Linux is a lightweight Linux distribution, making the image smaller
FROM node:18-alpine AS base

# Step 2: Set the working directory inside the container
# This is where your application code will live
WORKDIR /app

# Step 3: Install dependencies
# Copy package files first (for better Docker layer caching)
COPY package.json package-lock.json* ./
# Copy workspace package.json files to ensure all dependencies are installed
COPY apps/*/package.json ./apps/
COPY packages/*/package.json ./packages/
# Install all dependencies (including workspaces)
RUN npm install

# Step 3.5: Copy environment file if it exists
COPY .env* ./

# Step 4: Build Stage - Create the production build
FROM base AS builder
WORKDIR /app
# Copy all source code and ensure proper workspace structure
COPY . .
# Ensure all workspace dependencies are properly linked
RUN npm install

# Step 5: Build the application using Turbo
# This will build all apps in your monorepo
RUN npm run build

# Step 6: Production Stage - Create the final runtime image
FROM base AS runner
WORKDIR /app

# Step 7: Copy static assets (images, fonts, etc.)
COPY --from=builder /app/apps/web/public ./apps/web/public

# Step 8: Set up Next.js standalone output
# Next.js can create a standalone build that includes everything needed to run
RUN mkdir .next

# Step 8.5: Copy environment file to production stage
COPY --from=builder /app/.env* ./

# Step 9: Copy the built application
# Copy the standalone server and static files
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Step 11: Expose the port your app runs on
EXPOSE 3000

# Step 12: Set environment variables
ENV PORT 3000
# Set hostname to allow external connections
ENV HOSTNAME "0.0.0.0"

# Step 13: Start the application
# The server.js file is created by Next.js standalone build
CMD ["node", "apps/web/server.js"] 