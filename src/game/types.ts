import type { ApiEndpoint, ApiResponse, ApiError } from '../api/types';

export interface Position {
  x: number;
  y: number;
}

export interface Room {
  id: string;
  position: Position;
  endpoint: ApiEndpoint;
  visited: boolean;
  hasUrnPiece: boolean;
  monster?: Monster;
}

export interface Monster {
  type: 'ghost' | 'demon' | 'zombie' | 'vampire' | 'wraith';
  position: Position;
  errorCode: number | 'timeout';
  active: boolean;
  speed: number;
}

export interface Player {
  position: Position;
  velocity: Position;
  currentRoom: string | null;
  urnPieces: number;
  flashlightOn: boolean;
  lives: number;
  invincible: boolean;
  invincibleUntil: number;
  powerUp: PowerUp | null;
  combo: number;
  lastCollectTime: number;
}

export type PowerUp = 'speed' | 'shield' | 'freeze' | 'reveal';

export interface GameState {
  player: Player;
  rooms: Room[];
  mansion: {
    width: number;
    height: number;
    layout: number[][];
  };
  currentRequest: {
    endpointId: string;
    loading: boolean;
  } | null;
  lastResponse: ApiResponse | null;
  lastError: ApiError | null;
  score: number;
  gameOver: boolean;
  victory: boolean;
  screenShake: number;
  monstersFrozen: boolean;
  freezeUntil: number;
  difficulty: number;
  timeElapsed: number;
  message: string | null;
  messageUntil: number;
}

export const TILE_SIZE = 32;
export const PLAYER_SIZE = 16;
export const MONSTER_SIZE = 24;
export const PLAYER_SPEED = 2;
