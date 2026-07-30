import React, { useState, useEffect } from 'react';
import { ExternalLink, ShieldAlert } from 'lucide-react';

export const InAppBrowserBlocker: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInApp, setIsInApp] = useState(false);
  const [isBypassed, setIsBypassed] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [os, setOs] = useState<'android' | 'ios' | 'other'>('other');

  useEffect(() => {
    // Check if bypassed in session
    if (sessionStorage.getItem('inapp_bypass') === 'true') {
      setIsBypassed(true);
      return;
    }

    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    
    // Detect OS
    if (/android/i.test(ua)) {
      setOs('android');
    } else if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
      setOs('ios');
    }

    // Detect In-App Browsers
    const rules = ['FBAV', 'FBAN', 'Messenger', 'Zalo', 'Instagram', 'Line', 'MicroMessenger', 'TikTok'];
    const isMatched = rules.some(rule => ua.includes(rule));

    if (isMatched) {
      setIsInApp(true);
    }
  }, []);

  const handleHiddenTap = () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if (newCount >= 5) {
      setIsBypassed(true);
      sessionStorage.setItem('inapp_bypass', 'true');
    }
  };

  const handleOpenBrowser = () => {
    const url = window.location.href;
    if (os === 'android') {
      // Intent scheme for Android Chrome
      const intentUrl = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end;`;
      window.location.href = intentUrl;
    } else {
      // For iOS and others, just show alert since there is no standard intent that escapes smoothly in all cases
      alert('Vui lòng nhấn vào biểu tượng dấu 3 chấm (hoặc tùy chọn) ở góc phải phía trên màn hình và chọn "Mở bằng trình duyệt" hoặc "Mở bằng Safari".');
    }
  };

  if (isInApp && !isBypassed) {
    return (
      <div className="min-h-screen bg-[#06060e] text-[#f1f0f7] flex flex-col items-center justify-center p-6 relative noise-bg overflow-hidden">
        {/* Hidden bypass area - top left 100x100 pixels */}
        <div 
          onClick={handleHiddenTap}
          className="absolute top-0 left-0 w-24 h-24 z-50 cursor-default"
        />

        {/* Ambient Background */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-rose-600/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center relative z-10 border-rose-500/20 animate-slide-up">
          <div className="w-20 h-20 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(244,63,94,0.2)]">
            <ShieldAlert className="w-10 h-10 text-rose-400" />
          </div>

          <h2 className="text-2xl font-black text-white mb-3">Trình duyệt<br/>không hỗ trợ</h2>
          
          <p className="text-sm text-[#8a85a0] leading-relaxed mb-6">
            Bạn đang mở game bằng trình duyệt của Zalo, Messenger hoặc Facebook. Để âm thanh và kết nối ổn định nhất, <strong>vui lòng mở bằng trình duyệt gốc (Safari, Chrome)</strong>.
          </p>

          <button
            onClick={handleOpenBrowser}
            className="w-full rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)] hover:shadow-[0_0_30px_rgba(244,63,94,0.5)] transition-all py-4 text-white text-sm font-bold flex items-center justify-center gap-2 mb-4"
          >
            <ExternalLink className="w-5 h-5" />
            <span>
              {os === 'android' ? 'Mở trong Chrome / Trình duyệt' : 'Mở trong Safari'}
            </span>
          </button>

          <p className="text-[11px] text-[#5a5572] px-4">
            Nếu nút trên không hoạt động, hãy nhấn vào <strong>dấu 3 chấm ở góc trên màn hình</strong> và chọn <strong>"Mở bằng trình duyệt"</strong>.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
