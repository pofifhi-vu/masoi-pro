import { ALL_ROLES } from './shared/roles.js';

const AUTO_NIGHT_ROLES_ORDER = [
  'MA_SOI', 
  'SOI_TIEN_TRI', 
  'SOI_BANG_TRONG', 
  'SOI_DU_THOI', 
  'TIEN_TRI', 
  'BAO_VE', 
  'PHU_THUY', 
  'THAN_TINH_YEU', 
  'PHAP_SU_CAM_LANG'
];

const AUTO_ROLE_TIME = 15000;
const AUTO_VOTE_TIME = 30000;

const timers = {};

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

export function startAutoNight(room, io, resolveNightCasualties) {
  if (timers[room.code]) clearTimeout(timers[room.code]);

  const activeRoles = new Set(room.players.filter(p => p.isAlive).map(p => p.role));
  const wolfRoles = ['MA_SOI', 'SOI_TIEN_TRI', 'SOI_BANG_TRONG', 'SOI_DU_THOI'];
  const hasWolves = room.players.some(p => p.isAlive && wolfRoles.includes(p.role));

  const queue = [];
  if (hasWolves) queue.push('MA_SOI');

  AUTO_NIGHT_ROLES_ORDER.forEach(r => {
    if (r !== 'MA_SOI' && activeRoles.has(r)) {
       queue.push(r);
    }
  });

  room.autoHostState = {
    isVotingTime: false,
    nightRolesQueue: queue,
    currentQueueIndex: -1,
    expectedActions: 0,
    currentActions: 0
  };

  room.gameState = 'NIGHT';
  room.currentCalledRole = null;
  room.nightActions = {};
  room.dayVotes = {};

  const startMsg = `${getFormattedTimestamp()} 🌙 Màn đêm đã buông xuống... Bắt đầu chế độ Auto-Host.`;
  room.nightLogs.push(startMsg);
  room.spectatorLogs.push(startMsg);

  io.to(room.code).emit('phase_changed', { gameState: 'NIGHT', room });
  io.to(room.code).emit('room_updated', room);

  timers[room.code] = setTimeout(() => {
    processNextNightRole(room, io, resolveNightCasualties);
  }, 3000); // Wait 3s before calling first role
}

export function processNextNightRole(room, io, resolveNightCasualties) {
  if (timers[room.code]) clearTimeout(timers[room.code]);

  room.autoHostState.currentQueueIndex++;

  if (room.autoHostState.currentQueueIndex >= room.autoHostState.nightRolesQueue.length) {
    // End of night
    room.currentCalledRole = null;
    room.phaseTimer = undefined;
    io.to(room.code).emit('room_updated', room);

    // Call provided callback to resolve night and go to Day
    resolveNightCasualties(room, io);
    return;
  }

  const roleKey = room.autoHostState.nightRolesQueue[room.autoHostState.currentQueueIndex];
  room.currentCalledRole = roleKey;

  let targets = [];
  if (roleKey === 'MA_SOI') {
    targets = room.players.filter(p => (p.role === 'MA_SOI' || (p.role && p.role.startsWith('SOI_'))) && p.isAlive);
  } else {
    targets = room.players.filter(p => p.role === roleKey && p.isAlive);
  }

  room.autoHostState.expectedActions = targets.length;
  room.autoHostState.currentActions = 0;

  io.to(room.code).emit('role_called_broadcast', { roleKey, currentCalledRole: roleKey });

  targets.forEach(t => {
    io.to(t.socketId).emit('your_turn_to_act', { roleKey, roomState: room });
  });

  const roleDef = ALL_ROLES.find(r => r.key === roleKey);
  const roleName = roleDef ? roleDef.name : roleKey;

  const msg = `${getFormattedTimestamp()} 🤖 Hệ thống gọi [${roleName}] thức dậy...`;
  room.nightLogs.push(msg);
  room.spectatorLogs.push(msg);

  room.phaseTimer = { endTime: Date.now() + AUTO_ROLE_TIME, duration: AUTO_ROLE_TIME };
  io.to(room.code).emit('room_updated', room);

  timers[room.code] = setTimeout(() => {
    processNextNightRole(room, io, resolveNightCasualties);
  }, AUTO_ROLE_TIME);
}

export function onAutoPlayerAction(room, io, resolveNightCasualties) {
  if (!room.isAutoHost || room.gameState !== 'NIGHT') return;

  room.autoHostState.currentActions++;
  if (room.autoHostState.currentActions >= room.autoHostState.expectedActions) {
    if (timers[room.code]) clearTimeout(timers[room.code]);
    processNextNightRole(room, io, resolveNightCasualties);
  }
}

export function startAutoDayVoting(room, io, executeAutoVoteResult) {
  if (timers[room.code]) clearTimeout(timers[room.code]);

  room.autoHostState.isVotingTime = true;
  room.dayVotes = {};
  
  const msg = `${getFormattedTimestamp()} ⚖️ [BẦU CHỌN] Bắt đầu bỏ phiếu đếm ngược 30s!`;
  room.nightLogs.push(msg);
  room.spectatorLogs.push(msg);

  room.phaseTimer = { endTime: Date.now() + AUTO_VOTE_TIME, duration: AUTO_VOTE_TIME };
  io.to(room.code).emit('start_voting_timer', { endTime: room.phaseTimer.endTime, duration: AUTO_VOTE_TIME });
  io.to(room.code).emit('room_updated', room);

  timers[room.code] = setTimeout(() => {
    executeAutoVoteResult(room, io);
  }, AUTO_VOTE_TIME);
}

export function onAutoPlayerVote(room, io, executeAutoVoteResult) {
  if (!room.isAutoHost || !room.autoHostState.isVotingTime) return;

  const alivePlayersCount = room.players.filter(p => p.isAlive).length;
  const votesCount = Object.keys(room.dayVotes || {}).length;

  if (votesCount >= alivePlayersCount) {
    if (timers[room.code]) clearTimeout(timers[room.code]);
    executeAutoVoteResult(room, io);
  }
}

export function stopAutoHost(room) {
  if (timers[room.code]) {
    clearTimeout(timers[room.code]);
    delete timers[room.code];
  }
  if (room) {
    room.phaseTimer = undefined;
  }
}
