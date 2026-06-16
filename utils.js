const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'patrols.json');
const HISTORY_FILE = path.join(__dirname, 'data', 'history.json');

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJSON(file, data) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// --- Active patrols ---

function getActivePatrol(userId) {
  const data = readJSON(DATA_FILE) || {};
  return data[userId] || null;
}

function startPatrol(userId, channelId) {
  const data = readJSON(DATA_FILE) || {};
  data[userId] = { startTime: Date.now(), channelId };
  writeJSON(DATA_FILE, data);
}

function endPatrol(userId) {
  const data = readJSON(DATA_FILE) || {};
  const patrol = data[userId];
  if (!patrol) return null;
  delete data[userId];
  writeJSON(DATA_FILE, data);
  const elapsed = Date.now() - patrol.startTime;
  return { startTime: patrol.startTime, elapsed, channelId: patrol.channelId };
}

function cancelPatrol(userId) {
  const data = readJSON(DATA_FILE) || {};
  const patrol = data[userId];
  if (!patrol) return null;
  delete data[userId];
  writeJSON(DATA_FILE, data);
  return patrol;
}

// --- History ---

function savePatrolHistory(userId, userName, displayName, startTime, elapsed, images) {
  const history = readJSON(HISTORY_FILE) || [];
  history.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    userId,
    userName,
    displayName,
    startTime,
    endTime: startTime + elapsed,
    elapsed,
    images: images || {},
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    date: new Date().toISOString(),
  });
  writeJSON(HISTORY_FILE, history);
}

function getPatrolHistory(userId) {
  const history = readJSON(HISTORY_FILE) || [];
  if (userId) return history.filter(h => h.userId === userId);
  return history;
}

function getPendingPatrols() {
  const history = readJSON(HISTORY_FILE) || [];
  return history.filter(h => h.status === 'pending').reverse();
}

function getPatrolById(id) {
  const history = readJSON(HISTORY_FILE) || [];
  return history.find(h => h.id === id) || null;
}

function updatePatrolStatus(id, status, reviewerId, reviewerName, logMessageId) {
  const history = readJSON(HISTORY_FILE) || [];
  const index = history.findIndex(h => h.id === id);
  if (index === -1) return null;
  history[index].status = status;
  history[index].reviewedBy = reviewerId;
  history[index].reviewedByName = reviewerName;
  history[index].reviewedAt = Date.now();
  if (logMessageId !== undefined) history[index].logMessageId = logMessageId;
  writeJSON(HISTORY_FILE, history);
  return history[index];
}

function revertPatrolStatus(id) {
  const history = readJSON(HISTORY_FILE) || [];
  const index = history.findIndex(h => h.id === id);
  if (index === -1) return null;
  const patrol = history[index];
  const oldStatus = patrol.status;
  const oldLogMessageId = patrol.logMessageId;
  patrol.status = 'pending';
  patrol.reviewedBy = null;
  patrol.reviewedByName = null;
  patrol.reviewedAt = null;
  delete patrol.logMessageId;
  writeJSON(HISTORY_FILE, history);
  return { ...patrol, oldStatus, oldLogMessageId };
}

function getReviewedPatrols() {
  const history = readJSON(HISTORY_FILE) || [];
  return history.filter(h => h.status === 'approved' || h.status === 'rejected').reverse().slice(0, 20);
}

function getRanking() {
  const history = readJSON(HISTORY_FILE) || [];
  const totals = {};
  for (const h of history) {
    if (!totals[h.userId]) {
      totals[h.userId] = { userId: h.userId, userName: h.userName, displayName: h.displayName, totalMs: 0, count: 0 };
    }
    totals[h.userId].totalMs += h.elapsed;
    totals[h.userId].count++;
    totals[h.userId].displayName = h.displayName;
    totals[h.userId].userName = h.userName;
  }
  return Object.values(totals).sort((a, b) => b.totalMs - a.totalMs);
}

// --- Formatting ---

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function formatTimeShort(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// --- Role check ---

const ROLE_NAME = 'Refuerzos';
const ROLE_REVIEW = 'Control de Asistencias';
const MOD_ROLES = [
  'Police Supervisor', 'Police Chief Supervisor', 'Special Investigation Section',
  'Police Sergeant I', 'Police Sergeant II', 'Police Lieutenant',
  'Police Captain', 'Police Commander',
];

function hasOfficerRole(member) {
  return member.roles.cache.some(role => role.name === ROLE_NAME);
}

function hasReviewRole(member) {
  return member.roles.cache.some(role => role.name === ROLE_REVIEW);
}

function hasModRole(member) {
  return member.roles.cache.some(role => MOD_ROLES.includes(role.name));
}

module.exports = {
  readJSON,
  getActivePatrol, startPatrol, endPatrol, cancelPatrol,
  savePatrolHistory, getPatrolHistory, getRanking,
  getPendingPatrols, getPatrolById, updatePatrolStatus, revertPatrolStatus, getReviewedPatrols,
  formatTime, formatTimeShort, hasOfficerRole, hasReviewRole, hasModRole,
};
