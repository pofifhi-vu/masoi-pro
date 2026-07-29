export type Faction = 'VILLAGER' | 'WEREWOLF' | 'NEUTRAL';

export interface RoleDef {
  key: string;
  name: string;
  faction: Faction;
  factionLabel: string;
  description: string;
  iconName: string;
  defaultCount: number;
}

export interface PlayerAudioState {
  mic: boolean;
  livingSpeaker: boolean;
  deadSpeaker: boolean;
}

export interface Player {
  id: string;
  socketId: string;
  name: string;
  isHost: boolean;
  isAlive: boolean;
  role: string | null;
  connected: boolean;
  audioState: PlayerAudioState;
}

export type GameState = 'LOBBY' | 'NIGHT' | 'DAY' | 'ENDED';

export interface RoomState {
  code: string;
  hostSocketId: string;
  hostName: string;
  roleConfig: Record<string, number>;
  players: Player[];
  gameState: GameState;
  currentCalledRole: string | null;
  nightActions: Record<string, any>;
  dayVotes: Record<string, string>;
  nightLogs: string[];
  spectatorLogs: string[];
  
  // Trạng thái Tự Động Quản Trò (Auto-Host)
  isAutoHost?: boolean;
  phaseTimer?: {
    endTime: number;
    duration: number;
  };
  autoHostState?: {
    isVotingTime: boolean;
    nightRolesQueue: string[];
    currentQueueIndex: number;
  };
  
  // Trạng thái các role đặc biệt
  coupledPlayers?: string[];
  silencedPlayerIds?: string[];
  hunterTargetId?: string | null;
  elderBitten?: boolean;
}
