export type GameStatus = 'WAITING' | 'IN_PROGRESS' | 'ROUND_END' | 'FINISHED';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Player {
  id: string;          // Socket ID
  username: string;
  score: number;
  currentGuess: Coordinates | null;
  hasLockedIn: boolean;
}

export interface RoundLocation {
  imageId: string;     // Mapillary 360 panorama ID
  actualCoords: Coordinates; // Kept secret on server until round ends!
}

export interface RoomState {
  roomId: string;
  status: GameStatus;
  currentRound: number;
  maxRounds: number;
  roundEndTime: number | null; // Unix timestamp (ms) for synchronized countdown
  players: Record<string, Player>;
  currentImageId: string | null; // Safe to send to client
}

export interface RoundResultPayload {
  roundNumber: number;
  actualCoords: Coordinates;
  playerResults: {
    playerId: string;
    username: string;
    guessCoords: Coordinates | null;
    distanceKm: number | null;
    pointsEarned: number;
    totalScore: number;
  }[];
}