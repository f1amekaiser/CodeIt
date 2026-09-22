# CodeIt

CodeIt is a browser-based Python coding environment built for quick experimentation, collaboration, and learning. It combines a Monaco-powered code editor, live terminal output, room-based syncing, and a Node.js backend that executes Python in isolated temporary session folders.

## Architecture

The project is split into two main parts:

- Frontend: React app in the React/myapp folder
- Backend: Express + Socket.IO server in the React/server folder

### High-level flow

1. The frontend renders the editor, sidebar, labels, room controls, and terminal UI.
2. Users authenticate and join rooms through the backend API.
3. Code changes are synchronized in real time between clients in the same room.
4. When the user clicks Run, the backend writes the code to a temporary file and executes it.
5. stdout/stderr is streamed back to the browser terminal.
6. Room permissions, labels, and collaborative state are managed by the backend.

## Project structure

```text
CodeIt/
├── README.md
├── React/
│   ├── package.json
│   ├── README.md
│   ├── myapp/                 # Frontend React app
│   │   ├── public/
│   │   └── src/
│   │       ├── App.js
│   │       ├── components/
│   │       └── index.js
│   └── server/               # Backend API and sockets
│       ├── auth.js
│       ├── db.js
│       ├── rooms.js
│       ├── server.js
│       └── temp/
└── ...
```

## Frontend responsibilities

The React app handles:

- editor state and file management
- authentication flow
- room join/create actions
- live socket synchronization
- terminal input/output display
- labels and room configuration UI

Key frontend files:

- React/myapp/src/App.js
- React/myapp/src/components/codeEditor.js
- React/myapp/src/components/Terminal.js
- React/myapp/src/components/Sidebar.js
- React/myapp/src/components/RoomManagement.js

## Backend responsibilities

The backend handles:

- user auth with JWT
- room membership and permissions
- socket-based collaboration
- Python execution and output streaming
- room labels and metadata persistence

Key backend files:

- React/server/server.js
- React/server/auth.js
- React/server/rooms.js
- React/server/db.js

## Getting started

### 1. Install backend dependencies

```bash
cd React/server
npm install
```

### 2. Install frontend dependencies

```bash
cd ../myapp
npm install
```

### 3. Run the backend

```bash
cd React/server
npm start
```

### 4. Run the frontend

```bash
cd React/myapp
npm start
```

## Runtime flow

When a user runs Python code:

1. The frontend emits the current file content to the backend.
2. The server sanitizes the filename and creates a temporary session folder.
3. The file is saved inside that folder.
4. The configured Python interpreter executes it.
5. stdout/stderr is sent back over the socket connection.
6. The terminal renders output in real time.

## Notes

- A valid PostgreSQL connection is needed for room and auth data.
- Python must be available on the machine PATH for execution to work.
- The system is designed for lightweight collaborative coding rather than heavy production-scale workloads.

## Typical use cases

- Python learning and experimentation
- quick classroom-style coding sessions
- teamwork in shared rooms
- debugging code with terminal feedback

