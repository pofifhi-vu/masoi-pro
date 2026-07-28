import React, { useState } from 'react';
import { PawPrint, PlusCircle, LogIn, Sparkles, Shield, Mic, X, ArrowRight } from 'lucide-react';

interface HomeScreenProps {
  onSelectCreate: () => void;
  onSelectJoin: (roomCode: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onSelectCreate, onSelectJoin }) => {
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCodeInput.trim()) {
      onSelectJoin(joinCodeInput.trim());
    }
  };

  return (
    <div className="min-h-screen bg-[#06060e] flex flex-col items-center justify-center p-4 relative overflow-hidden noise-bg">
      {/* Ambient Background Orbs */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-purple-600/8 blur-[120px] sm:blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[10%] left-[5%] sm:left-[15%] w-[200px] sm:w-[300px] h-[200px] sm:h-[300px] bg-indigo-500/6 blur-[90px] sm:blur-[120px] rounded-full pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-sm w-full text-center z-10 flex flex-col items-center animate-slide-up px-2">
        {/* Logo */}
        <div className="relative mb-6 sm:mb-8">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[24px] sm:rounded-[28px] bg-gradient-to-br from-purple-500/20 to-indigo-500/20 p-[1px] glow-ring">
            <div className="w-full h-full bg-[#0d0d1a] rounded-[23px] sm:rounded-[27px] flex items-center justify-center">
              <PawPrint className="w-10 h-10 sm:w-12 sm:h-12 text-purple-400" strokeWidth={1.5} />
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-500 border-[3px] border-[#06060e] flex items-center justify-center">
            <span className="text-[7px] sm:text-[8px] font-black text-white">ON</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
          <span className="text-white">Ma Sói</span>
          <span className="gradient-text"> Online</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#6a6580] mb-8 sm:mb-10 max-w-[280px] leading-relaxed">
          Nền tảng chơi Ma Sói trực tuyến với công cụ Quản trò chuyên nghiệp & Voice Chat.
        </p>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={onSelectCreate}
            className="btn-primary w-full py-3.5 sm:py-4 px-6 text-white text-sm sm:text-[15px] flex items-center justify-center gap-3 group"
          >
            <PlusCircle className="w-5 h-5 transition-transform group-hover:rotate-90" />
            <span>Tạo Phòng Mới</span>
            <ArrowRight className="w-4 h-4 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all hidden sm:inline" />
          </button>

          <button
            onClick={() => setShowJoinModal(true)}
            className="w-full py-3.5 sm:py-4 px-6 rounded-[14px] bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-purple-500/30 text-[#c4bfe0] font-bold text-sm sm:text-[15px] flex items-center justify-center gap-3 transition-all duration-300"
          >
            <LogIn className="w-5 h-5 text-purple-400" />
            <span>Tham Gia Phòng</span>
          </button>
        </div>

        {/* Feature Badges */}
        <div className="mt-10 sm:mt-14 flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
          {[
            { icon: <Sparkles className="w-3.5 h-3.5" />, label: 'Admin Panel' },
            { icon: <Mic className="w-3.5 h-3.5" />, label: 'Voice Chat' },
            { icon: <Shield className="w-3.5 h-3.5" />, label: 'Bảo mật' },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.05] text-[10px] sm:text-[11px] text-[#7a7590] font-medium">
              <span className="text-purple-400/70">{f.icon}</span>
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-slide-up">
          <div className="glass-panel rounded-2xl max-w-sm w-full p-5 sm:p-7 shadow-2xl relative">
            <button
              onClick={() => setShowJoinModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 text-[#5a5572] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4 sm:mb-5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                <LogIn className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">Tham gia phòng</h3>
                <p className="text-[10px] sm:text-[11px] text-[#6a6580]">Nhập mã phòng do chủ phòng cung cấp</p>
              </div>
            </div>

            <form onSubmit={handleJoinSubmit} className="flex flex-col gap-3 sm:gap-4">
              <input
                type="text"
                value={joinCodeInput}
                onChange={e => setJoinCodeInput(e.target.value)}
                placeholder="Ví dụ: WOLF1 hoặc maphong"
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm placeholder-[#4a4560] focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.05] font-mono tracking-wide transition-all"
                autoFocus
              />

              <div className="flex items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-3 rounded-xl border border-white/[0.08] text-[#6a6580] text-xs font-semibold hover:bg-white/[0.03] transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!joinCodeInput.trim()}
                  className="flex-1 btn-primary py-3 text-white text-xs font-bold disabled:opacity-40"
                >
                  Vào phòng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
