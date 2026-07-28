import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { HomeScreen } from './components/HomeScreen';
import { CreateRoomView } from './components/CreateRoomView';
import { LobbyRoom } from './components/LobbyRoom';
import { GameView } from './components/GameView';
import { VoiceChatBar } from './components/VoiceChatBar';
import { RoomState, Player } from './types/game';
import { User, ArrowLeft, LogIn } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#06060e] flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl p-8 max-w-md text-center">
            <h2 className="text-xl font-bold text-rose-400 mb-3">⚠️ Lỗi ứng dụng</h2>
            <p className="text-sm text-[#8a85a0] mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary px-6 py-2.5 text-white text-sm"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [view, setView] = useState<'HOME' | 'CREATE' | 'NAME_ENTRY' | 'LOBBY' | 'GAME'>('HOME');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [secretRole, setSecretRole] = useState<string | null>(null);
  const [activeActionRole, setActiveActionRole] = useState<string | null>(null);
  const [inspectionResult, setInspectionResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingRoomCode, setPendingRoomCode] = useState<string>('');

  // Initialize Socket Connection
  useEffect(() => {
    const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin;
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling']
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to socket server:', newSocket.id);
    });

    newSocket.on('room_updated', (updatedRoom: RoomState) => {
      setRoom(updatedRoom);
      if (updatedRoom.players && newSocket.id) {
        const me = updatedRoom.players.find(p => p.socketId === newSocket.id);
        if (me) setCurrentPlayer(me);
      }
    });

    newSocket.on('game_started', (updatedRoom: RoomState) => {
      setRoom(updatedRoom);
      setView('GAME');
    });

    newSocket.on('your_secret_role', ({ role }: { role: string }) => {
      setSecretRole(role);
    });

    newSocket.on('your_turn_to_act', ({ roleKey }: { roleKey: string }) => {
      setActiveActionRole(roleKey);
    });

    newSocket.on('role_called_broadcast', ({ roleKey }: { roleKey: string }) => {
      if (secretRole !== roleKey) {
        setActiveActionRole(null);
      }
    });

    newSocket.on('inspection_result', (result: any) => {
      setInspectionResult(result);
    });

    newSocket.on('phase_changed', ({ gameState, room: updatedRoom }: { gameState: any; room: RoomState }) => {
      setRoom(updatedRoom);
      if (gameState === 'DAY') {
        setActiveActionRole(null);
        setInspectionResult(null);
      }
    });

    // Check if room code exists in URL query parameter ?room=XYZ
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      // Don't join immediately - show name entry first
      setPendingRoomCode(roomParam.trim().toLowerCase());
      setView('NAME_ENTRY');
    }

    return () => {
      newSocket.disconnect();
    };
  }, [secretRole]);

  // Handle Create Room
  const handleCreateRoom = (customCode: string, roleConfig: Record<string, number>, playerNamesText: string) => {
    if (!socket) return;

    const parsedNames = playerNamesText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const hostName = parsedNames[0] || 'Quản trò (Host)';

    socket.emit('create_room', { customCode, roleConfig, hostName, initialPlayerNames: parsedNames }, (res: any) => {
      if (res.success) {
        setRoom(res.room);
        const meHost = res.room.players.find((p: any) => p.socketId === socket.id || p.isHost);
        if (meHost) setCurrentPlayer(meHost);
        setView('LOBBY');

        socket.emit('join_room', { roomCode: res.roomCode, playerName: hostName }, (joinRes: any) => {
          if (joinRes.success) {
            setRoom(joinRes.room);
            setCurrentPlayer(joinRes.player);
          }
        });
      } else {
        setErrorMessage(res.message);
      }
    });
  };

  // Handle Join Room from Home Modal - now goes to NAME_ENTRY first
  const handleSelectJoinRoom = (roomCode: string) => {
    setPendingRoomCode(roomCode.trim().toLowerCase());
    setView('NAME_ENTRY');
  };

  // Handle submitting name and actually joining the room
  const handleNameSubmitAndJoin = (playerName: string) => {
    if (!socket || !pendingRoomCode) return;
    socket.emit('join_room', { roomCode: pendingRoomCode, playerName }, (res: any) => {
      if (res.success) {
        setRoom(res.room);
        setCurrentPlayer(res.player);
        setView('LOBBY');
        setPendingRoomCode('');
      } else {
        setErrorMessage(res.message);
      }
    });
  };

  // Handle Join with Display Name inside Lobby (legacy fallback)
  const handleJoinWithName = (name: string) => {
    if (!socket || !room) return;
    socket.emit('join_room', { roomCode: room.code, playerName: name }, (res: any) => {
      if (res.success) {
        setRoom(res.room);
        setCurrentPlayer(res.player);
      } else {
        setErrorMessage(res.message);
      }
    });
  };

  // Handle Start Game
  const handleStartGame = () => {
    if (!socket || !room) return;
    socket.emit('start_game', { roomCode: room.code }, (res: any) => {
      if (!res.success) {
        setErrorMessage(res.message);
      }
    });
  };

  const handleLeaveRoom = () => {
    if (socket && room) {
      socket.emit('leave_room', { roomCode: room.code });
    }
    setRoom(null);
    setCurrentPlayer(null);
    setView('HOME');
  };

  return (
    <div className="min-h-screen bg-[#06060e]">
      {/* Global Error Banner */}
      {errorMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 glass-panel border-rose-500/20 text-rose-200 text-xs px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-up">
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold underline ml-2 hover:text-white">Đóng</button>
        </div>
      )}

      {view === 'HOME' && (
        <HomeScreen
          onSelectCreate={() => setView('CREATE')}
          onSelectJoin={handleSelectJoinRoom}
        />
      )}

      {view === 'CREATE' && (
        <CreateRoomView
          onCreateRoom={handleCreateRoom}
          onBackToHome={() => setView('HOME')}
        />
      )}

      {/* NAME ENTRY SCREEN - Hỏi tên trước khi vào phòng */}
      {view === 'NAME_ENTRY' && (
        <NameEntryScreen
          roomCode={pendingRoomCode}
          onSubmitName={handleNameSubmitAndJoin}
          onBack={() => { setPendingRoomCode(''); setView('HOME'); }}
        />
      )}

      {view === 'LOBBY' && room && (
        <LobbyRoom
          room={room}
          currentPlayer={currentPlayer}
          onJoinWithName={handleJoinWithName}
          onStartGame={handleStartGame}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {view === 'GAME' && room && (
        <GameView
          socket={socket}
          room={room}
          currentPlayer={currentPlayer}
          secretRole={secretRole}
          activeActionRole={activeActionRole}
          inspectionResult={inspectionResult}
          onClearInspection={() => setInspectionResult(null)}
        />
      )}

      {/* Persistent Voice Chat Audio Control Bar */}
      {room && (
        <VoiceChatBar
          socket={socket}
          roomCode={room.code}
          currentPlayer={currentPlayer}
          room={room}
        />
      )}
    </div>
  );
};

// ─── Name Entry Screen Component ───
interface NameEntryScreenProps {
  roomCode: string;
  onSubmitName: (name: string) => void;
  onBack: () => void;
}

const NameEntryScreen: React.FC<NameEntryScreenProps> = ({ roomCode, onSubmitName, onBack }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmitName(name.trim());
    }
  };

  return (
    <div className="min-h-screen bg-[#06060e] flex items-center justify-center p-4 relative overflow-hidden noise-bg">
      {/* Ambient Background */}
      <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-purple-600/8 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-[250px] h-[250px] bg-indigo-500/6 blur-[100px] rounded-full pointer-events-none" />

      <div className="glass-panel rounded-2xl p-8 max-w-sm w-full animate-slide-up relative z-10">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] text-[#6a6580] hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại</span>
        </button>

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-5 glow-ring">
          <User className="w-8 h-8 text-purple-400" />
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-white mb-1.5">Nhập tên của bạn</h2>
          <p className="text-xs text-[#6a6580] leading-relaxed">
            Bạn đang tham gia phòng <span className="text-purple-300 font-mono font-bold tracking-wider">{roomCode.toUpperCase()}</span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ví dụ: An, Bình, Cường..."
            className="w-full px-4 py-4 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm placeholder-[#4a4560] focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.05] font-semibold transition-all text-center"
            autoFocus
            maxLength={20}
          />

          <button
            type="submit"
            disabled={!name.trim()}
            className="btn-primary py-3.5 text-white text-sm flex items-center justify-center gap-2 group"
          >
            <LogIn className="w-4 h-4" />
            <span>Vào Phòng Chơi</span>
          </button>
        </form>

        {/* Hint */}
        <p className="text-center text-[10px] text-[#4a4560] mt-5">
          Tên này sẽ hiển thị cho mọi người trong phòng
        </p>
      </div>
    </div>
  );
};

export const App: React.FC = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);
