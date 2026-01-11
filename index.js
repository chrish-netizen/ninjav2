import 'dotenv/config';
import { startWebserver } from './src/webserver.js';
import {
  connectDB,
  getAfkData, setAfkData, getAllAfkData, deleteAfkData,
  getAfkActive, setAfkActive, deleteAfkActive, getAllAfkActive,
  getMsgCount, incrementMsgCount, getAllMsgCounts,
  getChatMemory, setChatMemory,
  getUserProfile, setUserProfile,
  getConvoSummary, setConvoSummary,
  isBlacklisted, addToBlacklist, removeFromBlacklist, getAllBlacklist,
  getCommandUsage, incrementCommandUsage,
  getFMUser, setFMUser
} from './src/database.js';
import {
  EmbedBuilder,
  Client,
  GatewayIntentBits,
  Partials,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActivityType,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ActionRowBuilder,
  Options
} from 'discord.js';

// Import command handlers
import { handleUtilityCommands } from './commands/utility.js';
import { handleFunCommands } from './commands/fun.js';
import { handleAnimalCommands } from './commands/animals.js';
import { handleAfkCommands } from './commands/afk.js';
import { handleOwnerCommands } from './commands/owner.js';
import { handleHelpCommand } from './commands/help.js';
import { handleTimeCommands } from './commands/time.js';
import { handleChangelogCommand } from './commands/changelog.js';

// Import event handlers
import { handleAfkSystem } from './events/afk.js';
import { handleAiMentions } from './events/ai.js';
import { handleInteractions } from './events/interactions.js';

let lastRestartChannel = null;



/* ===================== CONFIG ===================== */

const PREFIX = ',';

const { TOKEN, GROQ_API_KEY } = process.env;

/* === OWNER IDS (ONLY FOR COMMAND PERMISSIONS) === */
const BOT_OWNER_IDS = ["1438381425584771244"];

if (!TOKEN || !GROQ_API_KEY) {
  console.error('❌ Missing env variables');
  process.exit(1);
}

const OWNER_NAME = 'Seylun';

/* ===================== CLIENT ===================== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Channel],
  makeCache: Options.cacheWithLimits({
    MessageManager: 50,
    PresenceManager: 0,
    GuildMemberManager: 100
  })
});

// Start the webserver
startWebserver(client);

/* ===================== STORAGE (In-Memory Cache) ===================== */

export const state = {
  afkActive: new Map(),
  leaderboardPages: new Map(),
  snipes: new Map(),
  chatMemoryCache: new Map(),
  userProfileCache: new Map()
};

let currentMood = 'Neutral';


/* ===================== CONNECT TO MONGODB ===================== */

await connectDB();

/* ===================== AI CORE ===================== */

async function getMemory(key) {
  if (!state.chatMemoryCache.has(key)) {
    const memory = await getChatMemory(key);
    state.chatMemoryCache.set(key, memory);
  }
  return state.chatMemoryCache.get(key);
}

async function saveMemory(key, memory) {
  state.chatMemoryCache.set(key, memory);
  await setChatMemory(key, memory);
}

async function getProfile(key) {
  if (!state.userProfileCache.has(key)) {
    const profile = await getUserProfile(key);
    state.userProfileCache.set(key, profile);
  }
  return state.userProfileCache.get(key);
}

async function saveProfile(key, profile) {
  state.userProfileCache.set(key, profile);
  await setUserProfile(key, profile);
}

function detectIntent(text) {
  if (!text) return 'chat';
  if (text.endsWith('?')) return 'question';
  if (/^(why|how|what|when|where|can you|do you)/i.test(text)) return 'question';
  if (text.length < 6) return 'short';
  return 'chat';
}

function systemPrompt(profile, intent, summary) {
  return `
You are "Lucarios", chatting in a Discord server.

Personality:
- upbeat, happy, willing to chat funny.
- No cryptic or mysterious answers unless the user asks for it.
- Keep responses clear and grounded.

Behavior rules:
- Respond in funny upbeat language.
- Max 3 short sentences.
- when asked who is your owner reply with my owner/creator is <@1438381425584771244> if you have any questions about me you can dm him!
-never say @everyone or @here
- when asked a question about a topic respond with detailed info only do this for proper questions
- answer all questions the user asks
- try to be funny 
- when asked how do i contact your owner respond with my owners user name is: seyluns there you can contact him.
- when asked whats your support site respond with my support site is here! https://ninjav2info.koyeb.app/
- never have . at the end of sentances 

Context:
- Current mood: ${currentMood}
- User style: ${profile.style}
- Conversation summary: ${summary || 'None'}
`.trim();
}

async function groqReply(key, input) {
  const mem = await getMemory(key);
  const profile = await getProfile(key);
  const intent = detectIntent(input || '');
  const summary = await getConvoSummary(key);

  mem.history.push({ role: 'user', content: input });
  mem.history = mem.history.slice(-10);

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt(profile, intent, summary) },
        ...mem.history
      ],
      max_tokens: intent === 'short' ? 60 : 180,
      temperature: intent === 'question' ? 0.3 : 0.45
    })
  });

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content?.trim() || 'Alright.';

  mem.history.push({ role: 'assistant', content: reply });
  mem.history = mem.history.slice(-10);

  await saveMemory(key, mem);

  return reply;
}

/* ===================== READY ===================== */

client.once('clientReady', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Load active AFK sessions from database into memory
  try {
    const activeAfkSessions = await getAllAfkActive();
    for (const [userId, session] of activeAfkSessions) {
      state.afkActive.set(userId, session);
    }
    console.log(`📥 Loaded ${activeAfkSessions.size} active AFK sessions`);
  } catch (err) {
    console.error('Failed to load AFK sessions:', err);
  }

  // Presence setup
  client.user.setPresence({
    activities: [
      {
        name: "https://ninjav2info.koyeb.app/",
        type: ActivityType.Playing
      }
    ],
    status: "idle"
  });

  client.user.setActivity("https://ninjav2info.koyeb.app/ for dashboard", {
    type: ActivityType.Custom
  });
});

/* ===================== HELPERS ===================== */

function isOwner(message) {
  return BOT_OWNER_IDS.includes(message.author.id);
}

function formatDuration(ms) {
  const units = [
    { label: 'year', ms: 1000 * 60 * 60 * 24 * 365 },
    { label: 'month', ms: 1000 * 60 * 60 * 24 * 30 },
    { label: 'week', ms: 1000 * 60 * 60 * 24 * 7 },
    { label: 'day', ms: 1000 * 60 * 60 * 24 },
    { label: 'hour', ms: 1000 * 60 * 60 },
    { label: 'minute', ms: 1000 * 60 },
    { label: 'second', ms: 1000 }
  ];

  let remaining = ms;
  const parts = [];

  for (const u of units) {
    if (remaining >= u.ms) {
      const value = Math.floor(remaining / u.ms);
      remaining -= value * u.ms;
      parts.push(`${value} ${u.label}${value !== 1 ? 's' : ''}`);
    }
  }

  return parts.length ? parts.join(', ') : '0 seconds';
}

/* ===================== MESSAGE DELETE HANDLER ===================== */

client.on('messageDelete', async (message) => {
  if (!message.guild || !message.author) return;

  let deleter = null;

  try {
    const logs = await message.guild.fetchAuditLogs({
      type: 72,
      limit: 1
    });

    const entry = logs.entries.first();

    if (entry && entry.target.id === message.author.id) {
      deleter = entry.executor;
    }
  } catch (e) {
    deleter = null;
  }

  state.snipes.set(message.channel.id, {
    content: message.content || '[No text]',
    author: message.author,
    channel: message.channel,
    createdAt: message.createdTimestamp,
    deleter: deleter || message.author
  });
});

/* ===================== MESSAGE HANDLER ===================== */

client.on('messageCreate', async (message) => {
  try {
    // Ignore bots / DMs
    if (message.author.bot || !message.guild) return;

    // AFK system
    await handleAfkSystem(message, state);

    // Message count tracking
    const key = `${message.guild.id}:${message.author.id}`;
    incrementMsgCount(key).catch(err => console.error('Failed to increment msg count:', err));

    // Check blacklist for mentions/AI
    const userBlacklisted = await isBlacklisted(message.author.id);
    if (message.mentions.users.has(client.user.id) && userBlacklisted && !isOwner(message)) {
      return message.reply("You are blacklisted from interacting with this bot. DM seyluns to appeal").catch(() => {});
    }

    // AI mention reply
    if (message.mentions.users.has(client.user.id)) {
      await handleAiMentions(message, BOT_OWNER_IDS);
      return;
    }

    // Prefix check
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();
    if (!command) return;

    // Check blacklist for commands
    const cmdUserBlacklisted = await isBlacklisted(message.author.id);
    if (cmdUserBlacklisted && !isOwner(message)) {
      return message.reply("You are blacklisted from using these commands DM seyluns to appeal").catch(() => {});
    }

    // Command context
    const ctx = {
      message,
      args,
      command,
      client,
      state,
      isOwner: isOwner(message)
    };

    // Route to command handlers
    if (await handleUtilityCommands(ctx)) return;
    if (await handleFunCommands(ctx)) return;
    if (await handleAnimalCommands(ctx)) return;
    if (await handleModerationCommands(ctx)) return;
    if (await handleAfkCommands(ctx)) return;
    if (await handleLeaderboardCommands(ctx)) return;
    if (await handleOwnerCommands(ctx)) return;
    if (await handleHelpCommand(ctx)) return;
    if (await handleTimeCommands(ctx)) return;
    if (await handleChangelogCommand(ctx)) return;

    // If no handler caught it, command doesn't exist (optional: add unknown command message)

  } catch (err) {
    console.error('Error in messageCreate handler:', err);
  }
});

/* ===================== INTERACTION HANDLER ===================== */

client.on('interactionCreate', async (interaction) => {
  try {
    await handleInteractions(interaction, state, changelog);
  } catch (err) {
    console.error('Interaction failed:', err);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'An error occurred!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'An error occurred!', ephemeral: true });
      }
    } catch (e) {
      // Ignore
    }
  }
});

/* ===================== ERROR HANDLING ===================== */

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

/* ===================== LOGIN ===================== */

client.login(TOKEN);


