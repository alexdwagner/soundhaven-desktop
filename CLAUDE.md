# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

SoundHaven is a desktop music player built with Electron that consists of three main components:

- **Frontend**: Next.js React application with TypeScript, located in `frontend/`
- **Main Process**: Electron main process with Express server for audio streaming, located in `main/`
- **Shared**: Common types and DTOs shared between frontend and main, located in `shared/`

The application uses a monorepo structure with Yarn workspaces. The frontend communicates with the main process via Electron IPC and HTTP requests to the embedded Express server.

## Key Technologies

- **Frontend**: Next.js 15, React 19, TypeScript, TailwindCSS, WaveSurfer.js for audio visualization
- **Main Process**: Electron, Express, SQLite3, TypeScript
- **Audio**: WaveSurfer.js for waveform visualization and playback controls
- **Drag & Drop**: @dnd-kit for playlist management
- **Authentication**: JWT-based auth with bcryptjs

## Development Commands

### Starting Development
```bash
# Start both frontend and electron in development mode. ALWAYS use this to start the application and servers.
yarn dev

# Clean restart (kills ports and restarts)
yarn dev:clean

# Kill electron processes
yarn kill

# Clean up ports
yarn cleanup
```

### Building
```bash
# Build the entire application
yarn build

# Build frontend only
yarn build:frontend

# Build electron main process only
yarn build:electron
```

### Testing and Linting
```bash
# Run tests
yarn test

# Lint frontend code
cd frontend && yarn lint
```

### Database Operations
```bash
# Run database migrations
yarn db:migrate

# Preprocess migration (for schema changes)
yarn preprocess-migrate

# Set up/reset database
cd main && yarn setup-db
```

## Database Architecture

- Uses SQLite3 with raw SQL queries (no ORM)
- Database file located at `main/db.sqlite`
- Schema migrations in `main/src/migrations/`
- Key tables: users, tracks, playlists, comments, markers, tags

## Audio System

- Audio files stored in `main/uploads/`
- Chunked audio streaming for efficient playback
- WaveSurfer.js handles waveform visualization and playback controls
- Comments can be attached to specific time markers on tracks

## Key Components

### Frontend Structure
- `src/app/components/audioPlayer/` - Audio playback and visualization components
- `src/app/components/tracks/` - Track management and table display
- `src/app/components/playlists/` - Playlist management with drag & drop
- `src/app/contexts/` - React contexts for state management
- `src/app/providers/` - Context providers for global state

### Main Process Structure
- `src/main.ts` - Electron main process entry point (large file, 27k+ tokens)
- `src/audioServer.ts` - Express server for audio streaming
- `src/services/` - Business logic services (metadata, file management, sync)
- `ipcHandlers/` - Electron IPC message handlers

## Mobile/PWA Support

The application includes mobile support with PWA capabilities:
- Mobile-specific audio player components in `frontend/src/app/components/audioPlayer/Mobile*`
- Responsive design with TailwindCSS
- Mobile audio streaming architecture

## Port Configuration

- Frontend development: Port 3001 (configurable via FRONTEND_PORT env var)
- Production frontend: Port 3000
- Electron app manages its own port allocation
- See `PORT_CONFIGURATION.md` for details

## File Upload and Metadata

- Audio files uploaded to `main/uploads/`
- Album art stored in `main/uploads/album-art/`
- Automatic metadata extraction using `music-metadata` library
- Preprocessing service handles file analysis and chunking

## Testing

- Jest configuration for unit tests
- Test files in `__tests__/` directory
- Focus on testing Electron API services and core functionality