import React, { useState } from 'react';
import { Users, Copy, Check, Play, ShieldAlert, Sparkles, User, ArrowLeft, Crown, Wifi } from 'lucide-react';
import { RoomState, Player } from '../types/game';

interface LobbyRoomProps {
  room: RoomState;
  currentPlayer: Player | null;
  onJoinWithName: (name: string) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

export const LobbyRoom: React.FC<LobbyRoomProps> = ({
  room,
  currentPlayer,
  onJoinWithName,
  onStartGame,
  onLeaveRoom
}) => {
  const [inputName, setInputName] = useState('');
  const [copied, setCopied] = useState(false);

  const roleConfig = room?.roleConfig || {};
  const playersList = room?.players || [];

  const totalRolesRequired = Object.values(roleConfig).reduce((a, b) => a + b, 0);
  const currentPlayersCount = playersList.length;
  const playingMembersCount = playersList.filter(p => !p.isHost).length;
  const isFull = playingMembersCount >= totalRolesRequired && totalRolesRequired > 0;
  const isHost = currentPlayer?.isHost || false;
  const missingPlayersCount = Math.max(0, totalRolesRequired - playingMembersCount);

  const handleCopyLink = () => {
    const origin = window.location.origin.includes('localhost') ? window.location.origin : 'https://masoi.pofifhi.qzz.io';
    const url = `${origin}?room=${room.code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Name entry gate
  if (!currentPlayer) {
    return (
      <div className="min-h-screen bg-[#06060e] flex items-center justify-center p-4 noise-bg">
        <div className="glass-panel rounded-2xl p-8 max-w-sm w-full text-center animate-slide-up">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-5">
            <User className="w-7 h-7 text-purple-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Tham gia phòng</h2>
          <p className="text-xs text-[#6a6580] mb-6">
            Mã phòng: <span className="text-purple-300 font-mono font-bold tracking-wider">{room.code}</span>
          </p>

          <form
            onSubmit={e => {
              e.preventDefault();
              if (inputName.trim()) onJoinWithName(inputName.trim());
            }}
            className="flex flex-col gap-4"
          >
            <input
              type="text"
              value={inputName}
              onChange={e => setInputName(e.target.value)}
              placeholder="Nhập tên hiển thị của bạn..."
              className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm placeholder-[#4a4560] focus:outline-none focus:border-purple-500/50 font-semibold transition-all"
              autoFocus
            />
            <button
              type="submit"
              disabled={!inputName.trim()}
              className="btn-primary py-3.5 text-white text-sm font-bold"
            >
              Vào Phòng Chờ
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06060e] text-[#f1f0f7] p-4 sm:p-6 flex flex-col max-w-5xl mx-auto noise-bg">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.04] animate-slide-up">
        <button
          onClick={onLeaveRoom}
          className="flex items-center gap-2 text-xs text-[#6a6580] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Rời phòng</span>
        </button>

        <div className="flex items-center gap-2.5 glass-panel rounded-full px-4 py-2">
          <span className="text-[11px] text-[#6a6580]">Phòng</span>
          <span className="text-sm font-mono font-extrabold text-purple-300 tracking-wider">{room.code}</span>
          <button
            onClick={handleCopyLink}
            className="p-1 hover:bg-white/5 rounded-lg transition-colors text-purple-400"
            title="Sao chép đường dẫn"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 flex-1 flex flex-col animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
              Phòng chờ
              {isHost && (
                <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Quản trò
                </span>
              )}
            </h2>
            <p className="text-xs text-[#6a6580] mt-1">
              Đang chờ đủ {totalRolesRequired} người chơi nhận bài
            </p>
          </div>

          <div className="text-right">
            <div className="text-3xl font-black font-mono gradient-text">
              {playingMembersCount}<span className="text-[#3a3550] text-xl mx-1">/</span>{totalRolesRequired}
            </div>
            <div className="text-[10px] text-[#5a5572] font-medium mt-0.5">Người chơi nhận bài</div>
          </div>
        </div>

        {/* Players Grid */}
        <div className="flex-1 mb-8">
          <h3 className="text-[11px] font-bold uppercase text-[#5a5572] mb-4 tracking-[0.15em] flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-purple-400/70" />
            Thành viên ({currentPlayersCount})
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {playersList.map((p, idx) => (
              <div
                key={p.id}
                className={`p-4 rounded-xl border flex items-center gap-3.5 transition-all duration-200 ${
                  currentPlayer && p.socketId === currentPlayer.socketId
                    ? 'bg-purple-500/[0.08] border-purple-500/20 shadow-lg shadow-purple-900/10'
                    : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/10 flex items-center justify-center font-bold text-sm text-purple-300">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                    {p.name}
                    {p.isHost && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                    {currentPlayer && p.socketId === currentPlayer.socketId && (
                      <span className="text-[10px] text-purple-400 font-normal">(Bạn)</span>
                    )}
                  </div>
                  <div className="text-[11px] text-emerald-400/80 flex items-center gap-1.5 mt-0.5">
                    <Wifi className="w-3 h-3" />
                    <span>Sẵn sàng</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty Slots */}
            {Array.from({ length: missingPlayersCount }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="p-4 rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] flex items-center gap-3.5 opacity-50"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center text-xs text-[#3a3550] font-mono">
                  {currentPlayersCount + idx + 1}
                </div>
                <div className="text-xs text-[#4a4560] font-medium italic">Đang chờ...</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Action */}
        <div className="pt-5 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-[#6a6580] flex items-center gap-2">
            {!isFull ? (
              <>
                <ShieldAlert className="w-4 h-4 text-amber-400/70 shrink-0" />
                <span>Cần thêm <span className="text-amber-300 font-bold">{missingPlayersCount}</span> người nhận bài nữa</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-emerald-300 font-semibold">Đã đủ người! Sẵn sàng bắt đầu.</span>
              </>
            )}
          </div>

          {isHost ? (
            <button
              onClick={onStartGame}
              disabled={!isFull}
              className={`px-8 py-3.5 rounded-xl font-extrabold text-sm flex items-center gap-2.5 transition-all ${
                isFull
                  ? 'btn-primary text-white cursor-pointer'
                  : 'bg-white/[0.03] text-[#4a4560] border border-white/[0.06] cursor-not-allowed opacity-50'
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Bắt Đầu Trò Chơi</span>
            </button>
          ) : (
            <div className="text-xs font-medium text-purple-300/80 bg-purple-500/[0.06] border border-purple-500/10 px-5 py-3 rounded-xl">
              Đang đợi Quản trò bắt đầu...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
