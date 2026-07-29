import React, { useState, useEffect, useRef } from 'react';
import {
  Eye, EyeOff, Shield, PawPrint, Sun, Moon, Skull, Heart, MicOff,
  UserCheck, AlertCircle, Play, Sparkles, CheckCircle2, ChevronRight, Activity, Trophy, Clock, Vote, Ban, Ghost, Crown, Users, Lock, Wifi
} from 'lucide-react';
import { RoomState, Player } from '../types/game';
import { ALL_ROLES } from '../constants/roles';
import { Socket } from 'socket.io-client';

interface GameViewProps {
  socket: Socket | null;
  room: RoomState;
  currentPlayer: Player | null;
  secretRole: string | null;
  activeActionRole: string | null;
  inspectionResult: { targetName?: string; targetRole?: string; isWolf?: boolean } | null;
  onClearInspection: () => void;
}

export const GameView: React.FC<GameViewProps> = ({
  socket,
  room,
  currentPlayer,
  secretRole,
  activeActionRole,
  inspectionResult,
  onClearInspection
}) => {
  const [showSecretRoleCard, setShowSecretRoleCard] = useState<boolean>(true);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedTargetId2, setSelectedTargetId2] = useState<string>('');
  const [witchOption, setWitchOption] = useState<'SAVE' | 'POISON' | 'NONE'>('NONE');
  const [actionSubmitted, setActionSubmitted] = useState<boolean>(false);
  const [myDayVote, setMyDayVote] = useState<string>('');
  const [playerLeftToast, setPlayerLeftToast] = useState<string | null>(null);
  const [speakingPlayers, setSpeakingPlayers] = useState<Record<string, boolean>>({});
  const [phaseTimeLeft, setPhaseTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    let interval: any;
    if (room.phaseTimer && room.phaseTimer.endTime) {
      const updateTimer = () => {
        const remaining = Math.max(0, Math.floor((room.phaseTimer!.endTime - Date.now()) / 1000));
        setPhaseTimeLeft(remaining);
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else {
      setPhaseTimeLeft(null);
    }
    return () => clearInterval(interval);
  }, [room.phaseTimer]);

  useEffect(() => {
    const handleSpeaking = (e: any) => {
      const { playerId, isSpeaking } = e.detail;
      setSpeakingPlayers(prev => {
        if (prev[playerId] === isSpeaking) return prev;
        return { ...prev, [playerId]: isSpeaking };
      });
    };
    window.addEventListener('player_speaking', handleSpeaking);
    return () => window.removeEventListener('player_speaking', handleSpeaking);
  }, []);

  const isHost = currentPlayer?.isHost || false;
  const isDead = currentPlayer ? !currentPlayer.isAlive : false;
  const myRole = secretRole || currentPlayer?.role;
  const myRoleDef = ALL_ROLES.find(r => r.key === myRole);

  const logEndRef = useRef<HTMLDivElement>(null);

  // Reset khi lượt hành động thay đổi
  useEffect(() => {
    setActionSubmitted(false);
    setSelectedTargetId('');
    setSelectedTargetId2('');
    setWitchOption('NONE');
    onClearInspection();
  }, [activeActionRole]);

  // Auto-scroll nhật ký admin xuống mục mới nhất
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [room.nightLogs]);

  // Lắng nghe thông báo người chơi thoát phòng
  useEffect(() => {
    if (!socket) return;
    const handler = ({ playerName, disconnected }: { playerName: string; disconnected?: boolean }) => {
      const msg = disconnected
        ? `🟡 ${playerName} bị mất kết nối!`
        : `🚪 ${playerName} đã rời khỏi phòng.`;
      setPlayerLeftToast(msg);
      setTimeout(() => setPlayerLeftToast(null), 4000);
    };
    socket.on('player_left_notify', handler);
    return () => { socket.off('player_left_notify', handler); };
  }, [socket]);

  const handleDayVote = (targetId: string) => {
    if (!socket || !room.code) return;
    setMyDayVote(targetId);
    socket.emit('submit_day_vote', { roomCode: room.code, targetPlayerId: targetId });
  };

  const handleHostExecuteVote = () => {
    if (!socket || !room.code) return;
    socket.emit('host_execute_vote_result', { roomCode: room.code });
  };

  const handleActionSubmit = (actionType: string) => {
    if (!socket || !room.code) return;
    socket.emit('player_submit_action', {
      roomCode: room.code,
      actionType,
      targetPlayerId: selectedTargetId,
      targetPlayerId2: selectedTargetId2,
      note: witchOption
    });
    setActionSubmitted(true);
  };

  const handleHostCallRole = (roleKey: string) => {
    if (!socket) return;
    socket.emit('host_call_role', { roomCode: room.code, roleKey });
  };

  const handleHostChangePhase = (nextPhase: 'NIGHT' | 'DAY') => {
    if (!socket) return;
    socket.emit('host_change_phase', { roomCode: room.code, nextPhase });
  };

  const handleHostToggleAlive = (playerId: string, currentAlive: boolean) => {
    if (!socket) return;
    socket.emit('host_toggle_player_alive', {
      roomCode: room.code,
      playerId,
      isAlive: !currentAlive
    });
  };

  const handleHostEndGame = () => {
    if (!socket) return;
    if (window.confirm('Bạn có chắc chắn muốn kết thúc trận đấu và công khai toàn bộ vai trò & nhật ký không?')) {
      socket.emit('host_end_game', { roomCode: room.code });
    }
  };

  const handleHostResetNightCall = () => {
    if (!socket) return;
    socket.emit('host_reset_night_call', { roomCode: room.code });
  };

  const magicalRolesInGame = ALL_ROLES.filter(r =>
    r.key !== 'DAN_LANG' && (room.roleConfig[r.key] || 0) > 0
  );

  // ─── GAME ENDED SCREEN ───
  if (room.gameState === 'ENDED') {
    return (
      <div className="min-h-screen bg-[#06060e] text-[#f1f0f7] p-3 sm:p-6 pb-voice-bar max-w-6xl mx-auto noise-bg">
        <header className="text-center my-8 animate-slide-up">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 glow-ring">
            <Trophy className="w-10 h-10 text-amber-400" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Trận Đấu Đã Kết Thúc!</h1>
          <p className="text-xs text-[#6a6580] mt-2 max-w-md mx-auto">
            Công khai vai trò từng người chơi và nhật ký hành động chi tiết.
          </p>
        </header>

        <section className="glass-panel rounded-2xl p-6 mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-sm font-bold text-white mb-5 flex items-center gap-2 border-b border-white/[0.06] pb-3">
            <UserCheck className="w-4 h-4 text-purple-400" />
            Bảng Công Khai Vai Trò ({room.players.length} người chơi)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {room.players.map(p => {
              const pRoleDef = ALL_ROLES.find(r => r.key === p.role);
              const isWolf = pRoleDef?.faction === 'WEREWOLF';
              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
                    isWolf ? 'bg-rose-500/[0.06] border-rose-500/15' : 'bg-blue-500/[0.06] border-blue-500/15'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                    p.isAlive
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {p.isAlive ? '💚' : '💀'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                      {p.name}
                      {p.isHost && <Crown className="w-3 h-3 text-amber-400" />}
                    </div>
                    <div className={`text-xs font-bold mt-0.5 ${isWolf ? 'text-rose-400' : 'text-purple-300'}`}>
                      {pRoleDef?.name || p.role}
                    </div>
                    <div className="text-[10px] text-[#5a5572] mt-0.5">
                      {pRoleDef?.factionLabel} • {p.isAlive ? 'Còn sống' : 'Đã chết'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2 border-b border-white/[0.06] pb-3">
            <Clock className="w-4 h-4 text-indigo-400" />
            Nhật Ký Hành Động Chi Tiết
          </h2>
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 max-h-96 overflow-y-auto font-mono text-[11px] text-purple-200 space-y-2 leading-relaxed">
            {room.nightLogs.length === 0 ? (
              <div className="text-[#3a3550] italic">Không có dữ liệu nhật ký...</div>
            ) : (
              room.nightLogs.map((log, idx) => (
                <div key={idx} className="border-b border-white/[0.03] pb-1.5 last:border-0 flex items-start gap-2">
                  <span className="text-purple-400 select-none font-bold">›</span>
                  <span className="break-words">{log}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    );
  }

  const logsForSpectator = (room.spectatorLogs && room.spectatorLogs.length > 0) ? room.spectatorLogs : room.nightLogs;

  // ─── GAME IN PROGRESS ───
  return (
    <div className="min-h-screen bg-[#06060e] text-[#f1f0f7] p-3 sm:p-6 pb-voice-bar noise-bg">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex items-center justify-between mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-white/[0.04] animate-slide-up">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`p-2 sm:p-3 rounded-xl border ${
            room.gameState === 'NIGHT'
              ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          }`}>
            {room.gameState === 'NIGHT' ? <Moon className="w-4 h-4 sm:w-5 sm:h-5" /> : <Sun className="w-4 h-4 sm:w-5 sm:h-5" />}
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white flex items-center gap-1.5 sm:gap-2">
              {room.gameState === 'NIGHT' ? '🌙 Ban Đêm' : '☀️ Ban Ngày'}
            </h1>
            {room.gameState === 'NIGHT' && room.currentCalledRole && (
              <div className="text-[10px] sm:text-xs font-bold text-amber-300 animate-pulse flex items-center gap-1 mt-0.5">
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
                <span>Đang gọi: {ALL_ROLES.find(r => r.key === room.currentCalledRole)?.name || room.currentCalledRole}</span>
              </div>
            )}
            <p className="text-[10px] sm:text-[11px] text-[#5a5572] mt-0.5">
              Phòng: <span className="font-mono text-purple-300 font-bold">{room.code}</span>
            </p>
          </div>
          {phaseTimeLeft !== null && (
            <div className="ml-4 flex flex-col items-center justify-center p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <span className="text-[10px] font-bold uppercase text-purple-300">Thời gian</span>
              <span className={`text-lg font-black font-mono ${phaseTimeLeft <= 5 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
                {phaseTimeLeft}s
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowSecretRoleCard(!showSecretRoleCard)}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl glass-panel hover:border-purple-500/30 text-xs font-bold text-purple-200 transition-all"
        >
          {showSecretRoleCard ? <EyeOff className="w-4 h-4 text-purple-400" /> : <Eye className="w-4 h-4 text-purple-400" />}
          <span>{showSecretRoleCard ? 'Ẩn lá bài' : 'Xem lá bài'}</span>
        </button>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Secret Role Card */}
        {showSecretRoleCard && myRoleDef && (
          <div className="lg:col-span-12 bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-purple-900/30 border border-purple-500/30 rounded-2xl p-4 sm:p-5 animate-slide-up shadow-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 relative z-10">
              <div className="flex items-center gap-3.5 sm:gap-4">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 border ${
                  myRoleDef.faction === 'WEREWOLF' ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' :
                  myRoleDef.faction === 'NEUTRAL' ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' :
                  'bg-blue-500/15 border-blue-500/30 text-blue-300'
                }`}>
                  {myRoleDef.faction === 'WEREWOLF' ? '🐺' : myRoleDef.faction === 'NEUTRAL' ? '🎭' : '🛡️'}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-md">
                      Lá Bài Của Bạn
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Chỉ mình bạn thấy
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white mt-1 flex items-center gap-2">
                    {myRoleDef.name}
                    <span className="text-xs font-bold text-[#8a85a0]">({myRoleDef.factionLabel})</span>
                  </h3>
                  <p className="text-xs text-[#b4afe0] mt-1 leading-relaxed max-w-2xl">{myRoleDef.description}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSecretRoleCard(false)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-500/15 border border-purple-500/25 hover:bg-purple-500/25 text-xs font-bold text-purple-200 transition-all shrink-0 text-center"
              >
                Ẩn lá bài
              </button>
            </div>
          </div>
        )}

        {/* Main Section */}
        <div className={`${
          isHost && !room.isAutoHost
            ? (activeActionRole ? 'lg:col-span-7' : 'lg:col-span-12')
            : (activeActionRole ? 'lg:col-span-7' : 'lg:col-span-12')
        } flex flex-col gap-5`}>
          {(isHost && !room.isAutoHost) ? (
            /* ─── HOST ADMIN PANEL ─── */
            <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-4 sm:gap-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 sm:pb-4 flex-wrap gap-2 sm:gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
                    <Crown className="w-4 h-4 text-amber-400" />
                  </div>
                  <h2 className="text-sm font-bold text-white">Quản trò Admin Panel</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleHostChangePhase(room.gameState === 'NIGHT' ? 'DAY' : 'NIGHT')}
                    className="px-3.5 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/15 text-xs font-bold text-indigo-200 hover:bg-indigo-500/20 transition-all flex items-center gap-1.5"
                  >
                    {room.gameState === 'NIGHT' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-400" />}
                    <span>{room.gameState === 'NIGHT' ? 'Ban Ngày' : 'Ban Đêm'}</span>
                  </button>
                  <button
                    onClick={handleHostEndGame}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/15 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-all flex items-center gap-1.5"
                  >
                    <Trophy className="w-3.5 h-3.5 text-rose-400" />
                    <span>Kết Thúc</span>
                  </button>
                </div>
              </div>

              {/* Day Vote Panel */}
              {room.gameState === 'DAY' && (
                <div className="p-4 bg-amber-500/[0.05] border border-amber-500/15 rounded-xl flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Vote className="w-4 h-4" />
                      Bảng kiểm phiếu ban ngày
                    </div>
                    <p className="text-[11px] text-[#6a6580] mt-0.5">
                      Đã có {Object.keys(room.dayVotes || {}).length} phiếu. Bấm để chốt kết quả.
                    </p>
                  </div>
                  <button
                    onClick={handleHostExecuteVote}
                    className="btn-primary px-5 py-2.5 text-white text-xs shrink-0"
                  >
                    Chốt Kết Quả
                  </button>
                </div>
              )}

              {/* Night Role Caller */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-bold uppercase text-[#5a5572] tracking-[0.15em] flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-purple-400/70" />
                    Gọi vai trò thức dậy
                  </h3>
                  {room.currentCalledRole && (
                    <button
                      onClick={handleHostResetNightCall}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px] font-bold text-[#6a6580] hover:text-white hover:border-white/[0.15] transition-all flex items-center gap-1"
                    >
                      <MicOff className="w-3 h-3" /> Tất Cả Ngủ
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {magicalRolesInGame.map(role => (
                    <button
                      key={role.key}
                      onClick={() => handleHostCallRole(role.key)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                        room.currentCalledRole === role.key
                          ? 'bg-purple-500/25 text-white border-purple-400/50 shadow-lg shadow-purple-500/15 animate-pulse ring-1 ring-purple-400/30'
                          : 'bg-white/[0.02] border-white/[0.05] text-[#c4bfe0] hover:bg-white/[0.05] hover:border-purple-500/20'
                      }`}
                    >
                      <span className="truncate">{role.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-purple-400/50 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Host's Player List */}
              <div>
                <h3 className="text-[10px] font-bold uppercase text-[#5a5572] mb-3 tracking-[0.15em] flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-purple-400/70" />
                  Danh sách vai trò từng người chơi
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
                  {room.players.filter(p => !p.isHost).map(p => {
                    const pRoleDef = ALL_ROLES.find(r => r.key === p.role);
                    const isWolf = pRoleDef?.faction === 'WEREWOLF';
                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                          speakingPlayers[p.id] ? 'ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] ' : ''
                        }${
                          !p.connected ? 'opacity-40 grayscale ' : ''
                        }${
                          p.isAlive
                            ? 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                            : 'bg-rose-500/[0.04] border-rose-500/10 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                            p.isAlive
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/15'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                          }`}>
                            {p.isAlive ? '💚' : '💀'}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5 flex-wrap">
                              <span className={!p.isAlive ? 'line-through text-rose-300' : ''}>{p.name}</span>
                              {room.silencedPlayerIds?.includes(p.id) && <MicOff className="w-3 h-3 text-rose-500" />}
                              {!p.connected && <Wifi className="w-3 h-3 text-amber-500 animate-pulse" title="Mất kết nối" />}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                isWolf
                                  ? 'bg-rose-500/10 text-rose-300 border border-rose-500/15'
                                  : 'bg-blue-500/10 text-blue-300 border border-blue-500/15'
                              }`}>
                                {pRoleDef?.name || p.role}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#5a5572]">{p.isAlive ? 'Sống' : 'Đã chết'}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleHostToggleAlive(p.id, p.isAlive)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all shrink-0 ${
                            p.isAlive
                              ? 'bg-rose-500/10 border-rose-500/15 text-rose-300 hover:bg-rose-500/20'
                              : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20'
                          }`}
                        >
                          {p.isAlive ? 'Cho Chết' : 'Hồi Sinh'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Admin Logs */}
              <div>
                <h3 className="text-[10px] font-bold uppercase text-[#5a5572] mb-3 tracking-[0.15em] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-400/70" />
                  Nhật ký Admin Quản trò
                </h3>
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 h-36 overflow-y-auto font-mono text-[11px] text-purple-200 space-y-1.5">
                  {room.nightLogs.length === 0 ? (
                    <div className="text-[#3a3550] italic">Chưa có nhật ký hành động...</div>
                  ) : (
                    room.nightLogs.map((log, i) => (
                      <div key={i} className="leading-relaxed border-b border-white/[0.03] pb-1 last:border-0 break-words">
                        {log}
                      </div>
                    ))
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>
          ) : (
            /* ─── PLAYER VIEW (NON-HOST) ─── */
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400/70" />
                  Danh sách người chơi
                </h2>
                {myRoleDef && (
                  <div className="text-xs font-bold text-purple-300 bg-purple-500/15 border border-purple-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <span>Bạn là:</span>
                    <span className="text-white font-extrabold">{myRoleDef.name}</span>
                  </div>
                )}
              </div>

              {/* Day Voting */}
              {room.gameState === 'DAY' && currentPlayer?.isAlive && (!room.isAutoHost || room.autoHostState?.isVotingTime) && (
                <div className="p-4 bg-gradient-to-r from-amber-500/[0.04] to-purple-500/[0.04] border border-amber-500/15 rounded-xl">
                  <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Vote className="w-4 h-4" />
                    Bỏ phiếu nghi ngờ Ma Sói
                  </h3>
                  <p className="text-xs text-[#8a85a0] mb-3">
                    Chọn 1 người nghi là Ma Sói để treo cổ hoặc chọn bỏ qua:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {room.players.filter(p => p.isAlive && (room.isAutoHost || !p.isHost)).map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleDayVote(p.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                          myDayVote === p.id
                            ? 'bg-amber-500/20 text-amber-200 border-amber-500/30 shadow-lg shadow-amber-900/10'
                            : 'bg-white/[0.02] border-white/[0.05] text-[#c4bfe0] hover:bg-white/[0.05]'
                        }`}
                      >
                        Vote {p.name}
                      </button>
                    ))}
                    <button
                      onClick={() => handleDayVote('SKIP')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 ${
                        myDayVote === 'SKIP'
                          ? 'bg-white/[0.08] text-white border-white/[0.15]'
                          : 'bg-white/[0.02] border-white/[0.05] text-[#5a5572] hover:bg-white/[0.04]'
                      }`}
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Bỏ Qua
                    </button>
                  </div>
                </div>
              )}

              {/* Players Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {room.players.map(p => (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
                      speakingPlayers[p.id] ? 'ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] ' : ''
                    }${
                      !p.connected ? 'opacity-40 grayscale ' : ''
                    }${
                      p.id === currentPlayer?.id
                        ? 'bg-purple-500/[0.08] border-purple-500/20 shadow-lg shadow-purple-900/10'
                        : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0 ${
                      p.isAlive
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/15'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                    }`}>
                      {p.isAlive ? '💚' : '💀'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate flex items-center gap-1.5 flex-wrap">
                        <span className={!p.isAlive ? 'line-through text-rose-300' : ''}>{p.name}</span>
                        {p.id === currentPlayer?.id && <span className="text-[10px] text-purple-400 font-bold">(Bạn)</span>}
                        {p.isHost && <Crown className="w-3 h-3 text-amber-400" />}
                        {room.silencedPlayerIds?.includes(p.id) && <MicOff className="w-3.5 h-3.5 text-rose-500" />}
                        {!p.connected && <Wifi className="w-3.5 h-3.5 text-amber-500 animate-pulse" title="Mất kết nối" />}
                      </div>
                      <div className="text-[11px] text-[#5a5572]">
                        {p.isAlive ? 'Còn sống' : 'Đã chết (Hồn ma 👻)'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Spectator Logs for Dead Players */}
              {isDead && (
                <div className="mt-2 p-4 glass-panel rounded-xl flex flex-col gap-2">
                  <h3 className="text-[10px] font-bold text-indigo-300 uppercase tracking-[0.15em] flex items-center gap-1.5">
                    <Ghost className="w-3.5 h-3.5 text-indigo-400" />
                    Nhật ký trận đấu (Hồn Ma 👻)
                  </h3>
                  <p className="text-[11px] text-[#6a6580] leading-relaxed">
                    Bạn đang ở chế độ Hồn Ma! Xem tiến trình gọi vai trò và sự kiện diễn ra:
                  </p>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 h-44 overflow-y-auto font-mono text-[11px] text-purple-200 space-y-1.5">
                    {logsForSpectator.length === 0 ? (
                      <div className="text-[#3a3550] italic">Chưa có nhật ký diễn biến...</div>
                    ) : (
                      logsForSpectator.map((log, i) => (
                        <div key={i} className="leading-relaxed border-b border-white/[0.03] pb-1 last:border-0 break-words">
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Night Action Panel */}
        {activeActionRole && (
          <div className="lg:col-span-5 bg-gradient-to-b from-purple-500/[0.08] to-indigo-500/[0.04] border border-purple-500/30 rounded-2xl p-5 sm:p-6 flex flex-col gap-4 animate-slide-up shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="text-[10px] font-extrabold text-amber-300 uppercase tracking-[0.15em] animate-pulse">Lượt của bạn!</div>
                <h3 className="text-lg font-black text-white">
                  {ALL_ROLES.find(r => r.key === activeActionRole)?.name ||
                    (activeActionRole === 'MA_SOI' ? 'Phe Ma Sói' : activeActionRole)}
                </h3>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-[#b4afe0] leading-relaxed">
              {activeActionRole === 'MA_SOI' || activeActionRole?.startsWith('SOI_CON') || activeActionRole === 'SOI_BANG_TRONG'
                ? 'Quản trò vừa gọi Phe Sói. Thảo luận và chọn 1 nạn nhân để cắn chết đêm nay:'
                : activeActionRole === 'TIEN_TRI'
                  ? 'Quản trò gọi Tiên tri. Chọn 1 người chơi để kiểm tra phe (Sói hay Dân làng):'
                  : activeActionRole === 'SOI_TIEN_TRI'
                    ? 'Quản trò gọi Sói tiên tri. Chọn 1 người để xem đúng vai trò của họ:'
                    : activeActionRole === 'BAO_VE'
                      ? 'Quản trò gọi Bảo vệ. Chọn 1 người để bảo vệ khỏi Sói đêm nay:'
                      : activeActionRole === 'PHU_THUY'
                        ? 'Quản trò gọi Phù thủy. Chọn dùng thuốc cứu, thuốc độc, hoặc bỏ qua:'
                        : activeActionRole === 'THAN_TINH_YEU'
                          ? 'Quản trò gọi Thần tình yêu. Chọn 2 người chơi để ghép đôi (cùng sống cùng chết):'
                          : activeActionRole === 'PHAP_SU_CAM_LANG' || activeActionRole === 'SOI_CAM_LANG'
                            ? 'Quản trò gọi cấm lặng. Chọn 1 người bị cấm phát biểu trong ngày mai:'
                            : activeActionRole === 'THO_SAN'
                              ? 'Quản trò gọi Thợ săn. Chọn 1 người sẽ kéo theo khi bạn bị chết đêm nay:'
                              : 'Quản trò vừa gọi chức năng của bạn. Chọn mục tiêu bên dưới:'}
            </p>

            {actionSubmitted ? (
              <div className="p-5 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-xl text-center flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-200">Đã gửi hành động! Chờ quản trò chuyển lượt.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">

                {/* ─── Phù Thủy: 3 luồng hoàn toàn tách biệt ─── */}
                {activeActionRole === 'PHU_THUY' ? (() => {
                  return (
                  <div className="flex flex-col gap-3">


                    {/* Bước 1: Chọn hành động */}
                    {witchOption === 'NONE' && (
                      <>
                        <p className="text-[11px] text-[#8a85a0]">Chọn hành động đêm nay:</p>

                        {/* SAVE */}
                        <button
                          onClick={() => {
                            setWitchOption('SAVE');
                          }}
                          className="p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] hover:bg-emerald-500/10 text-left transition-all group"
                        >
                          <div className="text-sm font-bold text-emerald-300 flex items-center gap-2 mb-1">
                            <Heart className="w-4 h-4" /> Dùng thuốc cứu mạng 💊
                          </div>
                          <div className="text-[11px] text-[#6a6580]">
                            Cứu bất kỳ 1 người chơi nào bạn chọn khỏi cái chết đêm nay. Nhấn để chọn mục tiêu.
                          </div>
                        </button>

                        {/* POISON */}
                        <button
                          onClick={() => {
                            setWitchOption('POISON');
                            setSelectedTargetId('');
                          }}
                          className="p-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.04] hover:bg-rose-500/10 text-left transition-all group"
                        >
                          <div className="text-sm font-bold text-rose-300 flex items-center gap-2 mb-1">
                            <Skull className="w-4 h-4" /> Dùng thuốc độc ☠️
                          </div>
                          <div className="text-[11px] text-[#6a6580]">Đầu độc 1 người chơi bạn chọn. Nhấn để chọn mục tiêu.</div>
                        </button>

                        {/* SKIP */}
                        <button
                          onClick={() => handleActionSubmit('SKIP')}
                          className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.07] text-xs font-bold text-[#6a6580] hover:text-white hover:border-white/[0.15] transition-all flex items-center justify-center gap-1.5"
                        >
                          <Ban className="w-3.5 h-3.5" /> Bỏ Qua (Không dùng thuốc đêm nay)
                        </button>
                      </>
                    )}

                    {/* Bước 2a: Chọn người dùng thuốc CỨU */}
                    {witchOption === 'SAVE' && (
                      <div className="flex flex-col gap-3 p-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/25">
                        <div className="flex items-center gap-2">
                          <Heart className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm font-bold text-emerald-300">Thuốc cứu mạng 💊 — Chọn mục tiêu</span>
                        </div>
                        <p className="text-[11px] text-[#8a85a0] leading-relaxed">
                          Chọn 1 người chơi bạn muốn trao thuốc cứu:
                        </p>
                        <select
                          value={selectedTargetId}
                          onChange={e => setSelectedTargetId(e.target.value)}
                          className="w-full p-3 bg-white/[0.03] border border-emerald-500/30 rounded-xl text-sm text-white outline-none focus:border-emerald-500/60 transition-all"
                        >
                          <option value="">-- Chọn người chơi để dùng thuốc cứu --</option>
                          {room.players.filter(p => p.isAlive && (room.isAutoHost || !p.isHost)).map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleActionSubmit('NIGHT_ACTION')}
                          disabled={!selectedTargetId}
                          className="py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-sm font-bold text-emerald-200 hover:bg-emerald-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          ✨ Xác nhận dùng thuốc cứu {selectedTargetId ? room.players.find(p => p.id === selectedTargetId)?.name : '...'}
                        </button>
                        <button
                          onClick={() => { setWitchOption('NONE'); setSelectedTargetId(''); }}
                          className="text-[11px] text-[#5a5572] hover:text-white transition-colors text-center underline"
                        >
                          ← Quay lại chọn lại
                        </button>
                      </div>
                    )}

                    {/* Bước 2b: Chọn mục tiêu cho thuốc ĐỘC */}
                    {witchOption === 'POISON' && (
                      <div className="flex flex-col gap-3 p-4 rounded-xl bg-rose-500/[0.06] border border-rose-500/25">
                        <div className="flex items-center gap-2">
                          <Skull className="w-4 h-4 text-rose-400" />
                          <span className="text-sm font-bold text-rose-300">Thuốc độc ☠️ — Chọn mục tiêu</span>
                        </div>
                        <select
                          value={selectedTargetId}
                          onChange={e => setSelectedTargetId(e.target.value)}
                          className="w-full p-3 bg-white/[0.03] border border-rose-500/30 rounded-xl text-sm text-white outline-none focus:border-rose-500/60 transition-all"
                        >
                          <option value="">-- Chọn người muốn đầu độc --</option>
                          {room.players.filter(p => p.isAlive && (room.isAutoHost || !p.isHost)).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleActionSubmit('NIGHT_ACTION')}
                          disabled={!selectedTargetId}
                          className="py-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-sm font-bold text-rose-200 hover:bg-rose-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          ☠️ Xác nhận đầu độc {selectedTargetId ? room.players.find(p => p.id === selectedTargetId)?.name : '...'}
                        </button>
                        <button
                          onClick={() => { setWitchOption('NONE'); setSelectedTargetId(''); }}
                          className="text-[11px] text-[#5a5572] hover:text-white transition-colors text-center underline"
                        >
                          ← Quay lại chọn lại
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })() : activeActionRole === 'THAN_TINH_YEU' ? (
                  /* ─── Thần tình yêu: chọn 2 người ─── */
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs font-bold text-[#8a85a0] mb-1.5 block">Chọn người 1:</label>
                      <select
                        value={selectedTargetId}
                        onChange={e => setSelectedTargetId(e.target.value)}
                        className="w-full p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-white outline-none focus:border-purple-500/50 transition-all"
                      >
                        <option value="">-- Chọn người chơi --</option>
                        {room.players.filter(p => p.isAlive && (room.isAutoHost || !p.isHost)).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#8a85a0] mb-1.5 block">Chọn người 2 (ghép đôi):</label>
                      <select
                        value={selectedTargetId2}
                        onChange={e => setSelectedTargetId2(e.target.value)}
                        className="w-full p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-white outline-none focus:border-purple-500/50 transition-all"
                      >
                        <option value="">-- Chọn người chơi thứ 2 --</option>
                        {room.players.filter(p => p.isAlive && (room.isAutoHost || !p.isHost) && p.id !== selectedTargetId).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleActionSubmit('NIGHT_ACTION')}
                        disabled={!selectedTargetId || !selectedTargetId2}
                        className="btn-primary py-3 text-white text-xs font-bold"
                      >
                        Ghép đôi 2 người này 💕
                      </button>
                      <button
                        onClick={() => handleActionSubmit('SKIP')}
                        className="px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-xs font-bold text-[#6a6580] hover:text-white hover:border-white/[0.15] transition-all flex items-center justify-center gap-1.5"
                      >
                        <Ban className="w-3.5 h-3.5" /> Bỏ Qua
                      </button>
                    </div>
                  </div>

                ) : (
                  /* ─── Tất cả role khác: chọn 1 mục tiêu ─── */
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs font-bold text-[#8a85a0] mb-1.5 block">Chọn mục tiêu:</label>
                      <select
                        value={selectedTargetId}
                        onChange={e => setSelectedTargetId(e.target.value)}
                        className="w-full p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-white outline-none focus:border-purple-500/50 transition-all"
                      >
                        <option value="">-- Chọn 1 người chơi --</option>
                        {room.players.filter(p => p.isAlive && (room.isAutoHost || !p.isHost)).map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.id === currentPlayer?.id ? '(Bản thân)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleActionSubmit('NIGHT_ACTION')}
                        disabled={!selectedTargetId}
                        className="btn-primary py-3 text-white text-xs font-bold"
                      >
                        Xác nhận hành động
                      </button>
                      <button
                        onClick={() => handleActionSubmit('SKIP')}
                        className="px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-xs font-bold text-[#6a6580] hover:text-white hover:border-white/[0.15] transition-all flex items-center justify-center gap-1.5"
                      >
                        <Ban className="w-3.5 h-3.5" /> Bỏ Qua (Không hành động)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Inspection Result */}
            {inspectionResult && (
              <div className="mt-2 p-4 bg-indigo-500/[0.08] border border-indigo-500/20 rounded-xl">
                <h4 className="text-xs font-bold text-indigo-300 mb-2">Kết quả soi bài:</h4>
                <p className="text-xs text-white">
                  Người chơi <span className="font-bold text-purple-300">{inspectionResult.targetName}</span> là:{' '}
                  <span className={`font-bold ${inspectionResult.isWolf ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {inspectionResult.isWolf ? '🐺 PHE MA SÓI' : '💚 PHE DÂN LÀNG'}
                  </span>
                </p>
                {/* SOI_TIEN_TRI thấy được role cụ thể */}
                {inspectionResult.targetRole && (
                  <p className="text-xs text-amber-300 mt-1">
                    → Vai trò cụ thể: <span className="font-bold">{inspectionResult.targetRole}</span>
                  </p>
                )}
                <button
                  onClick={onClearInspection}
                  className="mt-2 text-[10px] text-indigo-300 underline hover:text-white transition-colors"
                >
                  Đóng kết quả
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast: Thông báo người thoát phòng */}
      {playerLeftToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl glass-panel border-amber-500/20 text-amber-200 text-xs font-bold shadow-2xl animate-slide-up flex items-center gap-2">
          <span>{playerLeftToast}</span>
        </div>
      )}
    </div>
  );
};
