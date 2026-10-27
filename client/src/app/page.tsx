'use client';

import React, { useEffect, useState } from 'react';
import { socketService } from '@/lib/socket';
import {
  RoomState,
  RoundResultPayload,
  Coordinates,
} from '../../../shared/types';
import { Globe, Copy, Check, Users, Play, MapPin, Trophy } from 'lucide-react';

export default function GeoDuelApp() {
  const [username, setUsername] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResultPayload | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [mySocketId, setMySocketId] = useState<string>('');
  const [selectedCoords, setSelectedCoords] = useState<Coordinates | null>(null);

  useEffect(() => {
    const socket = socketService.connect();

    socket.on('connect', () => {
      setMySocketId(socket.id || '');
    });

    socket.on('room_updated', (updatedRoom: RoomState) => {
      setRoom({ ...updatedRoom });
    });

    socket.on('round_started', (updatedRoom: RoomState) => {
      setRoundResults(null);
      setSelectedCoords(null);
      setRoom({ ...updatedRoom });
    });

    socket.on('player_locked_in', ({ playerId }: { playerId: string }) => {
      setRoom((prev) => {
        if (!prev || !prev.players[playerId]) return prev;
        return {
          ...prev,
          players: {
            ...prev.players,
            [playerId]: { ...prev.players[playerId], hasLockedIn: true },
          },
        };
      });
    });

    socket.on('round_results', ({ roomState, results }: { roomState: RoomState; results: RoundResultPayload }) => {
      setRoom({ ...roomState });
      setRoundResults(results);
    });

    socket.on('player_left', ({ roomState }: { roomState: RoomState }) => {
      setRoom({ ...roomState });
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleCreateRoom = () => {
    if (!username.trim()) return setError('Please enter a username first!');
    setError('');
    const socket = socketService.connect();
    socket.emit('create_room', { username }, (res: { success: boolean; roomState?: RoomState; error?: string }) => {
      if (res.success && res.roomState) {
        setRoom(res.roomState);
        setMySocketId(socket.id || '');
      } else {
        setError(res.error || 'Failed to create room');
      }
    });
  };

  const handleJoinRoom = () => {
    if (!username.trim()) return setError('Please enter a username first!');
    if (!joinCode.trim()) return setError('Please enter a 6-digit room code!');
    setError('');
    const socket = socketService.connect();
    socket.emit('join_room', { roomId: joinCode, username }, (res: { success: boolean; roomState?: RoomState; error?: string }) => {
      if (res.success && res.roomState) {
        setRoom(res.roomState);
        setMySocketId(socket.id || '');
      } else {
        setError(res.error || 'Failed to join room');
      }
    });
  };

  const handleStartRound = () => {
    if (!room) return;
    socketService.getSocket()?.emit('start_round', { roomId: room.roomId });
  };

  const handleLockGuess = () => {
    if (!room || !selectedCoords) return;
    socketService.getSocket()?.emit('submit_guess', {
      roomId: room.roomId,
      coords: selectedCoords,
    });
  };

  const copyRoomCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!room) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Globe className="w-10 h-10 text-emerald-400 animate-pulse" />
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              GeoDuel 1v1
            </h1>
          </div>

          <p className="text-slate-400 text-center text-sm mb-6">
            Real-time multiplayer street-view location battles.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                Your Gamer Tag
              </label>
              <input
                type="text"
                placeholder="e.g., Shashank"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 text-white"
              />
            </div>

            <button
              onClick={handleCreateRoom}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              Create 1v1 Lobby
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-slate-500 text-xs uppercase">or join friend</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="6-Digit Code"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl uppercase tracking-widest font-mono text-center focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleJoinRoom}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl transition cursor-pointer"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const playersList = Object.values(room.players);
  const me = room.players[mySocketId];

  if (room.status === 'WAITING') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold uppercase tracking-wider">
            1v1 Waiting Lobby
          </span>

          <h2 className="text-xl text-slate-400 mt-4">Share this invite code with your friend:</h2>

          <div className="my-4 flex items-center justify-center gap-3">
            <span className="text-4xl font-mono font-extrabold tracking-widest bg-slate-950 px-6 py-3 rounded-xl border border-slate-800 text-emerald-400">
              {room.roomId}
            </span>
            <button
              onClick={copyRoomCode}
              className="p-4 bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
              title="Copy Invite Code"
            >
              {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-slate-300" />}
            </button>
          </div>

          <div className="mt-8 space-y-3 text-left">
            <div className="text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4" /> Players Connected ({playersList.length}/2)
            </div>

            {playersList.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                  <span className="font-semibold">{p.username}</span>
                  {p.id === mySocketId && (
                    <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">You</span>
                  )}
                </div>
                <span className="text-xs text-slate-500">Player {idx + 1}</span>
              </div>
            ))}

            {playersList.length < 2 && (
              <div className="p-4 bg-slate-950/50 border border-dashed border-slate-800 rounded-xl text-slate-500 text-center text-sm">
                Waiting for Opponent to join...
              </div>
            )}
          </div>

          <button
            onClick={handleStartRound}
            disabled={playersList.length < 2}
            className="mt-8 w-full py-4 bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition cursor-pointer disabled:cursor-not-allowed"
          >
            {playersList.length < 2 ? 'Waiting for 2nd Player...' : 'Start 1v1 Duel!'}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col p-6">
      <header className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-6 py-4 mb-6">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-emerald-400" />
          <span className="font-bold text-lg">Room: {room.roomId}</span>
          <span className="px-3 py-1 bg-slate-800 rounded-lg text-sm font-mono text-emerald-400">
            Round {room.currentRound} / {room.maxRounds}
          </span>
        </div>

        <div className="flex items-center gap-6">
          {playersList.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="text-sm text-slate-300 font-medium">{p.username}:</span>
              <span className="font-mono font-bold text-emerald-400">{p.score} pts</span>
              {p.hasLockedIn && room.status === 'IN_PROGRESS' && (
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                  Locked In ✓
                </span>
              )}
            </div>
          ))}
        </div>
      </header>

      {room.status === 'IN_PROGRESS' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <MapPin className="w-12 h-12 text-emerald-400 mb-3" />
            <h3 className="text-xl font-bold mb-2">360° Street View Container</h3>
            <p className="text-slate-400 text-sm mb-4">
              Mapillary Panorama Image ID: <code className="text-emerald-400">{room.currentImageId}</code>
            </p>
            <p className="text-xs text-slate-500 max-w-md">
              (Notice in DevTools Network tab: the server ONLY sent the Image ID—the true lat/lng coordinates are hidden on the server!)
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">Simulate Pin Drop (Test Game Loop)</h3>
              <p className="text-slate-400 text-sm mb-6">
                Pick a test city below to verify our WebSocket lock-in & Haversine distance engine before we mount the full-screen MapLibre canvas:
              </p>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: 'Paris Guess', coords: { lat: 48.85, lng: 2.30 } },
                  { name: 'Tokyo Guess', coords: { lat: 35.68, lng: 139.76 } },
                  { name: 'New York Guess', coords: { lat: 40.71, lng: -74.00 } },
                  { name: 'Mumbai Guess', coords: { lat: 19.07, lng: 72.87 } },
                ].map((city) => (
                  <button
                    key={city.name}
                    onClick={() => setSelectedCoords(city.coords)}
                    disabled={me?.hasLockedIn}
                    className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                      selectedCoords?.lat === city.coords.lat
                        ? 'bg-emerald-500/20 border-emerald-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold">{city.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-1">
                      {city.coords.lat}, {city.coords.lng}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleLockGuess}
              disabled={!selectedCoords || me?.hasLockedIn}
              className="mt-6 w-full py-4 bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition cursor-pointer"
            >
              {me?.hasLockedIn ? 'Waiting for Opponent to Lock In...' : 'Lock In Guess'}
            </button>
          </div>
        </div>
      )}

      {room.status === 'ROUND_END' && roundResults && (
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
          <Trophy className="w-12 h-12 text-amber-400 mb-3" />
          <h2 className="text-2xl font-extrabold mb-1">Round {roundResults.roundNumber} Results</h2>
          <p className="text-slate-400 text-sm mb-6 font-mono">
            True Location: {roundResults.actualCoords.lat}, {roundResults.actualCoords.lng}
          </p>

          <div className="w-full space-y-3 mb-8">
            {roundResults.playerResults.map((res) => (
              <div
                key={res.playerId}
                className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl"
              >
                <div>
                  <div className="font-bold text-lg">{res.username}</div>
                  <div className="text-xs text-slate-400">
                    Distance off: <span className="text-amber-400 font-mono">{res.distanceKm} km</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-emerald-400 font-mono font-bold text-lg">
                    +{res.pointsEarned} pts
                  </div>
                  <div className="text-xs text-slate-500 font-mono">Total: {res.totalScore} pts</div>
                </div>
              </div>
            ))}
          </div>

          {room.currentRound < room.maxRounds ? (
            <button
              onClick={handleStartRound}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition cursor-pointer"
            >
              Start Round {room.currentRound + 1} →
            </button>
          ) : (
            <div className="text-center">
              <div className="text-xl font-bold text-amber-400 mb-4">🎉 Match Complete!</div>
              <button
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold cursor-pointer"
              >
                Play Another Duel
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
