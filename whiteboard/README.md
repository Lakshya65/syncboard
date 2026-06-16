# ✦ Syncboard — Real-Time Collaborative Whiteboard

> A production-grade multiplayer whiteboard built with Node.js, Socket.io, and the HTML5 Canvas API. Multiple users can draw, annotate, and collaborate on a shared infinite canvas in real time — like a lightweight Figma / Miro.

![Tech Stack](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat&logo=socket.io)
![Canvas API](https://img.shields.io/badge/Canvas_API-HTML5-E34F26?style=flat&logo=html5)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 🚀 Features

- **Real-time multi-user collaboration** — live cursors with name tags for every user
- **Drawing tools** — Pen, Line, Arrow, Rectangle, Circle, Text, Sticky Notes, Eraser, Select
- **Pan & Zoom** — infinite canvas with mouse wheel zoom and drag-to-pan
- **Undo / Redo** — full server-side history synced across all users
- **Color picker** — 7 preset colors + custom color input
- **Stroke sizes** — S / M / L / XL
- **Fill toggle** — hollow or filled shapes
- **Sticky notes** — 5 color variants with corner fold effect
- **Room system** — create or join rooms via 8-character code
- **Export** — download board as PNG
- **Keyboard shortcuts** — V, P, L, R, C, A, T, S, E, Space, Ctrl+Z, Ctrl+Y, Delete

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Web Framework | Express.js |
| Real-time | Socket.io (WebSockets) |
| Frontend | Vanilla JS + HTML5 Canvas API |
| Styling | Pure CSS (no framework) |
| Deployment | Any Node.js host (Railway, Render, Vercel) |

---

## 📦 Getting Started

```bash
# Clone the repo
git clone https://github.com/Lakshya65/syncboard.git
cd syncboard

# Install dependencies
npm install

# Start the server
npm start

# Open in browser
http://localhost:3000
```

---

## 🏗 Architecture

```
syncboard/
├── server.js          # Express + Socket.io server
│   ├── Room state management (in-memory)
│   ├── WebSocket event handlers
│   ├── Undo/redo history per room
│   └── REST API for room creation
├── public/
│   └── index.html     # Full frontend (Canvas + UI)
│       ├── Landing screen (create/join room)
│       ├── Toolbar with all tools
│       ├── Canvas renderer
│       ├── Cursor overlay layer
│       └── Socket.io client
└── package.json
```

### Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join-room` | Client → Server | Join or create a room |
| `room-state` | Server → Client | Full board state on join |
| `cursor-move` | Client → Server | Broadcast cursor position |
| `cursor-update` | Server → Client | Other users' cursor positions |
| `element-update` | Bidirectional | Live drawing preview |
| `element-commit` | Bidirectional | Finalize drawn element |
| `element-delete` | Bidirectional | Delete element |
| `elements-replace` | Server → Client | After undo/redo/clear |
| `undo` / `redo` | Client → Server | History navigation |
| `clear-board` | Client → Server | Clear all elements |

---

## 🌐 Deploy to Railway (Free)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

---

## 📸 Screenshots

> Create a board → Share the 8-character room code → Collaborate live

---

## 🧠 Key Engineering Decisions

- **Server-side history** — Undo/redo is managed on the server so all clients stay in sync. Client-only undo would cause state divergence.
- **Dual canvas layers** — `mainCanvas` renders elements, `cursorCanvas` (pointer-events: none) renders remote cursors. This avoids re-rendering the board on every cursor move.
- **Smooth pen strokes** — Quadratic bezier curves between midpoints of consecutive pen points produce smooth curves instead of jagged polylines.
- **Room state in-memory** — Suitable for demo; production would use Redis for persistence across server restarts.

---

## 📄 License

MIT © Lakshya Jangid
