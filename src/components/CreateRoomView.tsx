import React, { useState, useMemo } from 'react';
import {
  User, Eye, Shield, FlaskConical, Zap, Accessibility, Heart, MicOff,
  PawPrint, Search, VolumeX, Smile, Frown, Skull, RotateCcw, Sparkles,
  ChevronDown, ChevronUp, Link as LinkIcon, Users, Play, ArrowLeft
} from 'lucide-react';
import { ALL_ROLES, PRESET_CONFIGS } from '../constants/roles';
import { RoleDef } from '../types/game';

interface CreateRoomViewProps {
  onCreateRoom: (customCode: string, roleConfig: Record<string, number>, playerNamesText: string) => void;
  onBackToHome: () => void;
}

export const CreateRoomView: React.FC<CreateRoomViewProps> = ({ onCreateRoom, onBackToHome }) => {
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    ALL_ROLES.forEach(r => { initial[r.key] = 0; });
    return initial;
  });

  const [playerNamesText, setPlayerNamesText] = useState<string>('');
  const [customRoomCode, setCustomRoomCode] = useState<string>('');
  const [showCustomCodeMenu, setShowCustomCodeMenu] = useState<boolean>(false);
  const [showPresetsMenu, setShowPresetsMenu] = useState<boolean>(false);

  const renderRoleIcon = (iconName: string, faction: string) => {
    const colorMap: Record<string, string> = {
      VILLAGER: 'text-blue-400',
      WEREWOLF: 'text-rose-400',
      NEUTRAL: 'text-amber-400',
    };
    const cls = `w-5 h-5 ${colorMap[faction] || 'text-gray-400'}`;
    switch (iconName) {
      case 'User': return <User className={cls} />;
      case 'Eye': return <Eye className={cls} />;
      case 'Shield': return <Shield className={cls} />;
      case 'FlaskConical': return <FlaskConical className={cls} />;
      case 'Zap': return <Zap className={cls} />;
      case 'Accessibility': return <Accessibility className={cls} />;
      case 'Heart': return <Heart className={cls} />;
      case 'MicOff': return <MicOff className={cls} />;
      case 'PawPrint': return <PawPrint className={cls} />;
      case 'Search': return <Search className={cls} />;
      case 'VolumeX': return <VolumeX className={cls} />;
      case 'Smile': return <Smile className={cls} />;
      case 'Frown': return <Frown className={cls} />;
      case 'Skull': return <Skull className={cls} />;
      default: return <User className={cls} />;
    }
  };

  const updateCount = (key: string, delta: number) => {
    setRoleCounts(prev => {
      const current = prev[key] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [key]: next };
    });
  };

  const handleResetConfig = () => {
    const res: Record<string, number> = {};
    ALL_ROLES.forEach(r => { res[r.key] = 0; });
    setRoleCounts(res);
  };

  const applyPreset = (config: Record<string, number>) => {
    const res: Record<string, number> = {};
    ALL_ROLES.forEach(r => {
      res[r.key] = config[r.key] || 0;
    });
    setRoleCounts(res);
    setShowPresetsMenu(false);
  };

  const totalRoles = useMemo(() => Object.values(roleCounts).reduce((a, b) => a + b, 0), [roleCounts]);

  const parsedPlayersList = useMemo(() => {
    return playerNamesText.split('\n').map(s => s.trim()).filter(Boolean);
  }, [playerNamesText]);

  const totalPlayersCount = parsedPlayersList.length;

  const statusText = useMemo(() => {
    if (totalRoles === 0) return 'Chưa chọn vai trò';
    if (totalPlayersCount === 0) return 'Chưa có người chơi';
    if (totalPlayersCount < totalRoles) return `Cần thêm ${totalRoles - totalPlayersCount} người chơi`;
    if (totalPlayersCount > totalRoles) return `Dư ${totalPlayersCount - totalRoles} người chơi so với bài`;
    return 'Sẵn sàng chia bài & bắt đầu';
  }, [totalRoles, totalPlayersCount]);

  const handleCreateSubmit = () => {
    onCreateRoom(customRoomCode, roleCounts, playerNamesText);
  };

  const villagerRoles = ALL_ROLES.filter(r => r.faction === 'VILLAGER');
  const werewolfRoles = ALL_ROLES.filter(r => r.faction === 'WEREWOLF');
  const neutralRoles = ALL_ROLES.filter(r => r.faction === 'NEUTRAL');

  const RoleCard = ({ role }: { role: RoleDef }) => (
    <div className="role-card p-3.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          role.faction === 'WEREWOLF' ? 'bg-rose-500/8 border border-rose-500/15' :
          role.faction === 'NEUTRAL' ? 'bg-amber-500/8 border border-amber-500/15' :
          'bg-blue-500/8 border border-blue-500/15'
        }`}>
          {renderRoleIcon(role.iconName, role.faction)}
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-white truncate">{role.name}</h4>
          <p className="text-[11px] text-[#6a6580] truncate">{role.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 bg-white/[0.02] p-1 rounded-xl border border-white/[0.05]">
        <button
          onClick={() => updateCount(role.key, -1)}
          className="counter-btn w-7 h-7 rounded-lg flex items-center justify-center text-sm"
        >
          −
        </button>
        <span className="w-7 text-center text-xs font-extrabold text-purple-200">
          {roleCounts[role.key] || 0}
        </span>
        <button
          onClick={() => updateCount(role.key, 1)}
          className="counter-btn w-7 h-7 rounded-lg flex items-center justify-center text-sm"
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06060e] text-[#f1f0f7] pb-voice-bar noise-bg">
      {/* Header */}
      <header className="px-3 sm:px-6 py-3 sm:py-4 border-b border-white/[0.04] flex items-center justify-between glass-panel sticky top-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group" onClick={onBackToHome}>
          <ArrowLeft className="w-4 h-4 text-[#6a6580] group-hover:text-white transition-colors" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center">
              <PawPrint className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
            </div>
            <h1 className="text-base sm:text-lg font-bold text-white">
              Ma Sói <span className="gradient-text">Online</span>
            </h1>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.05] text-[11px] text-[#6a6580] font-medium">
          <Sparkles className="w-3.5 h-3.5 text-purple-400/70" />
          <span>Công cụ Quản trò</span>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left Column */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="glass-panel rounded-2xl p-5 flex flex-col flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400/70" />
                Danh sách người chơi
              </h2>
              <span className="text-[11px] bg-purple-500/10 text-purple-300 border border-purple-500/15 px-2.5 py-1 rounded-full font-bold">
                {totalPlayersCount}
              </span>
            </div>

            <textarea
              value={playerNamesText}
              onChange={e => setPlayerNamesText(e.target.value)}
              placeholder={`Nhập tên từng người, mỗi người một dòng:\nAn\nBình\nCường\n...`}
              className="w-full flex-1 min-h-[280px] p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl text-sm text-white placeholder-[#3a3550] focus:outline-none focus:border-purple-500/40 font-mono resize-none leading-relaxed transition-all"
            />

            {/* Presets */}
            <div className="mt-4 flex flex-col gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowPresetsMenu(!showPresetsMenu)}
                  className="w-full py-2.5 px-4 rounded-xl bg-purple-500/[0.06] hover:bg-purple-500/[0.12] border border-purple-500/10 text-purple-200 text-xs font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  Cấu hình gợi ý
                  <ChevronDown className="w-3.5 h-3.5 text-purple-400 ml-auto" />
                </button>

                {showPresetsMenu && (
                  <div className="absolute bottom-full mb-2 left-0 right-0 glass-panel rounded-xl shadow-2xl overflow-hidden z-20">
                    {PRESET_CONFIGS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => applyPreset(preset.config)}
                        className="w-full text-left px-4 py-3 text-xs text-[#c4bfe0] hover:bg-purple-500/10 border-b border-white/[0.04] last:border-0 flex items-center justify-between transition-colors"
                      >
                        <span className="font-semibold">{preset.name}</span>
                        <span className="text-[10px] text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/15 font-bold">Áp dụng</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleResetConfig}
                className="w-full py-2 px-4 rounded-xl text-[#5a5572] hover:text-white hover:bg-white/[0.03] text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Đặt lại cấu hình
              </button>
            </div>
          </div>

          {/* Custom Room Code */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowCustomCodeMenu(!showCustomCodeMenu)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-all"
            >
              <div className="flex items-center gap-2.5">
                <LinkIcon className="w-4 h-4 text-purple-400/70" />
                <span className="text-xs font-bold text-[#c4bfe0]">Tùy chỉnh mã phòng</span>
              </div>
              {showCustomCodeMenu ? <ChevronUp className="w-4 h-4 text-[#5a5572]" /> : <ChevronDown className="w-4 h-4 text-[#5a5572]" />}
            </button>

            {showCustomCodeMenu && (
              <div className="px-5 pb-5 pt-0 border-t border-white/[0.04] flex flex-col gap-3">
                <p className="text-[11px] text-[#6a6580] leading-relaxed">
                  Đặt mã phòng tùy thích (ví dụ: <code className="text-purple-300 bg-purple-500/10 px-1 rounded">phongchoidua</code>). Để trống = tự tạo.
                </p>
                <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] rounded-xl px-3 py-2.5">
                  <span className="text-xs text-purple-400/70 font-mono select-none">masoi.pofifhi.qzz.io/</span>
                  <input
                    type="text"
                    value={customRoomCode}
                    onChange={e => setCustomRoomCode(e.target.value)}
                    placeholder="maphong"
                    className="bg-transparent text-xs text-white placeholder-[#3a3550] font-mono outline-none flex-1"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Roles */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Villagers */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full bg-blue-500" />
              <h3 className="text-sm font-bold text-white">Phe Dân làng</h3>
              <span className="text-[10px] text-blue-300/60 font-medium ml-1">({villagerRoles.length} vai trò)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {villagerRoles.map(role => <RoleCard key={role.key} role={role} />)}
            </div>
          </section>

          {/* Werewolves */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full bg-rose-500" />
              <h3 className="text-sm font-bold text-rose-300">Phe Sói</h3>
              <span className="text-[10px] text-rose-400/60 font-medium ml-1">({werewolfRoles.length} vai trò)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {werewolfRoles.map(role => <RoleCard key={role.key} role={role} />)}
            </div>
          </section>

          {/* Neutral */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full bg-amber-500" />
              <h3 className="text-sm font-bold text-amber-300">Phe Thứ Ba & Khác</h3>
              <span className="text-[10px] text-amber-400/60 font-medium ml-1">({neutralRoles.length} vai trò)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {neutralRoles.map(role => <RoleCard key={role.key} role={role} />)}
            </div>
          </section>
        </div>
      </main>

      {/* Bottom Summary Bar */}
      <footer className="fixed bottom-0 left-0 right-0 glass-panel border-t border-white/[0.06] px-3 sm:px-6 py-3 sm:py-4 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-4 sm:gap-6 text-xs w-full sm:w-auto justify-center sm:justify-start">
            <div className="flex flex-col">
              <span className="text-[10px] text-[#5a5572] uppercase font-bold tracking-[0.15em]">Vai trò</span>
              <span className="text-base font-black text-white">{totalRoles}</span>
            </div>

            <div className="w-px h-8 bg-white/[0.06]" />

            <div className="flex flex-col">
              <span className="text-[10px] text-[#5a5572] uppercase font-bold tracking-[0.15em]">Người chơi</span>
              <span className="text-base font-black text-white">{totalPlayersCount}</span>
            </div>

            <div className="w-px h-8 bg-white/[0.06]" />

            <div className="flex flex-col">
              <span className="text-[10px] text-[#5a5572] uppercase font-bold tracking-[0.15em]">Trạng thái</span>
              <span className={`text-xs font-bold ${totalRoles > 0 && totalPlayersCount === totalRoles ? 'text-emerald-400' : 'text-rose-400'}`}>
                {statusText}
              </span>
            </div>
          </div>

          <button
            onClick={handleCreateSubmit}
            disabled={totalRoles === 0}
            className="btn-primary w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 text-white text-sm flex items-center justify-center gap-2.5 group"
          >
            <Sparkles className="w-4 h-4" />
            <span>Tạo phòng & Chia bài</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
