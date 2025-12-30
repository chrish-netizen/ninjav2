import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'ninjav2';

let client;
let db;

// Collection names
const COLLECTIONS = {
  afkData: 'afkData',
  msgData: 'msgData',
  chatMemory: 'chatMemory',
  userProfiles: 'userProfiles',
  convoSummaries: 'convoSummaries',
  blacklist: 'blacklist',
  commandUsage: 'commandUsage'
};

/**
 * Connect to MongoDB
 */
export async function connectDB() {
  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('✅ Connected to MongoDB');
    
    // Create indexes for better performance
    await db.collection(COLLECTIONS.afkData).createIndex({ oduserId: 1 }, { unique: true, sparse: true });
    await db.collection(COLLECTIONS.msgData).createIndex({ oduserId: 1 }, { unique: true, sparse: true });
    await db.collection(COLLECTIONS.chatMemory).createIndex({ oduserId: 1 }, { unique: true, sparse: true });
    await db.collection(COLLECTIONS.userProfiles).createIndex({ oduserId: 1 }, { unique: true, sparse: true });
    await db.collection(COLLECTIONS.blacklist).createIndex({ oduserId: 1 }, { unique: true, sparse: true });
    
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

/**
 * Get the database instance
 */
export function getDB() {
  if (!db) throw new Error('Database not connected. Call connectDB() first.');
  return db;
}

/**
 * Close the database connection
 */
export async function closeDB() {
  if (client) {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}


// ==================== AFK TOTALS (accumulated time) ====================

export async function getAfkData(userId) {
  const doc = await db.collection(COLLECTIONS.afkData).findOne({ oduserId: userId });
  return doc?.data || null;
}

export async function setAfkData(userId, data) {
  await db.collection(COLLECTIONS.afkData).updateOne(
    { oduserId: userId },
    { $set: { oduserId: userId, data, updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function deleteAfkData(userId) {
  await db.collection(COLLECTIONS.afkData).deleteOne({ oduserId: userId });
}

export async function getAllAfkData() {
  const docs = await db.collection(COLLECTIONS.afkData).find({}).toArray();
  return new Map(docs.map(doc => [doc.oduserId, doc.data]));
}

// ==================== AFK ACTIVE (currently AFK users) ====================

export async function getAfkActive(userId) {
  const doc = await db.collection('afkActive').findOne({ oduserId: userId });
  return doc?.session || null;
}

export async function setAfkActive(userId, session) {
  await db.collection('afkActive').updateOne(
    { oduserId: userId },
    { $set: { oduserId: userId, session, updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function deleteAfkActive(userId) {
  await db.collection('afkActive').deleteOne({ oduserId: userId });
}

export async function getAllAfkActive() {
  const docs = await db.collection('afkActive').find({}).toArray();
  return new Map(docs.map(doc => [doc.oduserId, doc.session]));
}


export async function getMsgCount(key) {
  const doc = await db.collection(COLLECTIONS.msgData).findOne({ key });
  return doc?.count || 0;
}

export async function setMsgCount(key, count) {
  await db.collection(COLLECTIONS.msgData).updateOne(
    { key },
    { $set: { key, count, updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function incrementMsgCount(key) {
  const result = await db.collection(COLLECTIONS.msgData).findOneAndUpdate(
    { key },
    { $inc: { count: 1 }, $set: { updatedAt: new Date() }, $setOnInsert: { key } },
    { upsert: true, returnDocument: 'after' }
  );
  return result?.count || 1;
}

export async function getAllMsgCounts() {
  const docs = await db.collection(COLLECTIONS.msgData).find({}).toArray();
  return new Map(docs.map(doc => [doc.key, doc.count]));
}


export async function getChatMemory(userId) {
  const doc = await db.collection(COLLECTIONS.chatMemory).findOne({ oduserId: userId });
  return doc?.memory || { history: [] };
}

export async function setChatMemory(userId, memory) {
  await db.collection(COLLECTIONS.chatMemory).updateOne(
    { oduserId: userId },
    { $set: { oduserId: userId, memory, updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function getAllChatMemory() {
  const docs = await db.collection(COLLECTIONS.chatMemory).find({}).toArray();
  return new Map(docs.map(doc => [doc.oduserId, doc.memory]));
}

export async function getUserProfile(userId) {
  const doc = await db.collection(COLLECTIONS.userProfiles).findOne({ oduserId: userId });
  return doc?.profile || { facts: [], style: 'normal' };
}

export async function setUserProfile(userId, profile) {
  await db.collection(COLLECTIONS.userProfiles).updateOne(
    { oduserId: userId },
    { $set: { oduserId: userId, profile, updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function getAllUserProfiles() {
  const docs = await db.collection(COLLECTIONS.userProfiles).find({}).toArray();
  return new Map(docs.map(doc => [doc.oduserId, doc.profile]));
}


export async function getConvoSummary(userId) {
  const doc = await db.collection(COLLECTIONS.convoSummaries).findOne({ oduserId: userId });
  return doc?.summary || null;
}

export async function setConvoSummary(userId, summary) {
  await db.collection(COLLECTIONS.convoSummaries).updateOne(
    { oduserId: userId },
    { $set: { oduserId: userId, summary, updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function getAllConvoSummaries() {
  const docs = await db.collection(COLLECTIONS.convoSummaries).find({}).toArray();
  return new Map(docs.map(doc => [doc.oduserId, doc.summary]));
}


export async function isBlacklisted(userId) {
  const doc = await db.collection(COLLECTIONS.blacklist).findOne({ oduserId: userId });
  return doc !== null;
}

export async function addToBlacklist(userId, reason = 'No reason provided') {
  await db.collection(COLLECTIONS.blacklist).updateOne(
    { oduserId: userId },
    { $set: { oduserId: userId, reason, addedAt: new Date() } },
    { upsert: true }
  );
}

export async function removeFromBlacklist(userId) {
  await db.collection(COLLECTIONS.blacklist).deleteOne({ oduserId: userId });
}

export async function getAllBlacklist() {
  const docs = await db.collection(COLLECTIONS.blacklist).find({}).toArray();
  return new Map(docs.map(doc => [doc.oduserId, doc.reason]));
}

export async function getCommandUsage() {
  const docs = await db.collection(COLLECTIONS.commandUsage).find({}).toArray();
  const usage = {};
  docs.forEach(doc => {
    usage[doc.command] = doc.count;
  });
  return usage;
}

export async function incrementCommandUsage(command) {
  await db.collection(COLLECTIONS.commandUsage).updateOne(
    { command },
    { $inc: { count: 1 }, $set: { updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function setCommandUsage(usage) {
  const operations = Object.entries(usage).map(([command, count]) => ({
    updateOne: {
      filter: { command },
      update: { $set: { command, count, updatedAt: new Date() } },
      upsert: true
    }
  }));
  if (operations.length > 0) {
    await db.collection(COLLECTIONS.commandUsage).bulkWrite(operations);
  }
}

export { COLLECTIONS };
