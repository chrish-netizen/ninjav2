import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, ActivityType } from 'discord.js';
import { startWebserver } from './src/webserver.js';
import { connectDB } from './src/database.js';

// Command handlers (organized by category)
import { handleUtilityCommands } from './commands/utility.js';
import { handleFunCommands } from './commands/fun.js';
import { handleModerationCommands } from './commands/moderation.js';
import { handleAfkCommands } from './commands/afk.js';
import { handleLeaderboardCommands } from './commands/leaderboard.js';
import { handleOwnerCommands } from './commands/owner.js';

// Event handlers
import { handleAfkSystem } from './events/afk.js';
import { handleAiMentions } from './events/ai.js';
import { handleInteractions } from './events/interactions.js';

/* ===================== CONFIG ===================== */
const PREFIX = ',';
const BOT_OWNER_IDS = ["1438381425584771244"];
const { TOKEN, GROQ_API_KEY } = process.env;

if (!TOKEN || !GROQ_API_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

/* ===================== CLIENT SETUP ===================== */
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
  // Optimize caching
  makeCache: {
    MessageManager: 50,
    PresenceManager: 0,
    GuildMemberManager: 100
  }
});

// Global state (minimal)
export const state = {
  afkActive: new Map(),
  snipes: new Map(),
  leaderboardPages: new Map(),
  chatMemoryCache: new Map(),
  userProfileCache: new Map()
};

/* ===================== STARTUP ===================== */
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Connect to database
  await connectDB();

  // Start webserver
  startWebserver(client);

  // Set presence
  client.user.setPresence({
    activities: [{ name: "https://ninjav2info.koyeb.app/", type: ActivityType.Playing }],
    status: "idle"
  });

  console.log('🚀 Bot ready!');
});

/* ===================== MESSAGE HANDLER ===================== */
client.on('messageCreate', async (message) => {
  try {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;

    // Handle AFK system (returns, mentions)
    await handleAfkSystem(message, state);

    // Handle AI mentions
    if (message.mentions.has(client.user.id)) {
      await handleAiMentions(message, BOT_OWNER_IDS);
      return;
    }

    // Check for command prefix
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();
    if (!command) return;

    // Command context object
    const ctx = {
      message,
      args,
      command,
      client,
      state,
      isOwner: BOT_OWNER_IDS.includes(message.author.id)
    };

    // Route to command handlers
    const handlers = [
      handleUtilityCommands,
      handleFunCommands,
      handleModerationCommands,
      handleAfkCommands,
      handleLeaderboardCommands,
      handleOwnerCommands
    ];

    for (const handler of handlers) {
      const handled = await handler(ctx);
      if (handled) break;
    }

  } catch (err) {
    console.error('Message handler error:', err);
  }
});

/* ===================== INTERACTION HANDLER ===================== */
client.on('interactionCreate', async (interaction) => {
  try {
    await handleInteractions(interaction, state);
  } catch (err) {
    console.error('Interaction handler error:', err);
    
    try {
      const reply = { content: 'An error occurred!', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    } catch (e) {
      // Ignore
    }
  }
});

/* ===================== MESSAGE DELETE HANDLER ===================== */
client.on('messageDelete', async (message) => {
  if (!message.guild || !message.author) return;

  let deleter = null;

  try {
    const logs = await message.guild.fetchAuditLogs({ type: 72, limit: 1 });
    const entry = logs.entries.first();
    if (entry?.target.id === message.author.id) {
      deleter = entry.executor;
    }
  } catch (e) {
    // Ignore
  }

  state.snipes.set(message.channel.id, {
    content: message.content || '[No text]',
    author: message.author,
    channel: message.channel,
    createdAt: message.createdTimestamp,
    deleter: deleter || message.author
  });
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
