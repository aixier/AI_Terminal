# AI Terminal Architecture

## System Architecture Overview

AI Terminal follows a modern microservices architecture with clear separation between frontend, backend, and AI services.

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Vue 3)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Terminal UI │  │Card Generator│  │  Workspace   │      │
│  └─────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   API Gateway      │
                    │  (Express Server)  │
                    └─────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼──────┐    ┌────────▼──────┐    ┌────────▼──────┐
│Terminal Engine│    │Card Generation│    │File Management│
│  (node-pty)   │    │    Service    │    │    Service    │
└───────┬──────┘    └────────┬──────┘    └────────┬──────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   AI Services     │
                    │ Claude | Gemini   │
                    └───────────────────┘
```

## Directory Structure

```
AI_Terminal/
├── terminal-backend/          # Backend server
│   ├── src/
│   │   ├── index.js          # Main server entry
│   │   ├── config/           # Configuration files
│   │   ├── routes/           # API routes
│   │   │   ├── auth.js       # Authentication
│   │   │   ├── terminal.js   # Terminal operations
│   │   │   └── generate/     # Generation APIs
│   │   │       ├── card.js   # Card generation
│   │   │       ├── cardAsync.js  # Async generation
│   │   │       ├── cardStream.js # Stream generation
│   │   │       ├── templates.js  # Template management
│   │   │       └── status.js     # Status tracking
│   │   ├── services/         # Business logic
│   │   │   ├── aiService.js  # AI integration
│   │   │   ├── terminalService.js # Terminal management
│   │   │   └── userService.js    # User management
│   │   ├── middleware/       # Express middleware
│   │   └── utils/           # Utility functions
│   └── data/                # Data storage
│       ├── users/           # User data
│       └── templates/       # Template files
│
└── terminal-ui/             # Frontend application
    ├── src/
    │   ├── main.js          # Vue app entry
    │   ├── router/          # Vue Router
    │   ├── views/           # Page components
    │   │   ├── Home.vue     # Main terminal
    │   │   └── CardGenerator/ # Card generation module
    │   │       ├── CardGenerator.vue
    │   │       ├── components/  # UI components
    │   │       ├── composables/ # Vue composables
    │   │       └── utils/       # Utilities
    │   ├── api/             # API clients
    │   ├── components/      # Shared components
    │   └── styles/          # Global styles
    └── dist/                # Built frontend
```

## Component Architecture

### Backend Components

#### 1. Express Server (`index.js`)
- Handles HTTP requests and WebSocket connections
- Manages middleware pipeline
- Serves static files and API endpoints

#### 2. Route Modules
- **Authentication Routes** (`/api/auth`): User login, token validation
- **Terminal Routes** (`/api/terminal`): Terminal session management
- **Generation Routes** (`/api/generate`): AI-powered content generation
- **Workspace Routes** (`/api/workspace`): File and folder management

#### 3. Service Layer
- **AI Service**: Interfaces with Claude and Gemini APIs
- **Terminal Service**: Manages PTY sessions using node-pty
- **User Service**: Handles user data and authentication
- **Template Service**: Manages template registry and operations

#### 4. Middleware
- **Authentication**: JWT token validation
- **User Context**: Ensures user folders and permissions
- **Error Handling**: Centralized error management
- **CORS**: Cross-origin resource sharing

### Frontend Components

#### 1. Terminal Module
- **XTerm.js Integration**: Terminal emulator
- **WebSocket Client**: Real-time communication
- **Command Handling**: Local and remote command processing

#### 2. Card Generator Module
- **Template Selection**: Quick template buttons
- **Async Generation**: Non-blocking card creation
- **Status Tracking**: Real-time progress updates
- **File Operations**: Download and preview

#### 3. API Client Layer
- **Axios Configuration**: Request/response interceptors
- **Service Modules**: Organized by feature
- **Error Handling**: Unified error management

## Data Flow

### 1. Card Generation Flow

```
User Request → Frontend → API Gateway → Card Service
                                              ↓
                                        Template Engine
                                              ↓
                                        AI Service (Claude/Gemini)
                                              ↓
                                        File Generation
                                              ↓
Frontend ← Status Updates ← WebSocket ← Progress Events
```

### 2. Terminal Session Flow

```
User Input → XTerm.js → WebSocket → Terminal Service
                                           ↓
                                      PTY Process
                                           ↓
                            System Command Execution
                                           ↓
Terminal Display ← WebSocket ← Output Stream
```

### 3. Authentication Flow

```
Login Request → Auth API → User Validation
                               ↓
                          JWT Generation
                               ↓
                    Token Storage (Client)
                               ↓
           Authenticated Requests (Bearer Token)
```

## Key Technologies

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web framework
- **Socket.IO**: Real-time bidirectional communication
- **node-pty**: Pseudo terminal implementation
- **jsonwebtoken**: JWT authentication
- **axios**: HTTP client for AI services

### Frontend
- **Vue 3**: Progressive JavaScript framework
- **Vite**: Build tool and dev server
- **Element Plus**: UI component library
- **XTerm.js**: Terminal emulator
- **Axios**: HTTP client
- **Socket.IO Client**: WebSocket client

### AI Integration
- **Claude API**: Anthropic's AI assistant
- **Gemini API**: Google's AI model
- **Streaming Support**: Server-sent events for real-time responses

## Scalability Considerations

1. **Horizontal Scaling**: Stateless design allows multiple backend instances
2. **Session Management**: Redis-compatible session store ready
3. **File Storage**: Pluggable storage backend (local/S3/cloud)
4. **Load Balancing**: WebSocket sticky sessions support
5. **Caching**: Template and user data caching
6. **Queue System**: Async job processing for heavy operations

## Security Architecture

1. **Authentication**: JWT-based with expiration
2. **Authorization**: Role-based access control ready
3. **Input Validation**: Request sanitization
4. **Rate Limiting**: API throttling support
5. **Secure Storage**: Environment variables for secrets
6. **CORS Policy**: Configurable origin restrictions