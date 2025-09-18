const { createClient } = require("redis");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

let redisClient;

async function initRedis() {
  redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.on("error", (err) => console.error("Redis Client Error", err));
  await redisClient.connect();
  console.log("✅ Connected to Redis");
}

async function createSession(ttlSeconds = 60 * 60) { // default 1 hour TTL
  const sessionId = uuidv4();
  const key = `session:${sessionId}:history`;
  // // keep track of all sessions
  // await redisClient.sAdd("sessions:list", sessionId);
  // Initialize empty list and set TTL
  await redisClient.del(key).catch(() => { });
  if (ttlSeconds > 0) await redisClient.expire(key, ttlSeconds);


  return sessionId;
}


async function listSessions() {
  const sessionIds = await redisClient.sMembers("sessions:list");
  const sessions = await Promise.all(sessionIds.map(async (sessionId) => {
    const firstQuestionKey = `session:${sessionId}:firstQuestion`;
    const firstQuestion = await redisClient.get(firstQuestionKey);
    return { sessionId, firstQuestion };
  }));
  return sessions;
}


async function saveMessage(sessionId, message) {
  const key = `session:${sessionId}:history`;
  // store messages as JSON strings in a list
  await redisClient.rPush(key, JSON.stringify({ ...message, ts: Date.now() }));

  // Store the first user question separately
  if (message.role === 'user') {
    const firstQuestionKey = `session:${sessionId}:firstQuestion`;
    const firstQuestion = await redisClient.get(firstQuestionKey);
    if (!firstQuestion) {
      await redisClient.set(firstQuestionKey, message.text);
    }
  }


  // ✅ add sessionId only if this is the first message
  const length = await redisClient.lLen(key);
  if (length === 1) {
    await redisClient.sAdd("sessions:list", sessionId);
  }
  // refresh TTL (optional) - e.g., 1 hour sliding
  await redisClient.expire(key, 60 * 60);
}

async function getHistory(sessionId) {
  const key = `session:${sessionId}:history`;
  const items = await redisClient.lRange(key, 0, -1);
  return items.map(i => JSON.parse(i));
}

// async function clearSession(sessionId) {
//   const key = `session:${sessionId}:history`;
//   await redisClient.del(key);
//   // 2. remove session ID from the set
//   await redisClient.sRem("sessions:list", sessionId);
// }

async function clearSession(sessionId) {
  const key = `session:${sessionId}:history`;
  await redisClient.del(key);

  const firstQuestionKey = `session:${sessionId}:firstQuestion`;
  await redisClient.del(firstQuestionKey);

  await redisClient.sRem("sessions:list", sessionId);
}

// helper: create hash of query (to keep keys short)
function hashQuery(query) {
  return crypto.createHash("sha256").update(query).digest("hex");
}

async function getCachedAnswer(query) {
  const qHash = hashQuery(query);
  const cacheKey = `cache:query:${qHash}`;
  const cached = await redisClient.get(cacheKey);
  return cached ? JSON.parse(cached).answer : null;
}

async function setCachedAnswer(query, answer, ttlSeconds = 1800) {
  const qHash = hashQuery(query);
  const cacheKey = `cache:query:${qHash}`;
  await redisClient.setEx(cacheKey, ttlSeconds, JSON.stringify({ answer, ts: Date.now() }));
}








module.exports = { initRedis, createSession, saveMessage, getHistory, clearSession, getCachedAnswer, setCachedAnswer, listSessions }; 