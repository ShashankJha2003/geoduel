import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  RoomState,
  Coordinates,
  RoundLocation,
  RoundResultPayload,
} from '../../shared/types';
import {
  calculateHaversineDistance,
  calculateScore,
  generateRoomCode,
  STARTER_LOCATIONS,
} from './gameUtils';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // We will restrict this to our Vercel URL in production
    methods: ['GET', 'POST'],
  },
});

// Server-side memory store: Room State + Secret Round Coordinates
const rooms = new Map<string, RoomState>();
const roomSecrets = new Map<string, RoundLocation[]>();

// Health check endpoint for Render/Koyeb deployment
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', activeRooms: rooms.size });
});

io.on('connection', (socket) => {
  console.log(`⚡ Client connected: ${socket.id}`);

  // 1. CREATE 1v1 LOBBY
  socket.on('create_room', ({ username }: { username: string }, callback) => {
    const roomId = generateRoomCode();

    const initialRoomState: RoomState = {
      roomId,
      status: 'WAITING',
      currentRound: 0,
      maxRounds: 5,
      roundEndTime: null,
      currentImageId: null,
      players: {
        [socket.id]: {
          id: socket.id,
          username: username || 'Player 1',
          score: 0,
          currentGuess: null,
          hasLockedIn: false,
        },
      },
    };

    rooms.set(roomId, initialRoomState);
    roomSecrets.set(roomId, [...STARTER_LOCATIONS]);
    socket.join(roomId);

    console.log(`🏠 Room ${roomId} created by ${username}`);
    callback({ success: true, roomId, roomState: initialRoomState });
  });

  // 2. JOIN 1v1 LOBBY
  socket.on('join_room', ({ roomId, username }: { roomId: string; username: string }, callback) => {
    const cleanCode = roomId.trim().toUpperCase();
    const room = rooms.get(cleanCode);

    if (!room) {
      return callback({ success: false, error: 'Lobby not found.' });
    }
    if (Object.keys(room.players).length >= 2) {
      return callback({ success: false, error: 'Lobby is already full (1v1 max).' });
    }
    if (room.status !== 'WAITING') {
      return callback({ success: false, error: 'Match already in progress.' });
    }

    room.players[socket.id] = {
      id: socket.id,
      username: username || 'Player 2',
      score: 0,
      currentGuess: null,
      hasLockedIn: false,
    };

    socket.join(cleanCode);
    io.to(cleanCode).emit('room_updated', room);
    console.log(`🤝 ${username} joined room ${cleanCode}`);
    callback({ success: true, roomState: room });
  });

  // 3. START MATCH / NEXT ROUND
  socket.on('start_round', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    const locations = roomSecrets.get(roomId);
    if (!room || !locations) return;

    room.currentRound += 1;
    room.status = 'IN_PROGRESS';
    room.roundEndTime = Date.now() + 60 * 1000; // 60-second round timer

    // Reset player guess states for the new round
    Object.values(room.players).forEach((p) => {
      p.currentGuess = null;
      p.hasLockedIn = false;
    });

    // Send ONLY the imageId to clients (keep actualCoords secret on server)
    const roundLocation = locations[room.currentRound - 1];
    room.currentImageId = roundLocation.imageId;

    io.to(roomId).emit('round_started', room);
  });

  // 4. LOCK IN GUESS
  socket.on('submit_guess', ({ roomId, coords }: { roomId: string; coords: Coordinates }) => {
    const room = rooms.get(roomId);
    const locations = roomSecrets.get(roomId);
    if (!room || !locations || room.status !== 'IN_PROGRESS') return;

    const player = room.players[socket.id];
    if (!player || player.hasLockedIn) return;

    player.currentGuess = coords;
    player.hasLockedIn = true;

    // Notify opponent that this player locked in (without revealing their coordinates!)
    io.to(roomId).emit('player_locked_in', { playerId: socket.id });

    // Check if ALL players in the room have locked in
    const allLocked = Object.values(room.players).every((p) => p.hasLockedIn);
    if (allLocked) {
      room.status = 'ROUND_END';
      const actualCoords = locations[room.currentRound - 1].actualCoords;

      const playerResults = Object.values(room.players).map((p) => {
        if (!p.currentGuess) {
          return {
            playerId: p.id,
            username: p.username,
            guessCoords: null,
            distanceKm: null,
            pointsEarned: 0,
            totalScore: p.score,
          };
        }
        const distanceKm = calculateHaversineDistance(actualCoords, p.currentGuess);
        const pointsEarned = calculateScore(distanceKm);
        p.score += pointsEarned;

        return {
          playerId: p.id,
          username: p.username,
          guessCoords: p.currentGuess,
          distanceKm,
          pointsEarned,
          totalScore: p.score,
        };
      });

      const resultPayload: RoundResultPayload = {
        roundNumber: room.currentRound,
        actualCoords,
        playerResults,
      };

      io.to(roomId).emit('round_results', { roomState: room, results: resultPayload });
    }
  });

  // 5. HANDLE DISCONNECT
  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        if (Object.keys(room.players).length === 0) {
          rooms.delete(roomId);
          roomSecrets.delete(roomId);
        } else {
          io.to(roomId).emit('player_left', { playerId: socket.id, roomState: room });
        }
      }
    });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 GeoDuel WebSocket Server running on http://localhost:${PORT}`);
});