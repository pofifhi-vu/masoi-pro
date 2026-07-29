import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { ALL_ROLES } from './shared/roles.js';
import { startAutoNight, onAutoPlayerAction, startAutoDayVoting, onAutoPlayerVote, stopAutoHost } from './autoHostEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 10000,
  pingInterval: 5000
});

// Serve static build from Vite 'dist' folder on production (Render)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Room State Data Structure
const rooms = {};

function generateRandomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Timestamp helper format [hh:mm:ss, dd/mm/yy]
function getFormattedTimestamp() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  return `[${hours}:${minutes}:${seconds}, ${day}/${month}/${year}]`;
}

io.on('connection', (socket) => {
  console.log(`[Socket Connected] ${socket.id}`);

  // Tín hiệu nhịp tim từ client (phòng trường hợp mất mạng / lag)
  socket.on('client_heartbeat', ({ roomCode }) => {
    if (!roomCode) return;
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (player) {
      player.lastHeartbeat = Date.now();
      if (!player.connected) {
        // Tự động phục hồi kết nối nếu trước đó bị báo mất
        player.connected = true;
        io.to(roomCode).emit('room_updated', room);
      }
    }
  });

  // Create or update room configuration
  socket.on('create_room', ({ customCode, roleConfig, hostName, initialPlayerNames, isAutoHost }, callback) => {
    let roomCode = customCode ? customCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') : '';
    if (!roomCode) {
      roomCode = generateRandomCode().toLowerCase();
    }

    if (rooms[roomCode] && rooms[roomCode].gameState !== 'LOBBY' && rooms[roomCode].hostSocketId !== socket.id) {
      return callback({ success: false, message: 'Mã phòng này đã tồn tại và đang trong trận đấu!' });
    }

    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        code: roomCode,
        hostSocketId: socket.id,
        hostName: hostName || 'Quản trò (Host)',
        roleConfig: roleConfig || {},
        players: [],
        gameState: 'LOBBY',
        currentCalledRole: null,
        nightActions: {},
        dayVotes: {},
        nightLogs: [],
        spectatorLogs: [],
        gameHistory: [],
        isAutoHost: !!isAutoHost,
        phaseTimer: undefined,
        autoHostState: undefined
      };
    } else {
      rooms[roomCode].hostSocketId = socket.id;
      rooms[roomCode].isAutoHost = !!isAutoHost;
      if (roleConfig) rooms[roomCode].roleConfig = roleConfig;
    }

    if (Array.isArray(initialPlayerNames) && initialPlayerNames.length > 0) {
      initialPlayerNames.forEach((pName, idx) => {
        const trimmed = pName.trim();
        if (trimmed && !rooms[roomCode].players.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
          rooms[roomCode].players.push({
            id: 'p_' + Math.random().toString(36).substring(2, 9),
            socketId: idx === 0 ? socket.id : 'bot_' + Math.random().toString(36).substring(2, 7),
            name: trimmed,
            isHost: idx === 0,
            isAlive: true,
            role: (idx === 0 && !isAutoHost) ? 'QUAN_TRO' : null,
            connected: true,
            audioState: {
              mic: true,
              livingSpeaker: true,
              deadSpeaker: true
            }
          });
        }
      });
    }

    socket.join(roomCode);
    socket.roomCode = roomCode;

    io.to(roomCode).emit('room_updated', rooms[roomCode]);
    callback({ success: true, roomCode, room: rooms[roomCode] });
  });

  // Join Room
  socket.on('join_room', ({ roomCode, playerName }, callback) => {
    const cleanCode = (roomCode || '').trim().toLowerCase();
    const room = rooms[cleanCode];

    if (!room) {
      return callback({ success: false, message: 'Không tìm thấy phòng chơi này!' });
    }

    const cleanName = (playerName || '').trim();
    let existingPlayer = room.players.find(p => p.socketId === socket.id || (cleanName !== '' && p.name.toLowerCase() === cleanName.toLowerCase()));

    if (existingPlayer) {
      existingPlayer.socketId = socket.id;
      existingPlayer.connected = true;
      if (cleanName) existingPlayer.name = cleanName;
      if (existingPlayer.isHost) {
        room.hostSocketId = socket.id;
      }
      if (existingPlayer.role) {
        socket.emit('your_secret_role', { role: existingPlayer.role });
      }
    } else {
      if (room.gameState !== 'LOBBY' && room.gameState !== 'ENDED') {
        return callback({ success: false, message: 'Phòng đã bắt đầu trận đấu, không thể tham gia!' });
      }

      const isHost = (socket.id === room.hostSocketId || room.players.length === 0);
      const newPlayer = {
        id: 'p_' + Math.random().toString(36).substring(2, 9),
        socketId: socket.id,
        name: cleanName || (isHost ? 'Quản trò (Host)' : `Người chơi ${room.players.length + 1}`),
        isHost: isHost,
        isAlive: true,
        role: (isHost && !room.isAutoHost) ? 'QUAN_TRO' : null,
        connected: true,
        audioState: {
          mic: true,
          livingSpeaker: true,
          deadSpeaker: true
        }
      };
      if (isHost) room.hostSocketId = socket.id;
      room.players.push(newPlayer);
    }

    socket.join(cleanCode);
    socket.roomCode = cleanCode;

    io.to(cleanCode).emit('room_updated', room);
    callback({ success: true, roomCode: cleanCode, room, player: room.players.find(p => p.socketId === socket.id) });
  });

  // Host starts game
  socket.on('start_game', ({ roomCode }, callback) => {
    const room = rooms[roomCode];
    if (!room || room.hostSocketId !== socket.id) {
      return callback({ success: false, message: 'Chỉ chủ phòng mới có quyền bắt đầu!' });
    }

    let totalRolesRequired = 0;
    const roleDeck = [];
    Object.entries(room.roleConfig).forEach(([roleKey, count]) => {
      const cnt = Number(count) || 0;
      totalRolesRequired += cnt;
      for (let i = 0; i < cnt; i++) {
        roleDeck.push(roleKey);
      }
    });

    if (totalRolesRequired === 0) {
      return callback({ success: false, message: 'Vui lòng chọn ít nhất 1 vai trò trước khi chia bài!' });
    }

    const playingMembers = room.isAutoHost ? room.players : room.players.filter(p => !p.isHost);

    if (playingMembers.length !== totalRolesRequired) {
      return callback({
        success: false,
        message: `Số người chơi tham gia (${playingMembers.length}) chưa đủ so với tổng số vai trò đã chọn (${totalRolesRequired})!`
      });
    }

    const shuffledDeck = shuffleArray(roleDeck);
    playingMembers.forEach((player, idx) => {
      player.role = shuffledDeck[idx];
      player.isAlive = true;
    });

    if (!room.isAutoHost) {
      const hostPlayer = room.players.find(p => p.isHost);
      if (hostPlayer) {
        hostPlayer.role = 'QUAN_TRO';
        hostPlayer.isAlive = true;
      }
    }

    room.gameState = 'NIGHT';
    room.currentCalledRole = null;
    room.nightActions = {};
    room.dayVotes = {};

    const startMsg = `${getFormattedTimestamp()} Trận đấu đã bắt đầu! Đêm đầu tiên buông xuống...`;
    room.nightLogs = [startMsg];
    room.spectatorLogs = [startMsg];

    io.to(roomCode).emit('game_started', room);
    io.to(roomCode).emit('room_updated', room);

    room.players.forEach(p => {
      io.to(p.socketId).emit('your_secret_role', { role: p.role });
    });

    callback({ success: true });

    if (room.isAutoHost) {
      setTimeout(() => startAutoNight(room, io, changePhaseToDay), 1000);
    }
  });

  // Host calls role in Night Phase
  socket.on('host_call_role', ({ roomCode, roleKey }) => {
    const room = rooms[roomCode];
    if (!room || room.hostSocketId !== socket.id) return;

    room.currentCalledRole = roleKey;

    let targets = [];
    if (roleKey === 'MA_SOI') {
      // All Werewolves wake up together!
      targets = room.players.filter(p => (p.role === 'MA_SOI' || (p.role && p.role.startsWith('SOI_'))) && p.isAlive && !p.isHost);
    } else {
      targets = room.players.filter(p => p.role === roleKey && p.isAlive && !p.isHost);
    }

    io.to(roomCode).emit('role_called_broadcast', { roleKey, currentCalledRole: roleKey });

    targets.forEach(t => {
      console.log(`[Host Call Role] Sending your_turn_to_act (${roleKey}) to player: ${t.name} (socket: ${t.socketId})`);
      io.to(t.socketId).emit('your_turn_to_act', { roleKey, roomState: room });
    });

    const roleDef = ALL_ROLES.find(r => r.key === roleKey);
    const roleName = roleDef ? roleDef.name : roleKey;

    const msg = `${getFormattedTimestamp()} 🌙 Quản trò gọi vai trò [${roleName}] thức dậy...`;
    room.nightLogs.push(msg);
    room.spectatorLogs.push(msg);

    io.to(room.hostSocketId).emit('night_log_updated', room.nightLogs);
    io.to(roomCode).emit('room_updated', room);
  });

  // Host resets night call — tất cả ngủ, tắt panel hành động của mọi người
  socket.on('host_reset_night_call', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.hostSocketId !== socket.id) return;

    room.currentCalledRole = null;

    const msg = `${getFormattedTimestamp()} 😴 Tất cả mọi người đã ngủ...`;
    room.nightLogs.push(msg);
    room.spectatorLogs.push(msg);

    // Broadcast để tất cả client tắt panel hành động
    io.to(roomCode).emit('phase_changed', { gameState: room.gameState, room });
    io.to(roomCode).emit('room_updated', room);
  });

  // Player submits night action (Recorded silently, NOT executed until morning!)
  socket.on('player_submit_action', ({ roomCode, actionType, targetPlayerId, targetPlayerId2, note }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const actingPlayer = room.players.find(p => p.socketId === socket.id);
    if (!actingPlayer || actingPlayer.isHost) return;

    const target1 = room.players.find(p => p.id === targetPlayerId);
    const target2 = room.players.find(p => p.id === targetPlayerId2);

    room.nightActions[actingPlayer.role] = {
      actorId: actingPlayer.id,
      actorName: actingPlayer.name,
      role: actingPlayer.role,
      actionType,
      targetPlayerId,
      targetName: target1 ? target1.name : null,
      target2Name: target2 ? target2.name : null,
      note
    };

    let logMessage = `${getFormattedTimestamp()} [HÀNH ĐỘNG ĐÊM] ${actingPlayer.name} (${actingPlayer.role})`;
    if (target1) logMessage += ` chọn mục tiêu: ${target1.name}`;
    if (target2) logMessage += ` và ${target2.name}`;

    room.nightLogs.push(logMessage);

    // Xử lý riêng cho Thần tình yêu: lưu cặp đôi vào phòng
    if (actingPlayer.role === 'THAN_TINH_YEU' && actionType !== 'SKIP' && target1 && target2) {
      room.coupledPlayers = [target1.id, target2.id];
      const coupleMsg = `${getFormattedTimestamp()} 💘 [SỰ KIỆN] Thần tình yêu đã ghép đôi ${target1.name} và ${target2.name}. Họ sẽ sống chết có nhau!`;
      room.nightLogs.push(coupleMsg);
      // Gửi role bí mật cho cả 2 để họ biết mình bị ghép đôi (tuỳ chọn, nhưng hiện tại chỉ lưu log để tính toán cái chết)
    }

    const roleDef = ALL_ROLES.find(r => r.key === actingPlayer.role);
    const roleName = roleDef ? roleDef.name : actingPlayer.role;
    room.spectatorLogs.push(`${getFormattedTimestamp()} ✨ Vai trò [${roleName}] đã hoàn thành lượt chọn.`);

    io.to(room.hostSocketId).emit('night_action_received', {
      role: actingPlayer.role,
      actor: actingPlayer.name,
      actionType,
      target: target1,
      target2,
      logs: room.nightLogs
    });

    if (actingPlayer.role === 'TIEN_TRI') {
      const isWolf = target1 && (target1.role.startsWith('MA_SOI') || target1.role.startsWith('SOI_'));
      socket.emit('inspection_result', {
        targetName: target1?.name,
        isWolf: isWolf
        // Chỉ trả về isWolf — Tiên Tri chỉ biết phe, không biết role cụ thể
      });
    } else if (actingPlayer.role === 'SOI_TIEN_TRI') {
      // Sói tiên tri thấy được đúng role cụ thể!
      const pRoleDef = ALL_ROLES.find(r => r.key === target1?.role);
      socket.emit('inspection_result', {
        targetName: target1?.name,
        isWolf: target1 && (target1.role.startsWith('MA_SOI') || target1.role.startsWith('SOI_')),
        targetRole: pRoleDef ? pRoleDef.name : target1?.role
      });
    }

    io.to(roomCode).emit('room_updated', room);
    
    if (room.isAutoHost) {
      onAutoPlayerAction(room, io, changePhaseToDay);
    }
  });

  // Host changes Mic Target Channel
  socket.on('host_mic_target_changed', ({ roomCode, target }) => {
    const room = rooms[roomCode];
    if (!room || room.hostSocketId !== socket.id) return;

    const targetLabel = target === 'ALL' ? 'Tất cả (Cả 2 bên)' : (target === 'LIVING_ONLY' ? 'Chỉ riêng Người Sống 💚' : 'Chỉ riêng Người Chết 👻');
    const msg = `${getFormattedTimestamp()} 🎙️ Quản trò chuyển kênh phát giọng nói sang: ${targetLabel}`;
    room.nightLogs.push(msg);
    room.spectatorLogs.push(msg);
    io.to(roomCode).emit('room_updated', room);
  });

  // Day Vote from living player
  socket.on('submit_day_vote', ({ roomCode, targetPlayerId }) => {
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'DAY') return;

    const voter = room.players.find(p => p.socketId === socket.id);
    if (!voter || !voter.isAlive || voter.isHost) return;

    if (!room.dayVotes) room.dayVotes = {};
    room.dayVotes[voter.id] = targetPlayerId;

    const targetPlayer = room.players.find(p => p.id === targetPlayerId);
    const targetLabel = targetPlayerId === 'SKIP' ? 'Bỏ qua phiếu bầu 🚫' : (targetPlayer ? targetPlayer.name : 'Không rõ');

    const msg = `${getFormattedTimestamp()} 🗳️ [BẦU CHỌN BAN NGÀY] ${voter.name} đã bỏ phiếu.`;
    const hostMsg = `${getFormattedTimestamp()} 🗳️ [BẦU CHỌN BAN NGÀY] ${voter.name} bỏ phiếu cho: ${targetLabel}`;

    if (!room.isAutoHost) {
      room.nightLogs.push(hostMsg);
      room.spectatorLogs.push(msg);
      io.to(roomCode).emit('room_updated', room);
    } else {
      // Ẩn danh lúc đang đếm ngược
      room.spectatorLogs.push(msg);
      io.to(roomCode).emit('room_updated', room);
      onAutoPlayerVote(room, io, (r, i) => executeVoteResult(r.code));
    }
  });

  function executeVoteResult(roomOrCode) {
    const room = typeof roomOrCode === 'string' ? rooms[roomOrCode] : roomOrCode;
    if (!room || !room.dayVotes) return;
    const roomCode = room.code;

    const counts = {};
    Object.values(room.dayVotes).forEach(target => {
      counts[target] = (counts[target] || 0) + 1;
    });

    let topTarget = null;
    let maxVotes = 0;
    Object.entries(counts).forEach(([targetId, cnt]) => {
      if (cnt > maxVotes) {
        maxVotes = cnt;
        topTarget = targetId;
      }
    });

    let resultMsg = '';
    if (!topTarget || topTarget === 'SKIP') {
      resultMsg = `${getFormattedTimestamp()} ⚖️ [BẦU CHỌN BAN NGÀY] Kết quả: Số đông chọn BỎ QUA. Không ai bị treo cổ.`;
    } else {
      const hangedPlayer = room.players.find(p => p.id === topTarget);
      if (hangedPlayer) {
        hangedPlayer.isAlive = false;
        resultMsg = `${getFormattedTimestamp()} ⚖️ [BẦU CHỌN BAN NGÀY] ${hangedPlayer.name} bị treo cổ với ${maxVotes} phiếu bầu!`;

        // Kẻ chán đời: Treo cổ thành công -> Thắng luôn
        if (hangedPlayer.role === 'KE_CHAN_DOI') {
          room.gameState = 'ENDED';
          room.currentCalledRole = null;
          const jesterMsg = `${getFormattedTimestamp()} 🎭 [KẺ CHÁN ĐỜI CHIẾN THẮNG] Dân làng đã mắc mưu! Kẻ chán đời ${hangedPlayer.name} đã bị treo cổ thành công và giành chiến thắng ván đấu!`;
          room.nightLogs.push(jesterMsg);
          room.spectatorLogs.push(jesterMsg);
          io.to(roomCode).emit('room_updated', room);
          if (room.isAutoHost) stopAutoHost(room);
          return;
        }

        // Thần tình yêu: Kéo theo người kia chết
        if (room.coupledPlayers && room.coupledPlayers.includes(hangedPlayer.id)) {
          const partnerId = room.coupledPlayers.find(id => id !== hangedPlayer.id);
          const partner = room.players.find(p => p.id === partnerId);
          if (partner && partner.isAlive) {
            partner.isAlive = false;
            resultMsg += `\n${getFormattedTimestamp()} 💔 [THẢM KỊCH] ${partner.name} đã chết theo người tình ${hangedPlayer.name} (Tác dụng của Thần Tình Yêu)!`;
          }
        }
        
        // Thợ săn: Bắn chết mục tiêu cuối cùng
        if (hangedPlayer.role === 'THO_SAN' && room.hunterTargetId) {
          const hunted = room.players.find(p => p.id === room.hunterTargetId);
          if (hunted && hunted.isAlive) {
            hunted.isAlive = false;
            resultMsg += `\n${getFormattedTimestamp()} 🔫 [THẢM KỊCH] Thợ săn ${hangedPlayer.name} trước khi chết đã kịp thời rút súng bắn hạ ${hunted.name}!`;
            
            // Nếu người bị thợ săn bắn lại nằm trong cặp tình yêu
            if (room.coupledPlayers && room.coupledPlayers.includes(hunted.id)) {
              const pId = room.coupledPlayers.find(id => id !== hunted.id);
              const p2 = room.players.find(p => p.id === pId);
              if (p2 && p2.isAlive) {
                p2.isAlive = false;
                resultMsg += `\n${getFormattedTimestamp()} 💔 [THẢM KỊCH] ${p2.name} cũng đã chết vì quá đau buồn khi người tình ${hunted.name} bị Thợ săn bắn!`;
              }
            }
          }
        }
      }
    }

    if (resultMsg) {
      room.nightLogs.push(resultMsg);
      room.spectatorLogs.push(resultMsg);
    }

    room.dayVotes = {};
    
    if (room.isAutoHost) {
      room.autoHostState.isVotingTime = false;
      room.phaseTimer = undefined;
      room.gameState = 'NIGHT';
      const nightStartMsg = `${getFormattedTimestamp()} 🌙 Màn đêm đã buông xuống... Tất cả mọi người đi ngủ!`;
      room.nightLogs.push(nightStartMsg);
      room.spectatorLogs.push(nightStartMsg);
      io.to(roomCode).emit('phase_changed', { gameState: 'NIGHT', room });
      io.to(roomCode).emit('room_updated', room);
      
      // Bắt đầu lại vòng đêm
      setTimeout(() => startAutoNight(room, io, changePhaseToDay), 3000);
    } else {
      io.to(roomCode).emit('room_updated', room);
    }
  }

  // Host executes top voted result
  socket.on('host_execute_vote_result', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.hostSocketId !== socket.id || !room.dayVotes) return;
    executeVoteResult(roomCode);
  });

  function changePhaseToDay(roomOrCode) {
    const room = typeof roomOrCode === 'string' ? rooms[roomOrCode] : roomOrCode;
    if (!room) return;
    const roomCode = room.code;

    const wolfAction = room.nightActions['MA_SOI'] || room.nightActions['SOI_BANG_TRONG'] || room.nightActions['SOI_DU_THOI'];
    const guardAction = room.nightActions['BAO_VE'];
    const witchAction = room.nightActions['PHU_THUY'];
    const silencerAction = room.nightActions['PHAP_SU_CAM_LANG'] || room.nightActions['SOI_CAM_LANG'];
    const hunterAction = room.nightActions['THO_SAN'];

    const wolfTargetId = wolfAction ? wolfAction.targetPlayerId : null;
    const guardTargetId = guardAction ? guardAction.targetPlayerId : null;
    const witchSaveTargetId = witchAction && witchAction.note === 'SAVE' ? witchAction.targetPlayerId : null;
    const witchPoisonId = witchAction && witchAction.note === 'POISON' ? witchAction.targetPlayerId : null;

    // Xử lý Thợ Săn (Lưu mục tiêu)
    if (hunterAction && hunterAction.targetPlayerId) {
      room.hunterTargetId = hunterAction.targetPlayerId;
    }

    // Xử lý Câm Lặng
    if (silencerAction && silencerAction.targetPlayerId) {
      room.silencedPlayerIds = [silencerAction.targetPlayerId];
      const silencedPlayer = room.players.find(p => p.id === silencerAction.targetPlayerId);
      if (silencedPlayer) {
        silencedPlayer.audioState.mic = false;
        io.to(roomCode).emit('player_audio_updated', { playerId: silencedPlayer.id, audioState: silencedPlayer.audioState });
        room.nightLogs.push(`${getFormattedTimestamp()} 🤐 [SỰ KIỆN] Phép thuật câm lặng đã giáng xuống! Có người đã bị khóa miệng vào ngày hôm nay.`);
      }
    } else {
      room.silencedPlayerIds = [];
    }

    const casualties = new Set();

    // Check Werewolf bite target
    if (wolfTargetId) {
      const bittenPlayer = room.players.find(p => p.id === wolfTargetId);

      // KE_BI_SOI_NGUYEN: nếu bị sói cắn thì hóa thành sói thay vì chết!
      if (bittenPlayer && bittenPlayer.role === 'KE_BI_SOI_NGUYEN') {
        bittenPlayer.role = 'MA_SOI';
        const nguyenMsg = `${getFormattedTimestamp()} 🔴 [SỰ KIỆN] KẺ bị sói nguyền đã biến thành Ma Sói sau khi bị cắn!`;
        room.nightLogs.push(nguyenMsg);
        io.to(bittenPlayer.socketId).emit('your_secret_role', { role: 'MA_SOI' });
      } else {
        const isProtectedByGuard = (wolfTargetId === guardTargetId);
        const isProtectedByWitch = witchSaveTargetId && (wolfTargetId === witchSaveTargetId || witchSaveTargetId === 'SAVE_ANY');
        const isProtected = isProtectedByGuard || isProtectedByWitch;

        if (!isProtected) {
          // Già làng: Vết cắn đầu tiên không chết
          if (bittenPlayer && bittenPlayer.role === 'GIA_LANG' && !room.elderBitten) {
            room.elderBitten = true;
            room.nightLogs.push(`${getFormattedTimestamp()} 🛡️ [SỰ KIỆN] Ma sói đã cắn trúng Già Làng, nhưng nhờ sinh lực dồi dào, Già Làng vẫn sống sót qua đêm nay!`);
          } else {
            casualties.add(wolfTargetId);
          }
        } else if (isProtectedByWitch) {
          const saveMsg = `${getFormattedTimestamp()} ✨ Phù thủy đã sử dụng thuốc cứu mạng bảo vệ ${bittenPlayer ? bittenPlayer.name : 'người chơi'}!`;
          room.nightLogs.push(saveMsg);
        } else if (isProtectedByGuard) {
          const guardMsg = `${getFormattedTimestamp()} 🛡️ Bảo vệ đã bảo vệ thành công ${bittenPlayer ? bittenPlayer.name : 'người chơi'}!`;
          room.nightLogs.push(guardMsg);
        }
      }
    }

    // Check Witch poison target
    if (witchPoisonId) {
      casualties.add(witchPoisonId);
    }

    // Apply death status to casualties ONLY NOW (Morning announcement!)
    const deadNames = [];
    const deadIds = Array.from(casualties);

    for (let i = 0; i < deadIds.length; i++) {
      const victimId = deadIds[i];
      const victim = room.players.find(p => p.id === victimId);
      
      if (victim && victim.isAlive) {
        victim.isAlive = false;
        deadNames.push(victim.name);

        // Thần tình yêu: Kéo theo người kia chết
        if (room.coupledPlayers && room.coupledPlayers.includes(victim.id)) {
          const partnerId = room.coupledPlayers.find(id => id !== victim.id);
          if (partnerId && !deadIds.includes(partnerId)) {
            const partner = room.players.find(p => p.id === partnerId);
            if (partner && partner.isAlive) {
              partner.isAlive = false;
              deadNames.push(partner.name);
              room.nightLogs.push(`${getFormattedTimestamp()} 💔 [THẢM KỊCH] ${partner.name} đã chết vì quá đau buồn khi người tình ${victim.name} qua đời!`);
              room.spectatorLogs.push(`${getFormattedTimestamp()} 💔 [THẢM KỊCH] ${partner.name} đã chết vì quá đau buồn khi người tình ${victim.name} qua đời!`);
              deadIds.push(partnerId); // Thêm vào mảng để lặp (mặc dù đã gán isAlive=false rồi)
            }
          }
        }

        // Thợ săn: Kéo theo mục tiêu đã chọn
        if (victim.role === 'THO_SAN' && room.hunterTargetId) {
          const huntedId = room.hunterTargetId;
          if (!deadIds.includes(huntedId)) {
            const hunted = room.players.find(p => p.id === huntedId);
            if (hunted && hunted.isAlive) {
              hunted.isAlive = false;
              deadNames.push(hunted.name);
              room.nightLogs.push(`${getFormattedTimestamp()} 🔫 [THẢM KỊCH] Thợ săn ${victim.name} trước khi chết đã bắn hạ ${hunted.name}!`);
              room.spectatorLogs.push(`${getFormattedTimestamp()} 🔫 [THẢM KỊCH] Thợ săn ${victim.name} bắn chết ${hunted.name}!`);
              deadIds.push(huntedId); // Để lặp tiếp nếu người này lại nằm trong cặp tình yêu
            }
          }
        }
      }
    }

    // Morning Announcement Message
    let morningMsg = '';
    if (deadNames.length > 0) {
      morningMsg = `${getFormattedTimestamp()} ☀️ [BAN NGÀY] Buổi sáng đã đến! Đêm qua, người chơi ${deadNames.join(', ')} đã bị hạ gục 💀`;
    } else {
      morningMsg = `${getFormattedTimestamp()} ☀️ [BAN NGÀY] Buổi sáng đã đến! Đêm qua là một đêm bình yên, không ai qua đời 💚`;
    }

    room.nightLogs.push(morningMsg);
    room.spectatorLogs.push(morningMsg);

    room.currentCalledRole = null;
    room.dayVotes = {};
    room.nightActions = {};
    room.gameState = 'DAY';
    
    io.to(roomCode).emit('phase_changed', { gameState: 'DAY', room });
    io.to(roomCode).emit('room_updated', room);
    
    if (room.isAutoHost) {
      // Bắt đầu 60s thảo luận ban ngày trước khi vote
      room.phaseTimer = { endTime: Date.now() + 60000, duration: 60000 };
      const discussMsg = `${getFormattedTimestamp()} 💬 Bắt đầu thảo luận ban ngày (60s).`;
      room.nightLogs.push(discussMsg);
      room.spectatorLogs.push(discussMsg);
      io.to(roomCode).emit('room_updated', room);
      
      setTimeout(() => {
        startAutoDayVoting(room, io, (r, i) => executeVoteResult(r.code));
      }, 60000);
    }
  }

  // Host changes phase (Night -> Day / Day -> Night)
  socket.on('host_change_phase', ({ roomCode, nextPhase }) => {
    const room = rooms[roomCode];
    if (!room || room.hostSocketId !== socket.id) return;

    // RESOLVE NIGHT CASUALTIES ONLY WHEN TRANSITIONING FROM NIGHT TO DAY!
    if (room.gameState === 'NIGHT' && nextPhase === 'DAY') {
      changePhaseToDay(roomCode);
    } else if (nextPhase === 'NIGHT') {
      const nightStartMsg = `${getFormattedTimestamp()} 🌙 Màn đêm đã buông xuống... Tất cả mọi người đi ngủ!`;
      room.nightLogs.push(nightStartMsg);
      room.spectatorLogs.push(nightStartMsg);
    }

    room.gameState = nextPhase;
    io.to(roomCode).emit('phase_changed', { gameState: nextPhase, room });
    io.to(roomCode).emit('room_updated', room);
  });

  // Host toggles player death state manually (Kill/Revive)
  socket.on('host_toggle_player_alive', ({ roomCode, playerId, isAlive }) => {
    const room = rooms[roomCode];
    if (!room || room.hostSocketId !== socket.id) return;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.isAlive = isAlive;
      let statusMsg = `${getFormattedTimestamp()} [THÔNG BÁO] Người chơi ${player.name} ${isAlive ? 'đã được hồi sinh 💚' : 'đã tử vong 💀'}`;

      // Nếu quản trò cho chết và người này đang trong cặp ghép đôi
      if (!isAlive && room.coupledPlayers && room.coupledPlayers.includes(player.id)) {
        const partnerId = room.coupledPlayers.find(id => id !== player.id);
        const partner = room.players.find(p => p.id === partnerId);
        if (partner && partner.isAlive) {
          partner.isAlive = false; // Chết theo
          statusMsg += `\n${getFormattedTimestamp()} 💔 [THẢM KỊCH] ${partner.name} cũng đã tử vong theo ${player.name} (Cặp đôi ghép bởi Thần Tình Yêu)!`;
        }
      }

      // Thợ săn: Bắn chết mục tiêu
      if (!isAlive && player.role === 'THO_SAN' && room.hunterTargetId) {
        const hunted = room.players.find(p => p.id === room.hunterTargetId);
        if (hunted && hunted.isAlive) {
          hunted.isAlive = false;
          statusMsg += `\n${getFormattedTimestamp()} 🔫 [THẢM KỊCH] Thợ săn ${player.name} đã bắn chết ${hunted.name}!`;
        }
      }

      room.nightLogs.push(statusMsg);
      room.spectatorLogs.push(statusMsg);
      io.to(roomCode).emit('player_status_changed', { playerId, isAlive, room });
      io.to(roomCode).emit('room_updated', room);
    }
  });

  // Host ends game
  socket.on('host_end_game', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.hostSocketId !== socket.id) return;

    room.gameState = 'ENDED';
    room.currentCalledRole = null;
    const endMsg = `${getFormattedTimestamp()} 🏆 TRẬN ĐẤU ĐÃ KẾT THÚC! Toàn bộ vai trò và nhật ký hành động được công khai cho tất cả mọi người.`;
    room.nightLogs.push(endMsg);
    room.spectatorLogs.push(endMsg);

    io.to(roomCode).emit('room_updated', room);
  });

  // Toggle Audio Status
  socket.on('toggle_audio_state', ({ roomCode, audioState }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (player) {
      if (room.silencedPlayerIds && room.silencedPlayerIds.includes(player.id) && audioState.mic) {
        return; // Chặn yêu cầu mở mic nếu bị cấm khẩu
      }
      player.audioState = audioState;
      io.to(roomCode).emit('player_audio_updated', { playerId: player.id, audioState });
      io.to(roomCode).emit('room_updated', room);
    }
  });

  // Host Mic Target Changed
  socket.on('host_mic_target_changed', ({ roomCode, target }) => {
    const room = rooms[roomCode];
    if (!room || room.hostSocketId !== socket.id) return;

    room.hostMicTarget = target;
    io.to(roomCode).emit('host_mic_target_changed', { target, room });
    io.to(roomCode).emit('room_updated', room);
  });

  // ZegoCloud Token Generator Helper
  function generateZegoToken(appId, serverSecret, userId, effectiveTimeInSeconds = 86400) {
    if (!appId || !serverSecret || !userId) return '';
    const now = Math.floor(Date.now() / 1000);
    const expire = now + effectiveTimeInSeconds;

    const tokenPayload = {
      app_id: Number(appId),
      user_id: String(userId),
      nonce: Math.floor(Math.random() * 2147483647),
      ctime: now,
      expire: expire,
      payload: ''
    };

    const strPayload = JSON.stringify(tokenPayload);
    const secretKey = serverSecret.length >= 32 ? serverSecret.substring(0, 32) : serverSecret.padEnd(32, '0');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey, 'utf8'), iv);
    let encrypted = cipher.update(strPayload, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const expireBuf = Buffer.alloc(4);
    expireBuf.writeUInt32BE(expire, 0);

    const ivLenBuf = Buffer.alloc(2);
    ivLenBuf.writeUInt16BE(16, 0);

    const encLenBuf = Buffer.alloc(2);
    encLenBuf.writeUInt16BE(encrypted.length, 0);

    const tokenBuffer = Buffer.concat([expireBuf, ivLenBuf, iv, encLenBuf, encrypted]);
    return '04' + tokenBuffer.toString('base64');
  }

  // ZegoCloud Token Handler
  socket.on('get_zego_token', async ({ roomCode, identity, name }, callback) => {
    try {
      const zegoAppId = 215081463;
      const zegoServerSecret = '0cbbfd5578a47e4261707a6ad83d55f9';
      const userId = String(identity || socket.id);

      const token = generateZegoToken(zegoAppId, zegoServerSecret, userId);
      if (typeof callback === 'function') {
        callback({ success: true, token });
      }
    } catch (err) {
      console.error('Zego token error:', err);
      if (typeof callback === 'function') {
        callback({ success: false, message: err?.message || String(err) });
      }
    }
  });

  // PeerJS Voice Signaling via Socket.io
  // When a player's PeerJS peer is ready, broadcast to all others in room
  socket.on('voice_peer_ready', ({ roomCode, peerId }) => {
    const code = (roomCode || '').trim().toLowerCase();
    if (!code || !rooms[code]) return;

    // Store peerId on socket for cleanup
    socket.voicePeerId = peerId;
    socket.voiceRoomCode = code;

    // Tell all OTHER sockets in this room about the new peer
    socket.to(code).emit('voice_peer_joined', { peerId });

    // Also tell the new peer about all existing peers in the room
    const roomSockets = io.sockets.adapter.rooms.get(code);
    if (roomSockets) {
      for (const sid of roomSockets) {
        if (sid !== socket.id) {
          const otherSocket = io.sockets.sockets.get(sid);
          if (otherSocket && otherSocket.voicePeerId) {
            socket.emit('voice_peer_joined', { peerId: otherSocket.voicePeerId });
          }
        }
      }
    }
  });

  // When a player is leaving voice
  socket.on('voice_peer_leaving', ({ roomCode, peerId }) => {
    const code = (roomCode || '').trim().toLowerCase();
    if (code) {
      socket.to(code).emit('voice_peer_left', { peerId });
    }
    socket.voicePeerId = null;
  });

  // Leave Room handler
  socket.on('leave_room', ({ roomCode }) => {
    const code = (roomCode || socket.roomCode || '').trim().toLowerCase();
    if (code && rooms[code]) {
      const room = rooms[code];
      const leavingPlayer = room.players.find(p => p.socketId === socket.id);
      const leavingName = leavingPlayer ? leavingPlayer.name : 'Ai đó';

      room.players = room.players.filter(p => p.socketId !== socket.id);
      socket.leave(code);
      socket.roomCode = null;

      // Thông báo cho cả phòng biết ai đã thoát
      const leaveMsg = `${getFormattedTimestamp()} 🚪 ${leavingName} đã rời khỏi phòng.`;
      if (room.nightLogs) room.nightLogs.push(leaveMsg);
      if (room.spectatorLogs) room.spectatorLogs.push(leaveMsg);

      // Gửi sự kiện riêng cho host để hiển thị thông báo
      io.to(room.hostSocketId).emit('player_left_notify', {
        playerName: leavingName,
        remainingCount: room.players.filter(p => !p.isHost).length
      });

      io.to(code).emit('room_updated', room);
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ${socket.id}`);

    // Clean up voice peer
    if (socket.voicePeerId && socket.voiceRoomCode) {
      io.to(socket.voiceRoomCode).emit('voice_peer_left', { peerId: socket.voicePeerId });
    }

    if (socket.roomCode && rooms[socket.roomCode]) {
      const room = rooms[socket.roomCode];
      const dcPlayer = room.players.find(p => p.socketId === socket.id);
      const dcName = dcPlayer ? dcPlayer.name : null;

      if (room.gameState === 'LOBBY') {
        room.players = room.players.filter(p => p.socketId !== socket.id);
        if (dcName) {
          // Thông báo ai đã thoát trong lobby
          io.to(room.hostSocketId).emit('player_left_notify', {
            playerName: dcName,
            remainingCount: room.players.filter(p => !p.isHost).length
          });
        }
      } else {
        if (dcPlayer) {
          dcPlayer.connected = false;
          // Thông báo host khi người chơi mất kết nối giữa trận
          io.to(room.hostSocketId).emit('player_left_notify', {
            playerName: dcName,
            remainingCount: room.players.filter(p => !p.isHost && p.connected).length,
            disconnected: true
          });
        }
      }
      io.to(socket.roomCode).emit('room_updated', room);
    }
  });
});

// Single Page Application wildcard route fallback for React Router / SPA
if (fs.existsSync(distPath)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server Ma Sói Online running on http://localhost:${PORT}`);
});
