const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const WebSocket = require('ws');
const uuid = require('uuid');
const path = require('path');
const cors = require('cors')
const app = express();

// Load SSL certificates
const privateKey = fs.readFileSync('server.key', 'utf8');
const certificate = fs.readFileSync('server.cert', 'utf8');
const credentials = { key: privateKey, cert: certificate };
console.log(privateKey,certificate)
const httpServer = http.createServer(app);
const httpsServer = https.createServer(credentials, app);

const wss = new WebSocket.Server({ server: httpsServer });

const rooms = {}; // { roomId: { password: 'pass', clients: [] } }

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors)
app.post('/create-room', (req, res) => {
  const roomId = uuid.v4();
  const password = req.body.password;
  rooms[roomId] = { password, clients: [] };
  res.json({ roomId });
});

app.post('/join-room', (req, res) => {
  const { roomId, password } = req.body;
  if (rooms[roomId] && rooms[roomId].password === password) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.get('/room/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  if (rooms[roomId]) {
    res.sendFile(path.join(__dirname, 'public', 'room.html'));
  } else {
    res.status(404).send('Room not found');
  }
});

wss.on('connection', (ws, req) => {
  console.log("some device connected");
  ws.on('message', (message) => {
    const { type, roomId, data } = JSON.parse(message);
    console.log(`Received message: ${type} from room: ${roomId}`);
    if (type === 'join') {
      if (rooms[roomId]) {
        rooms[roomId].clients.push(ws);
        ws.roomId = roomId;
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
      }
    } else {
      rooms[ws.roomId].clients.forEach(client => {
        if (client !== ws) {
          client.send(JSON.stringify({ type, data }));
        }
      });
    }
  });

  ws.on('close', () => {
    const room = rooms[ws.roomId];
    if (room) {
      room.clients = room.clients.filter(client => client !== ws);
    }
  });
});

httpServer.listen(3000, '0.0.0.0', () => {
  console.log('HTTP Server is running on port 3000');
});

httpsServer.listen(3443, '0.0.0.0', () => {
  console.log('HTTPS Server is running on port 3443');
});
