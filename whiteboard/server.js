const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 5e6
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── In-memory room state ─────────────────────────────────────────────────────
const rooms = new Map();
// room: { id, name, elements: [], history: [], historyIndex: -1, users: Map<socketId, user> }

function getOrCreateRoom(roomId, roomName = 'Untitled Board') {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      name: roomName,
      elements: [],
      history: [[]],
      historyIndex: 0,
      users: new Map()
    });
  }
  return rooms.get(roomId);
}

// ── REST API ─────────────────────────────────────────────────────────────────
app.get('/api/room/:id', (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ id: room.id, name: room.name, elements: room.elements, userCount: room.users.size });
});

app.post('/api/room', (req, res) => {
  const id = uuidv4().slice(0, 8).toUpperCase();
  const name = req.body.name || 'Untitled Board';
  getOrCreateRoom(id, name);
  res.json({ id, name });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Socket.io ────────────────────────────────────────────────────────────────
const CURSOR_COLORS = [
  '#6366F1','#EC4899','#10B981','#F59E0B','#3B82F6','#EF4444','#8B5CF6','#14B8A6'
];

io.on('connection', (socket) => {

  // JOIN ROOM
  socket.on('join-room', ({ roomId, userName }) => {
    const room = getOrCreateRoom(roomId);
    const colorIndex = room.users.size % CURSOR_COLORS.length;
    const user = {
      id: socket.id,
      name: userName || 'Guest',
      color: CURSOR_COLORS[colorIndex],
      cursor: { x: 0, y: 0 }
    };
    room.users.set(socket.id, user);
    socket.join(roomId);
    socket.roomId = roomId;

    // Send current state to joining user
    socket.emit('room-state', {
      elements: room.elements,
      users: Array.from(room.users.values()),
      roomName: room.name,
      historyIndex: room.historyIndex,
      historyLength: room.history.length
    });

    // Notify others
    socket.to(roomId).emit('user-joined', user);
    io.to(roomId).emit('users-update', Array.from(room.users.values()));
  });

  // CURSOR MOVE
  socket.on('cursor-move', ({ x, y }) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const user = room.users.get(socket.id);
    if (!user) return;
    user.cursor = { x, y };
    socket.to(roomId).emit('cursor-update', { userId: socket.id, x, y, color: user.color, name: user.name });
  });

  // DRAW ELEMENT (add/update)
  socket.on('element-update', (element) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const idx = room.elements.findIndex(e => e.id === element.id);
    if (idx !== -1) {
      room.elements[idx] = element;
    } else {
      room.elements.push(element);
    }
    socket.to(roomId).emit('element-update', element);
  });

  // ELEMENT DONE (commit to history)
  socket.on('element-commit', (element) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const idx = room.elements.findIndex(e => e.id === element.id);
    if (idx !== -1) room.elements[idx] = element;
    else room.elements.push(element);

    // Truncate redo history
    room.history = room.history.slice(0, room.historyIndex + 1);
    room.history.push(JSON.parse(JSON.stringify(room.elements)));
    room.historyIndex = room.history.length - 1;

    io.to(roomId).emit('element-commit', element);
    io.to(roomId).emit('history-state', { historyIndex: room.historyIndex, historyLength: room.history.length });
  });

  // DELETE ELEMENT
  socket.on('element-delete', (elementId) => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    room.elements = room.elements.filter(e => e.id !== elementId);
    room.history = room.history.slice(0, room.historyIndex + 1);
    room.history.push(JSON.parse(JSON.stringify(room.elements)));
    room.historyIndex = room.history.length - 1;

    io.to(roomId).emit('element-delete', elementId);
    io.to(roomId).emit('history-state', { historyIndex: room.historyIndex, historyLength: room.history.length });
  });

  // UNDO
  socket.on('undo', () => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.historyIndex <= 0) return;
    room.historyIndex--;
    room.elements = JSON.parse(JSON.stringify(room.history[room.historyIndex]));
    io.to(roomId).emit('elements-replace', room.elements);
    io.to(roomId).emit('history-state', { historyIndex: room.historyIndex, historyLength: room.history.length });
  });

  // REDO
  socket.on('redo', () => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.historyIndex >= room.history.length - 1) return;
    room.historyIndex++;
    room.elements = JSON.parse(JSON.stringify(room.history[room.historyIndex]));
    io.to(roomId).emit('elements-replace', room.elements);
    io.to(roomId).emit('history-state', { historyIndex: room.historyIndex, historyLength: room.history.length });
  });

  // CLEAR BOARD
  socket.on('clear-board', () => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.elements = [];
    room.history = room.history.slice(0, room.historyIndex + 1);
    room.history.push([]);
    room.historyIndex = room.history.length - 1;
    io.to(roomId).emit('elements-replace', []);
    io.to(roomId).emit('history-state', { historyIndex: room.historyIndex, historyLength: room.history.length });
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.users.delete(socket.id);
    socket.to(roomId).emit('user-left', socket.id);
    io.to(roomId).emit('users-update', Array.from(room.users.values()));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Whiteboard server running on http://localhost:${PORT}`));
