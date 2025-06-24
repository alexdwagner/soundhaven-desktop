# Port Configuration Guide

This document explains how to configure ports for the SoundHaven desktop application.

## Current Port Setup

- **Audio Server (Express/Electron backend)**: Port 3000
- **Frontend (Next.js)**: Port 3001
- **Electron Main Process**: Uses frontend port to load the app

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Port Configuration
FRONTEND_PORT=3001
AUDIO_SERVER_PORT=3000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

# Database Configuration
DATABASE_PATH=/absolute/path/to/your/project/main/db.sqlite

# Environment
NODE_ENV=development
```

## Configuration Files

### 1. Main Process Configuration (`main/src/config.ts`)
The main process uses these environment variables to configure ports:
- `FRONTEND_PORT`: Port for the Next.js frontend (default: 3001)
- `AUDIO_SERVER_PORT`: Port for the audio server (default: 3000)

### 2. Audio Server (`main/src/audioServer.ts`)
The audio server now uses `config.audioServerPort` instead of hardcoded port 3001.

### 3. Electron Main Process (`main/src/main.ts`)
The main process uses `config.frontendPort` to load the frontend in development mode.

### 4. Next.js Configuration (`frontend/next.config.ts`)
The frontend proxy configuration uses `AUDIO_SERVER_PORT` environment variable to route audio requests to the correct port.

## Changing Ports

To change the ports:

1. **Set environment variables** in your `.env` file:
   ```env
   FRONTEND_PORT=3000
   AUDIO_SERVER_PORT=3002
   ```

2. **Restart the application** for changes to take effect.

## Port Conflicts

If you encounter port conflicts:

1. Check which ports are in use:
   ```bash
   lsof -i :3000
   lsof -i :3001
   ```

2. Change the ports in your `.env` file to available ports.

3. Make sure the `AUDIO_SERVER_PORT` in your `.env` file matches the port used in the Next.js proxy configuration.

## Development vs Production

- **Development**: Uses environment variables for flexible port configuration
- **Production**: Uses default ports unless overridden by environment variables

## Troubleshooting

1. **Port already in use**: Change the port in your `.env` file
2. **Audio not loading**: Ensure `AUDIO_SERVER_PORT` matches between main process and Next.js config
3. **Frontend not loading**: Check that `FRONTEND_PORT` is available and matches your Next.js dev server 