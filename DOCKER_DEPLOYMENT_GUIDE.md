# Docker Deployment Guide for Invoice Bot

This guide will walk you through deploying your invoice-bot application using Docker. Each step is explained in detail for beginners.

## What is Docker?

Docker is a platform that allows you to package your application and all its dependencies into a standardized unit called a **container**. Think of it like a shipping container - it contains everything your application needs to run, regardless of where it's deployed.

## Prerequisites

Before starting, make sure you have:
1. **Docker Desktop** installed on your machine
   - Download from: https://www.docker.com/products/docker-desktop/
2. **Git** (to clone your repository)
3. Your application code (which you already have)

## Step-by-Step Deployment Process

### Step 1: Understanding Your Docker Configuration

Your project has two important Docker files:

#### Dockerfile
- **Purpose**: Instructions for building your application container
- **What it does**: 
  - Uses Node.js 18 with Alpine Linux (lightweight)
  - Installs dependencies
  - Builds your application
  - Creates a production-ready container

#### docker-compose.yml
- **Purpose**: Defines how to run your application
- **What it does**:
  - Maps port 3000 from your computer to port 3000 in the container
  - Sets environment variables
  - Configures restart behavior

### Step 2: Prepare Your Environment Variables

Your application likely needs API keys and secrets. Create a `.env` file in your project root:

```bash
# Create environment file
touch .env
```

Add your environment variables to `.env`:
```env
OPENAI_API_KEY=your_openai_api_key_here
QUICKBOOKS_CLIENT_ID=your_quickbooks_client_id
QUICKBOOKS_CLIENT_SECRET=your_quickbooks_client_secret
```

### Step 3: Build and Run Your Application

#### Option A: Using Docker Compose (Recommended for beginners)

1. **Open your terminal** and navigate to your project directory:
   ```bash
   cd /path/to/your/invoice-bot
   ```

2. **Build and start your application**:
   ```bash
   docker-compose up --build
   ```

   **What this command does**:
   - `docker-compose up`: Starts your application
   - `--build`: Forces Docker to rebuild the image (ensures latest code)

3. **Check if it's running**:
   - Open your browser and go to: `http://localhost:3000`
   - You should see your invoice bot application

#### Option B: Using Docker Commands Directly

1. **Build the Docker image**:
   ```bash
   docker build -t invoice-bot .
   ```
   - `-t invoice-bot`: Tags your image with the name "invoice-bot"
   - `.`: Uses the Dockerfile in the current directory

2. **Run the container**:
   ```bash
   docker run -p 3000:3000 --env-file .env invoice-bot
   ```
   - `-p 3000:3000`: Maps port 3000 from your computer to the container
   - `--env-file .env`: Loads environment variables from your .env file

### Step 4: Understanding What's Happening

When you run `docker-compose up --build`, Docker:

1. **Reads the Dockerfile** and follows the instructions step by step
2. **Downloads the base image** (Node.js 18 Alpine)
3. **Copies your code** into the container
4. **Installs dependencies** using `npm install`
5. **Builds your application** using `npm run build`
6. **Creates a production image** with only the necessary files
7. **Starts your application** on port 3000

### Step 5: Useful Docker Commands

#### View running containers:
```bash
docker ps
```

#### View logs:
```bash
docker-compose logs
```

#### Stop the application:
```bash
docker-compose down
```

#### Rebuild and restart:
```bash
docker-compose up --build
```

#### View container details:
```bash
docker inspect invoice-bot
```

### Step 6: Troubleshooting Common Issues

#### Issue: "Port already in use"
**Solution**: Stop any existing containers or change the port in docker-compose.yml
```bash
docker-compose down
```

#### Issue: "Build failed"
**Solution**: Check your Dockerfile and ensure all dependencies are correct
```bash
docker-compose build --no-cache
```

#### Issue: "Environment variables not working"
**Solution**: Make sure your .env file is in the project root and properly formatted

### Step 7: Production Deployment

For production deployment, you might want to:

1. **Use a .dockerignore file** to exclude unnecessary files:
   ```bash
   touch .dockerignore
   ```
   
   Add to .dockerignore:
   ```
   node_modules
   .git
   .env.local
   .next
   ```

2. **Set up environment variables** properly for production
3. **Use a reverse proxy** like Nginx for better performance
4. **Set up monitoring** and logging

### Step 8: Understanding Docker Concepts

#### Images vs Containers
- **Image**: A template/blueprint (like a class in programming)
- **Container**: A running instance of an image (like an object)

#### Docker Layers
Each instruction in your Dockerfile creates a layer. Docker caches these layers for faster builds.

#### Multi-stage Builds
Your Dockerfile uses multiple stages:
- `base`: Sets up the environment
- `builder`: Builds your application
- `runner`: Creates the final production image

This approach keeps the final image smaller and more secure.

## Next Steps

1. **Test your deployment** thoroughly
2. **Set up CI/CD** for automated deployments
3. **Configure monitoring** and logging
4. **Set up SSL certificates** for HTTPS
5. **Configure backups** for your data

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)

## Need Help?

If you encounter issues:
1. Check the Docker logs: `docker-compose logs`
2. Verify your environment variables
3. Ensure all dependencies are properly installed
4. Check that your Next.js configuration is correct

Your application should now be running successfully in a Docker container! 🐳 