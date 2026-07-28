import React, { useState, useEffect } from 'react';
import {
  Eye, EyeOff, Shield, PawPrint, Sun, Moon, Skull, Heart, MicOff,
  UserCheck, AlertCircle, Play, Sparkles, CheckCircle2, ChevronRight, Activity, Trophy, Clock, Vote, Ban, Ghost, Crown, Users
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
  const [showSecretRoleCard, setShowSecretRoleCard] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedTargetId2, setSelectedTargetId2] = useState<string>('');
  const [witchOption, setWitchOption] = useState<'SAVE' | 'POISON' | 'NONE'>('NONE');
  const [actionSubmitted, setActionSubmitted] = useState(false);
  const [myDayVote, setMyDayVote] = useState<string>('');

  const isHost = currentPlayer?.isHost || false;
  const isDead = currentPlayer ? !currentPlayer.isAlive : false;
  const myRole = secretRole || currentPlayer?.role;
  const myRoleDef = ALL_ROLES.find(r => r.key === myRole);

  useEffect(() => {
    setActionSubmitted(false);
    setSelectedTargetId('');
    setSelectedTargetId2('');
  }, [activeActionRole]);

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

  const magicalRolesInGame = ALL_ROLES.filter(r =>
    r.key !== 'DAN_LANG' && (room.roleConfig[r.key] || 0) > 0
  );

  // ─── GAME ENDED SCREEN ───
  if (room.gameState === 'ENDED') {
    return (
      <div className="min-h-screen bg-[#06060e] text-[#f1f0f7] p-4 sm:p-6 pb-28 max-w-6xl mx-auto noise-bg">
        <header className="text-center my-8 animate-slide-up">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 glow-ring">
            <Trophy className="w-10 h-10 text-amber-400" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Trận Đấu Đã Kết Thúc!</h1>
          <p className="text-xs text-[#6a6580] mt-2 max-w-md mx-auto">
            Công khai vai trò từng người chơi và nhật ký hành động chi tiết.
          </p>
        </header>

        {/* Roles Revealed */}
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

        {/* Match Logs */}
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
    <div className="min-h-screen bg-[#06060e] text-[#f1f0f7] p-4 sm:p-6 pb-28 noise-bg">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex items-center justify-between mb-6 pb-4 border-b border-white/[0.04] animate-slide-up">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl border ${
            room.gameState === 'NIGHT'
              ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          }`}>
            {room.gameState === 'NIGHT' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              {room.gameState === 'NIGHT' ? '🌙 Ban Đêm' : '☀️ Ban Ngày'}
            </h1>
            {room.gameState === 'NIGHT' && room.currentCalledRole && (
              <div className="text-xs font-bold text-amber-300 animate-pulse flex items-center gap-1 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Đang gọi: {ALL_ROLES.find(r => r.key === room.currentCalledRole)?.name || room.currentCalledRole}</span>
              </div>
            )}
            <p className="text-[11px] text-[#5a5572] mt-0.5">
              Phòng: <span className="font-mono text-purple-300 font-bold">{room.code}</span>
            </p>
          </div>
        </div>

        {/* Secret Role Toggle */}
        <button
          onClick={() => setShowSecretRoleCard(!showSecretRoleCard)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel hover:border-purple-500/30 text-xs font-bold text-purple-200 transition-all"
        >
          {showSecretRoleCard ? <EyeOff className="w-4 h-4 text-purple-400" /> : <Eye className="w-4 h-4 text-purple-400" />}
          <span className="hidden sm:inline">{showSecretRoleCard ? 'Ẩn vai trò' : 'Xem vai trò'}</span>
        </button>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Secret Role Card */}
        {showSecretRoleCard && myRoleDef && (
          <div className="lg:col-span-12 bg-gradient-to-r from-purple-500/[0.08] to-indigo-500/[0.08] border border-purple-500/20 rounded-2xl p-6 animate-slide-up">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl">
                  🎭
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#6a6580] uppercase tracking-[0.15em]">
                    {myRoleDef.factionLabel}
                  </div>
                  <h3 className="text-2xl font-black text-white">{myRoleDef.name}</h3>
                  <p className="text-xs text-[#8a85a0] mt-0.5">{myRoleDef.description}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSecretRoleCard(false)}
                className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs font-bold text-purple-200 hover:bg-purple-500/20 transition-all"
              >
                Đóng lá bài
              </button>
            </div>
          </div>
        )}

        {/* LEFT: Admin Panel or Player View */}
        <div className={`lg:col-span-${isHost ? '7' : '12'} flex flex-col gap-5`}>
          {isHost ? (
            /* ─── HOST ADMIN PANEL ─── */
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-4 flex-wrap gap-3">
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
                <div className="p-4 bg-amber-500/[0.05] border border-amber-500/15 rounded-xl flex items-center justify-between gap-4">
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
                <h3 className="text-[10px] font-bold uppercase text-[#5a5572] mb-3 tracking-[0.15em] flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-purple-400/70" />
                  Gọi vai trò thức dậy
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {magicalRolesInGame.map(role => (
                    <button
                      key={role.key}
                      onClick={() => handleHostCallRole(role.key)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                        room.currentCalledRole === role.key
                          ? 'bg-purple-500/20 text-white border-purple-500/40 shadow-lg shadow-purple-500/10'
                          : 'bg-white/[0.02] border-white/[0.05] text-[#c4bfe0] hover:bg-white/[0.05] hover:border-purple-500/20'
                      }`}
                    >
                      <span className="truncate">{role.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-purple-400/50 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Player Roles List */}
              <div>
                <h3 className="text-[10px] font-bold uppercase text-[#5a5572] mb-3 tracking-[0.15em] flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-purple-400/70" />
                  Danh sách vai trò
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {room.players.map(p => {
                    const pRoleDef = ALL_ROLES.find(r => r.key === p.role);
                    const isWolf = pRoleDef?.faction === 'WEREWOLF';
                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                          p.isAlive
                            ? 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                            : 'bg-rose-500/[0.04] border-rose-500/10 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${
                            p.isAlive
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/15'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                          }`}>
                            {p.isAlive ? '💚' : '💀'}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate flex items-center gap-2">
                              <span>{p.name}</span>
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
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
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
                  Nhật ký Admin
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
                </div>
              </div>
            </div>
          ) : (
            /* ─── PLAYER VIEW ─── */
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400/70" />
                Thông tin trận đấu
              </h2>

              {/* Day Voting */}
              {room.gameState === 'DAY' && currentPlayer?.isAlive && (
                <div className="p-4 bg-gradient-to-r from-amber-500/[0.04] to-purple-500/[0.04] border border-amber-500/15 rounded-xl">
                  <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Vote className="w-4 h-4" />
                    Bỏ phiếu nghi ngờ Ma Sói
                  </h3>
                  <p className="text-xs text-[#8a85a0] mb-3">
                    Chọn 1 người nghi là Ma Sói để treo cổ hoặc bỏ qua:
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {room.players.filter(p => p.isAlive).map(p => (
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

              {/* Players List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {room.players.map(p => (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
                      p.id === currentPlayer?.id
                        ? 'bg-purple-500/[0.08] border-purple-500/20'
                        : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm ${
                      p.isAlive
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/15'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                    }`}>
                      {p.isAlive ? '💚' : '💀'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                        {p.name}
                        {p.id === currentPlayer?.id && <span className="text-[10px] text-purple-400">(Bạn)</span>}
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
          <div className="lg:col-span-5 bg-gradient-to-b from-purple-500/[0.06] to-indigo-500/[0.03] border border-purple-500/20 rounded-2xl p-6 flex flex-col gap-4 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-purple-400/80 uppercase tracking-[0.15em]">Đến lượt bạn!</div>
                <h3 className="text-lg font-black text-white">{ALL_ROLES.find(r => r.key === activeActionRole)?.name}</h3>
              </div>
            </div>

            <p className="text-xs text-[#8a85a0] leading-relaxed">
              Quản trò vừa gọi chức năng của bạn. Chọn mục tiêu bên dưới để thực hiện hành động đêm.
            </p>

            {actionSubmitted ? (
              <div className="p-5 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl text-center flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-200">Đã gửi hành động! Bạn có thể đi ngủ.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-[#8a85a0] mb-1.5 block">Chọn mục tiêu:</label>
                  <select
                    value={selectedTargetId}
                    onChange={e => setSelectedTargetId(e.target.value)}
                    className="w-full p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-white outline-none focus:border-purple-500/50 transition-all"
                  >
                    <option value="">-- Chọn 1 người chơi --</option>
                    {room.players.filter(p => p.isAlive).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.id === currentPlayer?.id ? '(Bản thân)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {activeActionRole === 'THAN_TINH_YEU' && (
                  <div>
                    <label className="text-xs font-bold text-[#8a85a0] mb-1.5 block">Chọn mục tiêu thứ 2 (Ghép đôi):</label>
                    <select
                      value={selectedTargetId2}
                      onChange={e => setSelectedTargetId2(e.target.value)}
                      className="w-full p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-white outline-none focus:border-purple-500/50 transition-all"
                    >
                      <option value="">-- Chọn người chơi thứ 2 --</option>
                      {room.players.filter(p => p.isAlive && p.id !== selectedTargetId).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={() => handleActionSubmit('NIGHT_ACTION')}
                  disabled={!selectedTargetId}
                  className="btn-primary py-3 text-white text-xs mt-2"
                >
                  Xác nhận hành động
                </button>
              </div>
            )}

            {/* Inspection Result */}
            {inspectionResult && (
              <div className="mt-2 p-4 bg-indigo-500/[0.08] border border-indigo-500/20 rounded-xl">
                <h4 className="text-xs font-bold text-indigo-300 mb-1">Kết quả soi bài:</h4>
                <p className="text-xs text-white">
                  Người chơi <span className="font-bold text-purple-300">{inspectionResult.targetName}</span> là:{' '}
                  <span className={`font-bold ${inspectionResult.isWolf ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {inspectionResult.isWolf ? '🐺 PHE MA SÓI' : '💚 PHE DÂN LÀNG'}
                  </span>
                </p>
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
    </div>
  );
};
