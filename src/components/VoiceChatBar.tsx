import React, { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { MediaConnection } from 'peerjs';
import { Mic, MicOff, Volume2, VolumeX, Ghost, ShieldAlert, Wifi, ChevronDown, Users, Heart, AlertCircle, RefreshCw } from 'lucide-react';
import { Player, PlayerAudioState, RoomState } from '../types/game';
import { Socket } from 'socket.io-client';

interface VoiceChatBarProps {
  socket: Socket | null;
  roomCode: string;
  currentPlayer: Player | null;
  room?: RoomState | null;
}

export const VoiceChatBar: React.FC<VoiceChatBarProps> = ({ socket, roomCode, currentPlayer, room }) => {
  const [audioState, setAudioState] = useState<PlayerAudioState>({
    mic: true,
    livingSpeaker: true,
    deadSpeaker: false
  });
  const [hostMicTarget, setHostMicTarget] = useState<'ALL' | 'LIVING_ONLY' | 'DEAD_ONLY'>('ALL');
  const [showHostMicMenu, setShowHostMicMenu] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Đang mở Mic...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [connectedPeers, setConnectedPeers] = useState(0);

  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const activeCallsRef = useRef<Map<string, MediaConnection>>(new Map());
  const myPeerIdRef = useRef<string | null>(null);

  // VAD Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const rafRef = useRef<number>(0);

  const isHost = currentPlayer?.isHost || false;
  const isDead = currentPlayer ? !currentPlayer.isAlive : false;
  const isSilenced = room?.silencedPlayerIds?.includes(currentPlayer?.id || '') || false;

  useEffect(() => {
    if (isHost || isDead) {
      setAudioState(prev => ({ ...prev, livingSpeaker: true, deadSpeaker: true }));
    } else {
      setAudioState(prev => ({ ...prev, deadSpeaker: false }));
    }
  }, [isDead, isHost]);

  // Autoplay unblocker
  useEffect(() => {
    const handler = () => {
      audioElementsRef.current.forEach(el => {
        if (el.paused && el.srcObject) el.play().catch(() => {});
      });
    };
    document.addEventListener('click', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  const applyAudioFilters = useCallback(() => {
    if (!room?.players || !socket) return;
    const me = room.players.find(p => p.socketId === socket.id || (currentPlayer && p.id === currentPlayer.id));
    const myIsHost = me?.isHost || false;
    const myIsDead = me ? !me.isAlive : false;
    const activeHostTarget = (room as any)?.hostMicTarget || hostMicTarget;

    audioElementsRef.current.forEach((audioEl, peerId) => {
      const p = room.players.find(player =>
        peerId.includes(player.id) || peerId.includes(player.socketId)
      );

      if (!p) {
        audioEl.muted = false;
        audioEl.volume = 1;
        return;
      }

      let shouldMute = false;
      if (p.audioState && p.audioState.mic === false) shouldMute = true;
      if (p.isAlive && !audioState.livingSpeaker) shouldMute = true;
      if (!p.isAlive && (!room?.isAutoHost ? !p.isHost : true) && !audioState.deadSpeaker) shouldMute = true;
      if ((!myIsHost || room?.isAutoHost) && !myIsDead && !p.isAlive && (!room?.isAutoHost ? !p.isHost : true)) shouldMute = true;
      if (p.isHost) {
        if (activeHostTarget === 'LIVING_ONLY' && myIsDead) shouldMute = true;
        if (activeHostTarget === 'DEAD_ONLY' && !myIsDead) shouldMute = true;
      }

      audioEl.muted = shouldMute;
      audioEl.volume = shouldMute ? 0 : 1;
      if (!shouldMute && audioEl.paused && audioEl.srcObject) {
        audioEl.play().catch(() => {});
      }
    });
  }, [room, audioState, hostMicTarget, socket, currentPlayer]);

  useEffect(() => { applyAudioFilters(); }, [applyAudioFilters]);

  // Audio Monitor cho VAD
  const startAudioMonitor = useCallback(() => {
    if (rafRef.current) return;
    const checkVolume = () => {
      analysersRef.current.forEach((analyser, peerId) => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const isSpeaking = avg > 5; // Ngưỡng nói
        
        // Trích xuất playerId từ peerId (masoi_roomcode_playerId)
        const parts = peerId.split('_');
        const pId = parts.length >= 3 ? parts.slice(2).join('_') : peerId;
        
        window.dispatchEvent(new CustomEvent('player_speaking', {
          detail: { playerId: pId, isSpeaking }
        }));
      });
      rafRef.current = requestAnimationFrame(checkVolume);
    };
    checkVolume();
  }, []);

  const attachRemoteStream = useCallback((peerId: string, remoteStream: MediaStream) => {
    let audioEl = audioElementsRef.current.get(peerId);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = `peer_audio_${peerId.replace(/[^a-zA-Z0-9]/g, '_')}`;
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      (audioEl as any).setAttribute('playsinline', '');
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      audioElementsRef.current.set(peerId, audioEl);
    }
    audioEl.srcObject = remoteStream;
    audioEl.play().catch(() => {});
    
    // Gắn Analyser cho VAD
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) audioCtxRef.current = new AudioContextClass();
    }
    if (audioCtxRef.current) {
      try {
        const source = audioCtxRef.current.createMediaStreamSource(remoteStream);
        const analyser = audioCtxRef.current.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analysersRef.current.set(peerId, analyser);
        startAudioMonitor();
      } catch (e) {
        console.warn('[VAD] AudioContext error for remote stream:', e);
      }
    }

    setConnectedPeers(audioElementsRef.current.size);
    applyAudioFilters();
  }, [applyAudioFilters, startAudioMonitor]);

  // Call a remote peer
  const callPeer = useCallback((remotePeerId: string) => {
    const peer = peerRef.current;
    const stream = localStreamRef.current;
    if (!peer || !stream || peer.destroyed) return;
    if (remotePeerId === myPeerIdRef.current) return; // don't call self
    if (activeCallsRef.current.has(remotePeerId)) return; // already connected

    console.log('[Voice] Calling peer:', remotePeerId);
    try {
      const call = peer.call(remotePeerId, stream);
      if (!call) return;

      activeCallsRef.current.set(remotePeerId, call);

      call.on('stream', (remoteStream: MediaStream) => {
        console.log('[Voice] Got audio stream from:', remotePeerId);
        attachRemoteStream(remotePeerId, remoteStream);
      });

      call.on('close', () => {
        const el = audioElementsRef.current.get(remotePeerId);
        if (el) { el.pause(); el.srcObject = null; el.remove(); audioElementsRef.current.delete(remotePeerId); }
        activeCallsRef.current.delete(remotePeerId);
        setConnectedPeers(audioElementsRef.current.size);
      });

      call.on('error', (err: any) => {
        console.warn('[Voice] Call error:', err);
        activeCallsRef.current.delete(remotePeerId);
      });
    } catch (e) {
      console.warn('[Voice] callPeer exception:', e);
    }
  }, [attachRemoteStream]);

  // Main init
  const initVoice = useCallback(async () => {
    if (!socket || !roomCode) return;

    const myId = currentPlayer?.id || socket.id || ('u' + Math.random().toString(36).slice(2, 8));
    const peerId = `masoi_${roomCode.trim().toLowerCase()}_${myId}`;

    try {
      setErrorMsg(null);
      setIsConnected(false);
      setConnectionStatus('Đang mở Mic...');

      // 1. Mic permission
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        localStreamRef.current = stream;
        
        // Gắn Analyser cho Mic của bản thân
        if (!audioCtxRef.current) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) audioCtxRef.current = new AudioContextClass();
        }
        if (audioCtxRef.current) {
          try {
            const source = audioCtxRef.current.createMediaStreamSource(stream);
            const analyser = audioCtxRef.current.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analysersRef.current.set(peerId, analyser);
            startAudioMonitor();
          } catch (e) {
            console.warn('[VAD] Local mic analyser error:', e);
          }
        }
      } catch (e: any) {
        setErrorMsg('Chưa cấp quyền Micro');
        setConnectionStatus('Cần quyền Mic');
        return;
      }

      setConnectionStatus('Đang kết nối Voice...');

      // Cleanup old
      if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; }
      activeCallsRef.current.forEach(c => c.close());
      activeCallsRef.current.clear();
      audioElementsRef.current.forEach(el => { el.pause(); el.srcObject = null; el.remove(); });
      audioElementsRef.current.clear();

      // 2. Create PeerJS peer
      const peer = new Peer(peerId, { debug: 0 });
      peerRef.current = peer;
      myPeerIdRef.current = peerId;

      peer.on('open', (id) => {
        console.log('[Voice] PeerJS open:', id);
        setIsConnected(true);
        setErrorMsg(null);
        setConnectionStatus('Voice Sẵn Sàng 🟢');

        // Broadcast my peerId to room via Socket.io
        socket.emit('voice_peer_ready', { roomCode: roomCode.trim().toLowerCase(), peerId: id });
      });

      peer.on('error', (err: any) => {
        console.warn('[Voice] PeerJS error:', err.type, err.message);
        // "unavailable-id" = peer ID already taken (page reload) - retry with new ID
        if (err.type === 'unavailable-id') {
          const retryId = peerId + '_' + Date.now().toString(36);
          myPeerIdRef.current = retryId;
          const retryPeer = new Peer(retryId, { debug: 0 });
          peerRef.current = retryPeer;

          retryPeer.on('open', (id) => {
            setIsConnected(true);
            setErrorMsg(null);
            setConnectionStatus('Voice Sẵn Sàng 🟢');
            socket.emit('voice_peer_ready', { roomCode: roomCode.trim().toLowerCase(), peerId: id });
          });

          retryPeer.on('call', (call) => {
            call.answer(stream);
            activeCallsRef.current.set(call.peer, call);
            call.on('stream', (rs: MediaStream) => attachRemoteStream(call.peer, rs));
            call.on('close', () => {
              audioElementsRef.current.get(call.peer)?.remove();
              audioElementsRef.current.delete(call.peer);
              activeCallsRef.current.delete(call.peer);
              setConnectedPeers(audioElementsRef.current.size);
            });
          });

          retryPeer.on('error', (e2: any) => {
            console.warn('[Voice] Retry peer error:', e2);
            setIsConnected(true);
            setConnectionStatus('Voice Sẵn Sàng 🟢');
          });
        } else {
          setIsConnected(true);
          setConnectionStatus('Voice Sẵn Sàng 🟢');
        }
      });

      // 3. Handle incoming calls
      peer.on('call', (call) => {
        console.log('[Voice] Incoming call from:', call.peer);
        call.answer(stream);
        activeCallsRef.current.set(call.peer, call);

        call.on('stream', (remoteStream: MediaStream) => {
          console.log('[Voice] Got audio from incoming:', call.peer);
          attachRemoteStream(call.peer, remoteStream);
        });

        call.on('close', () => {
          const el = audioElementsRef.current.get(call.peer);
          if (el) { el.pause(); el.srcObject = null; el.remove(); audioElementsRef.current.delete(call.peer); }
          activeCallsRef.current.delete(call.peer);
          setConnectedPeers(audioElementsRef.current.size);
        });
      });

      // 4. Listen for other peers joining via Socket.io signaling
      socket.on('voice_peer_joined', ({ peerId: remotePeerId }: { peerId: string }) => {
        console.log('[Voice] Peer joined notification:', remotePeerId);
        // Small delay to ensure remote peer is fully ready
        setTimeout(() => callPeer(remotePeerId), 500);
      });

      // 5. Listen for peer leaving
      socket.on('voice_peer_left', ({ peerId: remotePeerId }: { peerId: string }) => {
        console.log('[Voice] Peer left:', remotePeerId);
        const call = activeCallsRef.current.get(remotePeerId);
        if (call) call.close();
        const el = audioElementsRef.current.get(remotePeerId);
        if (el) { el.pause(); el.srcObject = null; el.remove(); audioElementsRef.current.delete(remotePeerId); }
        activeCallsRef.current.delete(remotePeerId);
        analysersRef.current.delete(remotePeerId); // Xóa khỏi VAD
        setConnectedPeers(audioElementsRef.current.size);
      });

    } catch (err: any) {
      console.error('[Voice] Init error:', err);
      setErrorMsg(err?.message || 'Lỗi khởi tạo Voice');
      setConnectionStatus('Lỗi Voice');
    }
  }, [socket, roomCode, currentPlayer?.id, callPeer, attachRemoteStream]);

  // Init on mount, cleanup on unmount
  useEffect(() => {
    initVoice();

    return () => {
      if (socket) {
        socket.off('voice_peer_joined');
        socket.off('voice_peer_left');
        if (myPeerIdRef.current) {
          socket.emit('voice_peer_leaving', { roomCode: roomCode?.trim().toLowerCase(), peerId: myPeerIdRef.current });
        }
      }
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
      activeCallsRef.current.forEach(c => c.close());
      activeCallsRef.current.clear();
      if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
      if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; }
      audioElementsRef.current.forEach(el => { el.pause(); el.srcObject = null; el.remove(); });
      audioElementsRef.current.clear();
      analysersRef.current.clear();
      setIsConnected(false);
    };
  }, [roomCode, currentPlayer?.id]);

  // Mic toggle
  const toggleMic = () => {
    if (isSilenced) return; // Không cho bật mic nếu bị cấm khẩu
    const next = !audioState.mic;
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = next; });
    const newState = { ...audioState, mic: next };
    setAudioState(newState);
    if (socket && roomCode) socket.emit('toggle_audio_state', { roomCode, audioState: newState });
  };

  const selectHostMicTarget = (target: 'ALL' | 'LIVING_ONLY' | 'DEAD_ONLY') => {
    setHostMicTarget(target);
    setShowHostMicMenu(false);
    if (socket && roomCode) socket.emit('host_mic_target_changed', { roomCode, target });
  };

  const toggleLivingSpeaker = () => {
    const newState = { ...audioState, livingSpeaker: !audioState.livingSpeaker };
    setAudioState(newState);
    if (socket && roomCode) socket.emit('toggle_audio_state', { roomCode, audioState: newState });
  };

  const toggleDeadSpeaker = () => {
    const newState = { ...audioState, deadSpeaker: !audioState.deadSpeaker };
    setAudioState(newState);
    if (socket && roomCode) socket.emit('toggle_audio_state', { roomCode, audioState: newState });
  };

  const targetLabels: Record<string, string> = { ALL: 'Tất cả', LIVING_ONLY: 'Người sống', DEAD_ONLY: 'Người chết' };

  return (
    <div className="fixed bottom-[calc(1rem+var(--sab))] left-1/2 -translate-x-1/2 z-50 glass-panel rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-2xl flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-semibold max-w-[96vw] overflow-x-auto scrollbar-none">
      {/* Player info */}
      <div className="flex items-center gap-1.5 sm:gap-2 border-r border-white/[0.06] pr-2.5 sm:pr-3 shrink-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${
          !isConnected ? 'bg-amber-400' : audioState.mic ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
        }`} />
        <span className="text-[#8a85a0] truncate max-w-[80px] sm:max-w-[100px]">{currentPlayer?.name || 'Bạn'}</span>
        <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
          isHost ? 'bg-amber-500/10 text-amber-300 border border-amber-500/15' :
          isDead ? 'bg-rose-500/10 text-rose-300 border border-rose-500/15' :
          'bg-emerald-500/10 text-emerald-300 border border-emerald-500/15'
        }`}>
          {isHost ? '👑' : isDead ? '👻' : '💚'}
        </span>
      </div>

      {/* Mic */}
      <div className="relative flex items-center shrink-0">
        <button onClick={toggleMic} disabled={isSilenced} className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 transition-all ${isHost ? 'rounded-l-xl' : 'rounded-xl'} ${
          isSilenced
            ? 'bg-rose-900/40 text-rose-500 border border-rose-500/10 cursor-not-allowed opacity-80'
            : audioState.mic
              ? 'bg-purple-500/10 text-purple-300 border border-purple-500/15 hover:bg-purple-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/15 hover:bg-rose-500/20'
        }`} title={isSilenced ? 'Bạn đã bị Pháp sư cấm khẩu hôm nay!' : ''}>
          {isSilenced ? <MicOff className="w-3.5 h-3.5 text-rose-500" /> : audioState.mic ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          <span>{isSilenced ? 'Bị Cấm Khẩu' : audioState.mic ? 'Mic On' : 'Mic Off'}</span>
          {isHost && <span className="text-[9px] text-amber-300/80 ml-0.5 hidden sm:inline">({targetLabels[hostMicTarget]})</span>}
        </button>

        {isHost && (
          <button onClick={() => setShowHostMicMenu(!showHostMicMenu)}
            className="px-1.5 py-1.5 bg-purple-500/10 border border-l-0 border-purple-500/15 rounded-r-xl text-purple-300 hover:bg-purple-500/20 transition-all">
            <ChevronDown className="w-3 h-3" />
          </button>
        )}

        {isHost && showHostMicMenu && (
          <div className="absolute bottom-full mb-2 left-0 glass-panel rounded-xl shadow-2xl overflow-hidden z-50 w-44 sm:w-48 p-1">
            <div className="text-[9px] font-bold text-[#5a5572] px-2.5 py-1.5 uppercase tracking-[0.15em]">Phát tới:</div>
            {([
              { key: 'ALL' as const, icon: <Users className="w-3.5 h-3.5 text-amber-400" />, label: 'Tất cả mọi người' },
              { key: 'LIVING_ONLY' as const, icon: <Heart className="w-3.5 h-3.5 text-emerald-400" />, label: 'Chỉ Người Sống' },
              { key: 'DEAD_ONLY' as const, icon: <Ghost className="w-3.5 h-3.5 text-indigo-400" />, label: 'Chỉ Người Chết' },
            ]).map(opt => (
              <button key={opt.key} onClick={() => selectHostMicTarget(opt.key)}
                className={`w-full px-2.5 py-2 rounded-lg text-left text-[10px] sm:text-[11px] font-semibold flex items-center gap-2 transition-colors ${
                  hostMicTarget === opt.key ? 'bg-purple-500/20 text-white' : 'text-[#8a85a0] hover:bg-[#ffffff0a]'
                }`}>
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Living Speaker */}
      <button onClick={toggleLivingSpeaker} className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all shrink-0 ${
        audioState.livingSpeaker
          ? 'bg-blue-500/10 text-blue-300 border border-blue-500/15 hover:bg-blue-500/20'
          : 'bg-white/[0.03] text-[#5a5572] border border-white/[0.06] hover:bg-white/[0.05]'
      }`}>
        {audioState.livingSpeaker ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">{audioState.livingSpeaker ? 'Sống: Bật' : 'Sống: Tắt'}</span>
      </button>

      {/* Dead Speaker */}
      <button onClick={toggleDeadSpeaker} disabled={!isDead && !isHost}
        className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all shrink-0 ${
          audioState.deadSpeaker
            ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/15 hover:bg-indigo-500/20'
            : 'bg-white/[0.03] text-[#5a5572] border border-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed'
        }`}
        title={!isDead && !isHost ? 'Người sống không thể nghe người chết' : ''}>
        <Ghost className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{audioState.deadSpeaker ? 'Chết: Bật' : 'Chết: Khóa'}</span>
      </button>

      {/* Status Badge */}
      <div onClick={initVoice} className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] cursor-pointer hover:opacity-80 transition-all shrink-0 ${
        isConnected
          ? 'bg-emerald-500/[0.06] border border-emerald-500/10 text-emerald-400/80'
          : 'bg-amber-500/[0.06] border border-amber-500/10 text-amber-400/80'
      }`} title="Bấm để kết nối lại Voice">
        <Wifi className={`w-3 h-3 ${isConnected ? 'animate-pulse' : ''}`} />
        <span className="truncate max-w-[90px] sm:max-w-none">{errorMsg ? `Lỗi: ${errorMsg}` : connectionStatus}</span>
        {connectedPeers > 0 && <span className="text-[9px] text-emerald-300/60">({connectedPeers})</span>}
        {!isConnected && <RefreshCw className="w-3 h-3 ml-0.5 animate-spin" />}
      </div>

      {isDead && (
        <div className="hidden md:flex items-center gap-1 px-2 py-1 bg-amber-500/[0.06] border border-amber-500/10 text-amber-300/80 rounded-lg text-[10px] shrink-0">
          <ShieldAlert className="w-3 h-3" />
          <span>Hồn ma</span>
        </div>
      )}
    </div>
  );
};
