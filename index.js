import 'dotenv/config';
import { startWebserver } from './webserver.js';
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
} from './database.js';
import {
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
  MessageFlags
} from 'discord.js';
import fetch from 'node-fetch';
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


const OWNER_NAME = 'Seylun'; // or whatever name you want displayed


/* ===================== CLIENT ===================== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildModeration,   // << REQUIRED FOR KICK/BAN
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Channel]
});

// Start the webserver
startWebserver(client);


/* ===================== STORAGE (In-Memory Cache) ===================== */

const afkActive = new Map();
const leaderboardPages = new Map();
const snipes = new Map();

let currentMood = 'Neutral';
const roasts = [
  "You're not stupid — you just have bad luck thinking.",
  "If common sense was a currency, you'd be in debt.",
  "You're like a cloud. Once you disappear, it's a beautiful day.",
  "You have the confidence of someone who shouldn't.",
  "You're proof that evolution can go in reverse.",
  "I'd agree with you, but then we'd both be wrong.",
  "You're not useless. You could serve as a bad example.",
  "Your brain has left the chat.",
  "You have the energy of a Windows XP error message.",
  "You're like a software update — nobody asked for you and you take too long."
];
const lores = [
  "was forged in the depths of a forgotten group chat, born from pure chaos and questionable decisions.",
  "once challenged a Discord mod to a duel and won using only reaction emojis.",
  "is rumored to be the final boss of every dead server.",
  "escaped from a parallel universe where everyone speaks in slash commands.",
  "was banned from 17 servers for excessive rizz deployment.",
  "once tried to fix a bot and accidentally created sentient code.",
  "is powered entirely by caffeine, spite, and unstable WiFi.",
  "was discovered wandering the digital void, mumbling about API limits.",
  "is the chosen one destined to defeat the lag monster.",
  "once attempted to roast someone and accidentally summoned a demon."
];



/* ===================== CONNECT TO MONGODB ===================== */

await connectDB();

/* ===================== AI CORE ===================== */

// In-memory cache for chat sessions (cleared on restart)
const chatMemoryCache = new Map();
const userProfileCache = new Map();

async function getMemory(key) {
  if (!chatMemoryCache.has(key)) {
    const memory = await getChatMemory(key);
    chatMemoryCache.set(key, memory);
  }
  return chatMemoryCache.get(key);
}

async function saveMemory(key, memory) {
  chatMemoryCache.set(key, memory);
  await setChatMemory(key, memory);
}

async function getProfile(key) {
  if (!userProfileCache.has(key)) {
    const profile = await getUserProfile(key);
    userProfileCache.set(key, profile);
  }
  return userProfileCache.get(key);
}

async function saveProfile(key, profile) {
  userProfileCache.set(key, profile);
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
You are "Seylun's ninja", chatting in a Discord server.

Personality:
- upbeat, happy, willing to chat funny.
- No cryptic or mysterious answers unless the user asks for it.
- Keep responses clear and grounded.


Behavior rules:
- Respond in funny upbeat language.
- Max 3 short sentences.
- when asked who is your owner reply with my owner/creator is <@1438381425584771244> if you have any questions about me you can dm him!
-never say @everyone or @here
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

  /* === AI OWNER LOGIC REMOVED === */

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
      afkActive.set(userId, session);
    }
    console.log(`📥 Loaded ${activeAfkSessions.size} active AFK sessions`);
  } catch (err) {
    console.error('Failed to load AFK sessions:', err);
  }

  // ⭐ Presence setup
  client.user.setPresence({
    activities: [
      {
        // This shows inside the bot's profile (clickable)
        name: "https://ninjav2info.koyeb.app/",
        type: ActivityType.Playing
      }
    ],

    // This shows in the member list
    status: "idle"
  });

  // ⭐ Custom status text (the one visible in the member list)
  client.user.setActivity("https://ninjav2info.koyeb.app/ for dashboard", {
    type: ActivityType.Custom
  });
});



/* ===================== HELPERS ===================== */

function isOwner(message) {
  return BOT_OWNER_IDS.includes(message.author.id);
}

const baseContainer = (title) =>
  new ContainerBuilder()
    .setAccentColor(0x2b2d31)
    .addTextDisplayComponents((text) => text.setContent(`**${title}**`));

// Optimized helper: Creates a complete container with title, content, and footer
const createContainer = (title, content, botName = 'Bot') =>
  new ContainerBuilder()
    .setAccentColor(0x2b2d31)
    .addTextDisplayComponents(
      (text) => text.setContent(`**${title}**`),
      (text) => text.setContent(content)
    )
    .addSeparatorComponents((sep) => sep.setDivider(true))
    .addTextDisplayComponents((text) => text.setContent(`-# ${botName} • Stable Build`));

// Optimized helper: Creates a container with an image
const createImageContainer = (title, imageUrl, botName = 'Bot') =>
  new ContainerBuilder()
    .setAccentColor(0x2b2d31)
    .addTextDisplayComponents((text) => text.setContent(`**${title}**`))
    .addMediaGalleryComponents((gallery) => gallery.addItems((item) => item.setURL(imageUrl)))
    .addSeparatorComponents((sep) => sep.setDivider(true))
    .addTextDisplayComponents((text) => text.setContent(`-# ${botName} • Stable Build`));

// Optimized helper: Send a V2 container reply (no ping)
const sendContainer = (message, container) =>
  message.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { repliedUser: false }
  }).catch(() => { });

// Reusable help categories data
const HELP_CATEGORIES = {
  utility: {
    emoji: '🛠️',
    title: 'Utility Commands',
    commands: [
      { name: 'serverinfo', desc: 'shows everything about the server' },
      { name: ',ping', desc: 'Check bot latency' },
      { name: ',info', desc: 'Bot info' },
      { name: ',avatar', desc: 'User avatar' },
      { name: ',userinfo', desc: 'User details' },
      { name: ',translate', desc: 'Translate a message' },
      { name: ',ownerinfo', desc: 'show the owners info' },
      { name: ',memberdm', desc: 'DM any user with the command' },
      { name: ',servericon', desc: 'show the servers icon' },
      { name: ',setfm', desc: 'link your last fm account' }, 
      { name: ',fm', desc: 'shows what your playing with last fm' },
      { name: ',uptime', desc: 'Bot uptime' }
    ]
  },

  afk: {
    emoji: '🕒',
    title: 'AFK Commands',
    commands: [
      { name: ',afk', desc: 'Set AFK status' },
      { name: ',afklb', desc: 'AFK leaderboard' }
    ]
  },

  leaderboard: {
    emoji: '🏆',
    title: 'Leaderboard Commands',
    commands: [
      { name: ',msglb', desc: 'Message leaderboard' },
      { name: ',fmlb', desc: 'Show last fm scrobbles' },
      { name: ',afklb', desc: 'AFK leaderboard' }
    ]
  },

  animals: {
    emoji: '🦊',
    title: 'Fun Animals',
    commands: [
      { name: ',cat', desc: 'Sends a random cat image' },
      { name: ',dog', desc: 'Sends a random dog image' },
      { name: ',bird', desc: 'Sends a random bird image' },
      { name: ',fox', desc: 'Sends a random fox image' }
    ]
  },

  fun: {
    emoji: '🎉',
    title: 'Fun Commands',
    commands: [
      { name: ',roast', desc: 'Roast a user' },
      { name: ',lore', desc: 'Generate chaotic lore' },
      { name: ',av', desc: 'Strawberry spam' },
      { name: ',pokemon', desc: 'Rolls a random pokemon' },
      { name: ',ship', desc: 'ship 2 users' },
      { name: ',prophecy', desc: 'show a users fate' },
      { name: ',aura', desc: 'show a users aura' },
      { name: ',luck', desc: 'check your luck' },
      { name: ',fact', desc: 'Useless fact' }
    ]
  },

  moderation: {
    emoji: '🛡️',
    title: 'Moderation Commands',
    commands: [
      { name: ',kick', desc: 'Kick a user' },
      { name: ',ban', desc: 'Ban a user' },
      { name: ',clear', desc: 'Bulk delete messages' },
      { name: ',purgeuser', desc: 'Delete user messages' },
      { name: ',lock', desc: 'Lock channel' },
      { name: ',unlock', desc: 'Unlock channel' },
      { name: ',timeout', desc: 'Timeout a user' },
      { name: ',mute', desc: 'Mute a user' },
      { name: ',unban', desc: 'unban a user' },
      { name: ',unmute', desc: 'Unmute a user' }
    ]
  }
};



// Helper: Create help dropdown menu
const createHelpDropdown = () =>
  new StringSelectMenuBuilder()
    .setCustomId('help-menu')
    .setPlaceholder('Select a category')
    .addOptions(
      Object.entries(HELP_CATEGORIES).map(([value, { emoji, title }]) => ({
        label: title.replace(' Commands', ''),
        value,
        description: title
      }))
    );

// Helper: Build category container from HELP_CATEGORIES
const buildCategoryContainer = (category, botName) => {
  const cat = HELP_CATEGORIES[category];
  if (!cat) return null;
  const commandList = cat.commands.map(c => `**${c.name}** - ${c.desc}`).join('\n');
  return new ContainerBuilder()
    .setAccentColor(0x2b2d31)
    .addTextDisplayComponents(
      (text) => text.setContent(`**${cat.emoji} ${cat.title}**`),
      (text) => text.setContent(commandList)
    )
    .addSeparatorComponents((sep) => sep.setDivider(true))
    .addTextDisplayComponents((text) => text.setContent(`-# ${botName} • Help System`));
};

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
      deleter = entry.executor; // moderator who deleted it
    }
  } catch (e) {
    deleter = null;
  }

  snipes.set(message.channel.id, {
    content: message.content || '[No text]',
    author: message.author,
    channel: message.channel,
    createdAt: message.createdTimestamp,
    deleter: deleter || message.author // fallback: user deleted their own msg
  });
});


const OWNER_ID = '1438381425584771244';


// ===================== HELPERS ===================== //

function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const multipliers = {
    s: 1000,
    m: 1000 * 60,
    h: 1000 * 60 * 60,
    d: 1000 * 60 * 60 * 24
  };

  return value * multipliers[unit] || null;
}

// ===================== AFK RETURN HANDLER ===================== //

async function handleAfkReturn(message) {
  const userId = message.author.id;

  // User is not AFK → skip (check both memory cache and database)
  let data = afkActive.get(userId);
  if (!data) {
    data = await getAfkActive(userId);
    if (!data) return;
  }

  const duration = Date.now() - data.since;

  // Add AFK time to totals in MongoDB
  const prev = await getAfkData(userId) || 0;
  await setAfkData(userId, prev + duration);

  // Remove AFK state from both memory and database
  afkActive.delete(userId);
  await deleteAfkActive(userId);

  // Send welcome back container
  const container = new ContainerBuilder()
    .setAccentColor(0x2b2d31)
    .addTextDisplayComponents(
      (text) => text.setContent('**👋 Welcome Back**'),
      (text) => text.setContent(`You were AFK for **${formatDuration(duration)}**`)
    )
    .addSeparatorComponents((sep) => sep.setDivider(true))
    .addTextDisplayComponents((text) => text.setContent('-# AFK System'));

  await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } }).catch(() => { });
}

// ===================== MESSAGE HANDLER ===================== //

client.on('messageCreate', async (message) => {
  try {
    // Ignore bots / DMs
    if (message.author.bot || !message.guild) return;




    // ===================== AFK RETURN CHECK ===================== //

    await handleAfkReturn(message);

    // ===================== AFK MENTION CHECK ===================== //
    if (message.mentions.users.size > 0) {
      for (const user of message.mentions.users.values()) {
        // Check memory first, then database
        let data = afkActive.get(user.id);
        if (!data) {
          data = await getAfkActive(user.id);
        }

        if (data) {
          const duration = Date.now() - data.since;

          const container = new ContainerBuilder()
            .setAccentColor(0x2b2d31)
            .addTextDisplayComponents(
              (text) => text.setContent('**💤 User is AFK**'),
              (text) => text.setContent(
                [
                  `**${user.username}** is currently AFK.`,
                  `**Reason:** ${data.reason || 'No reason provided'}`,
                  `**Away for:** ${formatDuration(duration)}`
                ].join('\n')
              )
            )
            .addSeparatorComponents((sep) => sep.setDivider(true))
            .addTextDisplayComponents((text) => text.setContent('\-# \ • AFK System'));

          await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } }).catch(() => { });
        }
      }
    }

    // ===================== MESSAGE COUNT TRACKING ===================== //
    const key = `${message.guild.id}:${message.author.id}`;
    incrementMsgCount(key).catch(err => console.error('Failed to increment msg count:', err));

    // ===================== BLACKLIST CHECK (mentions/replies) ===================== //
    const userBlacklisted = await isBlacklisted(message.author.id);
    if (message.mentions.users.has(client.user.id) && userBlacklisted && !isOwner(message)) {
      return message.reply("You are blacklisted from interacting with this bot. DM seyluns to appeal").catch(() => { });
    }

    // ===================== AI MENTION REPLY ===================== //
    if (message.mentions.users.has(client.user.id)) {
      const cleaned = message.content.replace(/<@!?(\d+)>/g, '').trim().toLowerCase();

      const greetings = ['hi', 'hello', 'hey', 'yo', 'sup', 'heya', 'hiya', 'greetings'];

      if (isOwner(message) && greetings.includes(cleaned)) {
        const responses = [
          `👑 Welcome back, ${message.author.username}.`,
          `🍓 The bot bows to you, ${message.author.username}.`,
          `⚡ Chaos awaits, ${message.author.username}.`,
          `🧠 Ready to execute your will, ${message.author.username}.`
        ];
        const response = responses[Math.floor(Math.random() * responses.length)];
        return message.reply(response).catch(() => { });
      }

      const reply = await groqReply(
        `${message.guild.id}:${message.author.id}`,
        cleaned,
        { owner: false, username: message.author.username }
      );

      if (reply) return message.reply(reply).catch(() => { });
    }

    // ===================== PREFIX CHECK ===================== //
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    // ===================== BLACKLIST CHECK ===================== //
    const cmdUserBlacklisted = await isBlacklisted(message.author.id);
    if (cmdUserBlacklisted && !isOwner(message)) {
      return message.reply("You are blacklisted from using these commands DM seyluns to appeal").catch(() => { });
    }



    // ===================== SNIPE COMMANDS ===================== //

    if (command === 'snipe') {
      const data = snipes.get(message.channel.id);

      if (!data) {
        return message.reply("There's nothing to snipe.").catch(() => { });
      }

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(
          (text) => text.setContent('**🕵️ Snipe**'),
          (text) => text.setContent(
            [
              `**Message Author:** <@${data.author.id}>`,
              `**Deleted By:** <@${data.deleter.id}>`,
              `**Message:** ${data.content}`,
              `**Channel:** <#${data.channel.id}>`,
              `**Sent At:** <t:${Math.floor(data.createdAt / 1000)}:F>`
            ].join('\n')
          )
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addTextDisplayComponents((text) => text.setContent('\-# \ • Stable Build'));

      return message.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      }).catch(() => { });
    }

    if (command === 'cs') {
      if (!isOwner(message)) {
        return message.reply('Only my owner can use this command.').catch(() => { });
      }

      const channelId = message.channel.id;

      if (!snipes.has(channelId)) {
        return message.reply('There is no snipe data to clear in this channel.').catch(() => { });
      }

      snipes.delete(channelId);

      return message.reply('Snipe data cleared for this channel.').catch(() => { });
    }
    if (command === "ownerinfo") {
      const owner = await client.users.fetch(BOT_OWNER_ID).catch(() => null);
      if (!owner) return message.reply("Failed to fetch owner info.");

      const aboutMe = `
I’m Seylun the developer of this bot i love food and sleep i also love playing video games. Feel free to dm me on discord about the bot.
  `.trim();

      const embed = {
        title: "👑 Bot Owner Information",
        color: 0x2b2d31,
        thumbnail: { url: owner.displayAvatarURL({ size: 1024 }) },
        fields: [
          {
            name: "Username",
            value: owner.tag,
            inline: true
          },
          {
            name: "User ID",
            value: owner.id,
            inline: true
          },
          {
            name: "Account Created",
            value: `<t:${Math.floor(owner.createdTimestamp / 1000)}:F>`,
            inline: false
          },
          {
            name: "About Me",
            value: aboutMe,
            inline: false
          }
        ],
        footer: {
          text: "Requested by " + message.author.tag
        }
      };

      return message.reply({ embeds: [embed] });
    }

    if (command === "ship") {
      const users = message.mentions.users;

      if (users.size < 2) {
        return message.reply("Mention **two** users to ship.").catch(() => { });
      }

      const [user1, user2] = users.map(u => u);

      const percentage = Math.floor(Math.random() * 101);

      let status;
      if (percentage > 85) status = "💖 Perfect Match!";
      else if (percentage > 60) status = "💘 Strong Potential!";
      else if (percentage > 40) status = "💞 Could Work!";
      else if (percentage > 20) status = "💛 Maybe…?";
      else status = "💔 Not Looking Good…";

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31) // clean grey
        .addTextDisplayComponents(
          (text) => text.setContent(`## 💞 Shipping ${user1.username} × ${user2.username}`),
          (text) => text.setContent(`**Compatibility:** ${percentage}%\n${status}`)
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addTextDisplayComponents(
          (text) => text.setContent("-# Ship System")
        );

      return message.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false }
      }).catch(() => { });
    }

    const cooldowns = new Map(); // userId → timestamp

    if (command === "info") {

      const servers = client.guilds.cache.size;
      const users = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(text =>
          text.setContent(
            `## 🧩 Ninja V2 — Bot Information

**Status:** Online
**Servers:** ${servers}
**Users:** ${users}

### 🌐 Dashboard
https://ninjav2info.koyeb.app/

Thank you for using Ninja V2.`
          )
        );

      return message.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false }
      });
    }


    if (command === "fox") {
      try {
        const res = await fetch("https://randomfox.ca/floof/");
        const data = await res.json();

        if (!data || !data.image) {
          return message.reply("Couldn't fetch a fox right now.");
        }

        const image = data.image;

        const gallery = new MediaGalleryBuilder()
          .addItems(
            new MediaGalleryItemBuilder().setURL(image)
          );

        const container = new ContainerBuilder()
          .setAccentColor(0xffa500)
          .addTextDisplayComponents(text =>
            text.setContent("## 🦊 Random Fox")
          )
          .addMediaGalleryComponents(gallery);

        return message.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { repliedUser: false }
        });

      } catch (err) {
        console.error(err);
        return message.reply("Fox API failed.");
      }
    }




    if (command === "servericon") {
      if (!message.guild) return;

      const icon = message.guild.iconURL({ size: 4096 });

      const gallery = new MediaGalleryBuilder();
      if (icon) {
        gallery.addItems(
          new MediaGalleryItemBuilder().setURL(icon)
        );
      }

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(
          (text) => text.setContent("## 📷 Server Icon")
        )
        .addMediaGalleryComponents(gallery);

      return message.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false }
      });
    }



    if (command === "luck") {
      const luck = Math.floor(Math.random() * 101); // 0–100%

      let messageText = "";

      if (luck >= 90) messageText = "✨ Incredible luck today!";
      else if (luck >= 70) messageText = "🍀 You're pretty lucky right now.";
      else if (luck >= 40) messageText = "🙂 Average luck. Could go either way.";
      else if (luck >= 20) messageText = "😬 Not looking great...";
      else messageText = "💀 Your luck is in the bin.";

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(text =>
          text.setContent(`## 🍀 Luck Check\n**${luck}%** — ${messageText}`)
        );

      return message.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false }
      });
    }




    if (command === "memberdm") {
      const senderId = message.author.id;
      const now = Date.now();

      if (cooldowns.has(senderId)) {
        const lastUsed = cooldowns.get(senderId);
        const diff = (now - lastUsed) / 1000;

        if (diff < 20) {
          const container = new ContainerBuilder()
            .setAccentColor(0x2b2d31)
            .addTextDisplayComponents(
              (text) => text.setContent(`## ⏳ Cooldown Active`),
              (text) => text.setContent(`Please wait **${Math.ceil(20 - diff)} seconds** before using this command again.`)
            )
            .addSeparatorComponents((sep) => sep.setDivider(true))
            .addTextDisplayComponents(
              (text) => text.setContent("-# Member DM System")
            );

          return message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false }
          }).catch(() => { });
        }
      }

      const args = message.content.split(" ").slice(1);
      const targetId = args[0]?.replace(/[<@!>]/g, "");
      const dmContent = args.slice(1).join(" ");

      if (!targetId || !dmContent) {
        const container = new ContainerBuilder()
          .setAccentColor(0x2b2d31)
          .addTextDisplayComponents(
            (text) => text.setContent(`## 📩 Usage Error`),
            (text) => text.setContent(`Use: \`,memberdm @user your message here\``)
          )
          .addSeparatorComponents((sep) => sep.setDivider(true))
          .addTextDisplayComponents(
            (text) => text.setContent("-# Member DM System")
          );

        return message.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { repliedUser: false }
        }).catch(() => { });
      }

      const target = await message.client.users.fetch(targetId).catch(() => null);
      if (!target) {
        return message.reply("Could not find that user.").catch(() => { });
      }

      await target.send(`📬 Message from ${message.author.tag}:\n\n${dmContent}`).catch(() => {
        return message.reply("Failed to send DM.").catch(() => { });
      });

      cooldowns.set(senderId, now);

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(
          (text) => text.setContent(`## ✅ DM Sent`),
          (text) => text.setContent(`Your message was sent to **${target.username}**.`)
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addTextDisplayComponents(
          (text) => text.setContent("-# Member DM System")
        );

      return message.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false }
      }).catch(() => { });
    }

    if (command === "info") {

      const servers = client.guilds.cache.size;
      const users = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(text =>
          text.setContent(
            `## 🧩 Ninja V2 — Bot Information

**Status:** Online
**Servers:** ${servers}
**Users:** ${users}

### 🌐 Dashboard
https://ninjav2info.koyeb.app/

Thank you for using Ninja V2.`
          )
        );

      return message.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false }
      });
    }

    const response = await fetch("https://api.waifu.pics/sfw/waifu");

    if (command === "goon") {
      try {
        // Fetch a random SFW anime girl image
        const response = await fetch("https://api.waifu.pics/sfw/waifu");
        const data = await response.json();

        // DM the user secretly
        await message.author.send({
          content: "🔒 **Secret Delivery**\nHere’s your hidden anime girl…",
          files: [data.url]
        });

        // Public reply
        return message.reply({
          content: "📩 Check your DMs.",
          allowedMentions: { repliedUser: false }
        });

      } catch (err) {
        console.error(err);
        return message.reply("I couldn’t DM you. Make sure your DMs are open.");
      }
    }


    if (command === "prophecy") {
      const target = message.mentions.users.first() || message.author;

      const visions = [
        "a fracture forming in your timeline",
        "an echo of yourself watching from the corner of reality",
        "a forgotten memory trying to rewrite itself",
        "a shadow that doesn’t belong to you",
        "a glitch in the world that only you can see",
        "a message hidden between the seconds",
        "a version of you that made a different choice",
        "a ripple in the simulation following your steps",
        "a secret waiting beneath your next decision",
        "a pattern forming around your presence"
      ];

      const omens = [
        "the lights flicker at the wrong moment",
        "your reflection hesitates before you do",
        "a familiar sound plays from nowhere",
        "someone says something you were about to think",
        "a dream repeats itself with new details",
        "you notice a symbol you’ve never seen before",
        "a stranger recognizes you without meeting you",
        "time feels slightly out of sync",
        "you hear footsteps behind you with no source",
        "your name appears where it shouldn’t"
      ];

      const outcomes = [
        "a shift in your path",
        "an unexpected encounter",
        "a revelation you weren’t meant to see",
        "a choice that branches reality",
        "a moment that loops back later",
        "a truth hidden in plain sight",
        "a connection across timelines",
        "a secret finally surfacing",
        "a pattern completing itself",
        "a door opening where none existed"
      ];

      const prophecy = {
        vision: visions[Math.floor(Math.random() * visions.length)],
        omen: omens[Math.floor(Math.random() * omens.length)],
        outcome: outcomes[Math.floor(Math.random() * outcomes.length)]
      };

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(
          (text) => text.setContent(`## 🔮 Prophecy for ${target.username}`),
          (text) => text.setContent(`**Vision:** ${prophecy.vision}`),
          (text) => text.setContent(`**Omen:** ${prophecy.omen}`),
          (text) => text.setContent(`**Outcome:** ${prophecy.outcome}`)
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addTextDisplayComponents(
          (text) => text.setContent("-# Prophecy System")
        );

      return message.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false }
      }).catch(() => { });
    }





    if (command === "setfm") {
      const username = args[0];
      if (!username) return message.reply("You must provide a Last.fm username.");

      await setFMUser(message.author.id, username);

      return message.reply(`Your Last.fm username has been set to **${username}**`);
    }


    if (command === "fm") {
  const username = args[0] || (await getFMUser(message.author.id));

  if (!username)
    return message.reply("You need to set your Last.fm username using `,setfm <username>`");

  try {
    // Fetch recent track
    const recentUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=1`;
    const recentRes = await fetch(recentUrl);
    const recentData = await recentRes.json();

    if (!recentData.recenttracks?.track?.length)
      return message.reply("No tracks found for that user.");

    const track = recentData.recenttracks.track[0];
    const nowPlaying = track["@attr"]?.nowplaying === "true";

    const artist = track.artist["#text"];
    const song = track.name;
    const album = track.album["#text"];
    const cover = track.image?.[3]["#text"] || null;

    // Fetch total scrobbles
    const infoUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${username}&api_key=${process.env.LASTFM_API_KEY}&format=json`;
    const infoRes = await fetch(infoUrl);
    const infoData = await infoRes.json();

    const scrobbles = infoData?.user?.playcount || "0";

    const embed = {
      color: 0x808080, // grey sidebar
      title: nowPlaying ? "🎧 Now Playing" : "🎵 Last Played",
      description: `**${song}**\nby **${artist}**\nAlbum: *${album || "Unknown"}*\n\n📈 **Total Scrobbles:** ${Number(scrobbles).toLocaleString()}`,
      thumbnail: cover ? { url: cover } : null,
      footer: {
        text: `Last.fm • ${username}`
      }
    };

    return message.reply({ embeds: [embed] });

  } catch (err) {
    console.error(err);
    return message.reply("Error fetching Last.fm data.");
  }
    }
    

if (command === "fmlb") {
  const input = args.join(" ");

  // Get the invoking user's Last.fm username
  const username = await getFMUser(message.author.id);
  if (!username)
    return message.reply("You need to set your Last.fm username using `,setfm <username>`");

  let artist, track;

  // If no input → use now playing OR last played
  if (!input) {
    const recentUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=1`;
    const recentRes = await fetch(recentUrl);
    const recentData = await recentRes.json();

    if (!recentData.recenttracks?.track?.length)
      return message.reply("You haven't listened to anything recently.");

    const t = recentData.recenttracks.track[0];

    artist = t.artist["#text"];
    track = t.name;
  } else {
    // User provided input
    if (input.includes("-")) {
      // Format: Artist - Track
      const parts = input.split("-");
      artist = parts[0].trim();
      track = parts[1].trim();
    } else {
      // Only track name given → we must detect artist
      // Fetch user's recent tracks and find a matching track
      const searchUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=50`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      const match = searchData.recenttracks.track.find(t =>
        t.name.toLowerCase() === input.toLowerCase()
      );

      if (!match)
        return message.reply("Couldn't detect the artist for that track. Try `Artist - Track`.");

      artist = match.artist["#text"];
      track = match.name;
    }
  }

  // Get all users who have set their Last.fm username
  const allUsers = await getAllFMUsers();
  if (!allUsers.length)
    return message.reply("No users have set their Last.fm usernames.");

  const API_KEY = process.env.LASTFM_API_KEY;

  async function getTrackScrobbles(username) {
    try {
      const url = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${API_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&username=${username}&format=json`;

      const res = await fetch(url);
      const data = await res.json();

      return {
        username,
        plays: Number(data?.track?.userplaycount || 0)
      };
    } catch (err) {
      console.error(`Error fetching for ${username}:`, err);
      return { username, plays: 0 };
    }
  }

  // Fetch scrobbles for all users
  const results = await Promise.all(
    allUsers.map(u => getTrackScrobbles(u.username))
  );

  // Sort by plays
  const sorted = results.sort((a, b) => b.plays - a.plays);

  // Build leaderboard text
  const lines = sorted
    .map((u, i) => `**${i + 1}.** ${u.username} — **${u.plays}** plays`)
    .join("\n");

  const embed = {
    color: 0x808080,
    title: `🎵 Track Leaderboard`,
    description: `**${artist} — ${track}**\n\n${lines}`,
    footer: { text: "Last.fm Track Leaderboard" }
  };

  return message.reply({ embeds: [embed] });
}
    

    if (command === "pokemon") {
      try {
        const id = Math.floor(Math.random() * 1025) + 1;
        const response = await fetch("https://pokeapi.co/api/v2/pokemon/" + id);
        if (!response.ok) throw new Error("API error");

        const data = await response.json();
        const name = data.name.charAt(0).toUpperCase() + data.name.slice(1);

        // 20% shiny chance
        const isShiny = Math.random() < 0.20;

        // Get species → evolution chain
        const speciesRes = await fetch(data.species.url);
        const species = await speciesRes.json();

        const evoRes = await fetch(species.evolution_chain.url);
        const evoData = await evoRes.json();

        // Extract full evolution line
        const evoLine = [];
        let evoNode = evoData.chain;

        while (evoNode) {
          evoLine.push(evoNode.species.name);
          evoNode = evoNode.evolves_to[0];
        }

        // Fetch all evolution Pokémon in parallel (MUCH FASTER)
        const evoDataList = await Promise.all(
          evoLine.map(name =>
            fetch("https://pokeapi.co/api/v2/pokemon/" + name)
              .then(r => {
                if (!r.ok) throw new Error(`Pokemon API error: ${r.status}`);
                return r.json();
              })
              .catch(err => {
                console.error(`Failed to fetch pokemon ${name}:`, err.message);
                return null;
              })
          )
        ).then(results => results.filter(Boolean));

        // Build sprite list
        const evoSprites = evoDataList.map(evo => {
          const sprite = isShiny
            ? (evo.sprites.other["official-artwork"].front_shiny || evo.sprites.front_shiny)
            : (evo.sprites.other["official-artwork"].front_default || evo.sprites.front_default);

          return {
            name: evo.name.charAt(0).toUpperCase() + evo.name.slice(1),
            sprite
          };
        });

        const title = isShiny
          ? "## ✨ A **SHINY " + name + "** appeared!"
          : "## A wild **" + name + "** appeared!";

        const gallery = new MediaGalleryBuilder();
        for (const evo of evoSprites) {
          gallery.addItems(
            new MediaGalleryItemBuilder().setURL(evo.sprite)
          );
        }

        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(title)
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true)
          )
          .addMediaGalleryComponents(gallery)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Evolution Line:** " +
              evoSprites.map(e => e.name).join(" → ")
            )
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Pokédex ID:** #" + id)
          );

        await message.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { repliedUser: false }
        });

      } catch (err) {
        console.error(err);
        await message.reply("Failed to load a Pokémon.");
      }
    }



    if (message.content.toLowerCase() === ",serverinfo") {
      const guild = message.guild;

      const owner = await guild.fetchOwner();

      const channels = guild.channels.cache;
      const roles = guild.roles.cache;
      const emojis = guild.emojis.cache;
      const stickers = guild.stickers.cache;

      const textChannels = channels.filter(c => c.type === 0).size;
      const voiceChannels = channels.filter(c => c.type === 2).size;
      const categories = channels.filter(c => c.type === 4).size;
      const threads = channels.filter(c => c.isThread()).size;

      const boosters = guild.members.cache.filter(m => m.premiumSince).size;

      const afkChannel = guild.afkChannel ? `<#${guild.afkChannel.id}>` : "None";
      const systemChannel = guild.systemChannel ? `<#${guild.systemChannel.id}>` : "None";
      const rulesChannel = guild.rulesChannel ? `<#${guild.rulesChannel.id}>` : "None";
      const updatesChannel = guild.publicUpdatesChannel ? `<#${guild.publicUpdatesChannel.id}>` : "None";

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${guild.name}`)
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `### General Information\n` +
              `**ID:** ${guild.id}\n` +
              `**Description:** ${guild.description ?? "None"}\n` +
              `**Owner:** ${owner}\n` +
              `**Members:** ${guild.memberCount}\n` +
              `**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:F>\n` +
              `**Locale:** ${guild.preferredLocale}\n`
            )
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `### Boosts\n` +
              `**Boost Level:** ${guild.premiumTier}\n` +
              `**Boost Count:** ${guild.premiumSubscriptionCount ?? 0}\n` +
              `**Boosters:** ${boosters}\n`
            )
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `### Channels\n` +
              `**Total:** ${channels.size}\n` +
              `**Text:** ${textChannels}\n` +
              `**Voice:** ${voiceChannels}\n` +
              `**Categories:** ${categories}\n` +
              `**Threads:** ${threads}\n` +
              `**AFK Channel:** ${afkChannel}\n` +
              `**AFK Timeout:** ${guild.afkTimeout}s\n` +
              `**System Channel:** ${systemChannel}\n` +
              `**Rules Channel:** ${rulesChannel}\n` +
              `**Updates Channel:** ${updatesChannel}\n`
            )
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `### Roles & Emojis\n` +
              `**Roles:** ${roles.size}\n` +
              `**Emojis:** ${emojis.size}\n` +
              `**Animated Emojis:** ${emojis.filter(e => e.animated).size}\n` +
              `**Stickers:** ${stickers.size}\n`
            )
          )
      ];

      await message.channel.send({
        components,
        flags: MessageFlags.IsComponentsV2 | MessageFlags.IsPersistent
      });
    }
    if (message.content.startsWith(",restart")) {
      if (message.author.id !== "1438381425584771244") {
        return message.reply("Only the bot owner can restart the bot.");
      }

      lastRestartChannel = message.channel.id;

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("## 🔄 Restarting Bot")
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "The bot is now restarting safely..."
            )
          )
      ];

      await message.channel.send({
        components,
        flags: MessageFlags.IsComponentsV2 | MessageFlags.IsPersistent
      });

      console.log("Bot restart triggered by owner.");

      setTimeout(() => {
        process.exit(0);
      }, 1500);
    }



    if (message.content.startsWith(",dm")) {
      // OWNER ONLY
      if (message.author.id !== "1438381425584771244") {
        return message.reply("Only the bot owner can use this command.");
      }

      const args = message.content.split(" ").slice(1);
      const target = args[0];

      // Show usage embed if no args
      if (!target) {
        const usageEmbed = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("## 📬 DM Command Usage")
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
                .setDivider(true)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "**Usage:**\n" +
                "`,dm @user your message` — DM a specific user\n" +
                "`,dm USER_ID your message` — DM a user by ID\n" +
                "`,dm all your message` — DM all server owners"
              )
            )
        ];

        return await message.channel.send({
          components: usageEmbed,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.IsPersistent
        });
      }

      const dmText = args.slice(1).join(" ");

      // DM container with footer
      const dmContainer = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("## 📩 Message from the Bot Owner")
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${dmText}`)
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(false)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder()
              .setContent("*This message cannot be replied to*")
          )
      ];

      // DM all server owners
      if (target === "all") {
        let sent = 0;
        for (const guild of message.client.guilds.cache.values()) {
          try {
            const owner = await guild.fetchOwner();
            await owner.send({
              components: dmContainer,
              flags: MessageFlags.IsComponentsV2 | MessageFlags.IsPersistent
            });
            sent++;
          } catch { }
        }
        return message.reply(`DM sent to ${sent} server owners.`);
      }

      // DM by mention
      const mention = message.mentions.users.first();
      if (mention) {
        try {
          await mention.send({
            components: dmContainer,
            flags: MessageFlags.IsComponentsV2 | MessageFlags.IsPersistent
          });
          return message.reply(`DM sent to ${mention.tag}.`);
        } catch {
          return message.reply("I couldn't DM that user.");
        }
      }

      // DM by raw user ID
      try {
        const user = await message.client.users.fetch(target);
        await user.send({
          components: dmContainer,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.IsPersistent
        });
        return message.reply(`DM sent to user ID **${target}**.`);
      } catch {
        return message.reply("Invalid user ID or user cannot be DMed.");
      }
    }




    // ===================== FUN COMMANDS ===================== //

    if (command === 'roast') {
      const target = message.mentions.users.first() || message.author;
      const roast = roasts[Math.floor(Math.random() * roasts.length)];

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(
          (text) => text.setContent('**🔥 Roast Generator**'),
          (text) => text.setContent(`<@${target.id}> ${roast}`)
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addTextDisplayComponents((text) => text.setContent(''));

      return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } }).catch(() => { });
    }

    if (command === 'lore') {
      const target = message.mentions.users.first() || message.author;
      const lore = lores[Math.floor(Math.random() * lores.length)];

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(
          (text) => text.setContent('**📜 Character Lore**'),
          (text) => text.setContent(`<@${target.id}> ${lore}`)
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addTextDisplayComponents((text) => text.setContent(''));

      return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } }).catch(() => { });
    }

    if (command === 'av') {
      return message.reply('🍓🍓🍓🍓🍓🍓').catch(() => { });
    }

    if (command === "cat") {
      try {
        const res = await fetch("https://api.thecatapi.com/v1/images/search");
        const data = await res.json();

        if (!data || !data[0] || !data[0].url) {
          return message.reply("Couldn't fetch a cat right now.");
        }

        const image = data[0].url;

        const gallery = new MediaGalleryBuilder()
          .addItems(
            new MediaGalleryItemBuilder().setURL(image)
          );

        const container = new ContainerBuilder()
          .setAccentColor(0x2b2d31)
          .addTextDisplayComponents(text =>
            text.setContent("## 🐱 Random Cat")
          )
          .addMediaGalleryComponents(gallery);

        return message.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { repliedUser: false }
        });

      } catch (err) {
        console.error(err);
        return message.reply("Cat API failed.");
      }
    }


    if (command === "dog") {
      try {
        const res = await fetch("https://dog.ceo/api/breeds/image/random");
        const data = await res.json();

        if (!data || !data.message) {
          return message.reply("Couldn't fetch a dog right now.");
        }

        const image = data.message;

        const gallery = new MediaGalleryBuilder()
          .addItems(
            new MediaGalleryItemBuilder().setURL(image)
          );

        const container = new ContainerBuilder()
          .setAccentColor(0x2b2d31)
          .addTextDisplayComponents(text =>
            text.setContent("## 🐶 Random Dog")
          )
          .addMediaGalleryComponents(gallery);

        return message.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { repliedUser: false }
        });

      } catch (err) {
        console.error(err);
        return message.reply("Dog API failed.");
      }
    }

    if (command === "bird") {
      try {
        const res = await fetch("https://some-random-api.com/img/birb");
        const data = await res.json();

        if (!data || !data.link) {
          return message.reply("Couldn't fetch a bird right now.");
        }

        const image = data.link;

        const gallery = new MediaGalleryBuilder()
          .addItems(
            new MediaGalleryItemBuilder().setURL(image)
          );

        const container = new ContainerBuilder()
          .setAccentColor(0x2b2d31)
          .addTextDisplayComponents(text =>
            text.setContent("## 🐦 Random Bird")
          )
          .addMediaGalleryComponents(gallery);

        return message.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { repliedUser: false }
        });

      } catch (err) {
        console.error(err);
        return message.reply("Bird API failed.");
      }
    }



    if (command === 'fact') {
      try {
        const res = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');
        const data = await res.json();
        const fact = data.text;

        const container = new ContainerBuilder()
          .setAccentColor(0x2b2d31)
          .addTextDisplayComponents(
            (text) => text.setContent('**🧠 Random Fact**'),
            (text) => text.setContent(fact)
          )
          .addSeparatorComponents((sep) => sep.setDivider(true))
          .addTextDisplayComponents((text) => text.setContent('\-# \ • Stable Build'));

        return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } }).catch(() => { });
      } catch {
        const fallback = [
          'Honey never spoils.',
          "Bananas are berries, but strawberries aren't.",
          'Octopuses have three hearts.',
          'A day on Venus is longer than its year.',
          'Sharks existed before trees.'
        ];

        const container = new ContainerBuilder()
          .setAccentColor(0x2b2d31)
          .addTextDisplayComponents(
            (text) => text.setContent('**🧠 Random Fact (Offline Mode)**'),
            (text) => text.setContent(fallback[Math.floor(Math.random() * fallback.length)])
          )
          .addSeparatorComponents((sep) => sep.setDivider(true))
          .addTextDisplayComponents((text) => text.setContent(''));

        return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } }).catch(() => { });
      }
    }

    // ===================== SERVERS COMMAND (OWNER ONLY) ===================== //

    if (command === 'servers') {
      if (!isOwner(message)) {
        return message.reply('Only my owner can use this command.').catch(() => { });
      }

      const guilds = [...client.guilds.cache.values()];

      if (guilds.length === 0) {
        return message.reply("I'm not in any servers.").catch(() => { });
      }

      let description = '';

      for (const guild of guilds) {
        let inviteText = 'No permissions or channel to create invite';

        try {
          // Find a text channel where the bot can create an invite
          const channel = guild.channels.cache
            .filter((c) => {
              // Support both property and function styles for isTextBased
              if (typeof c.isTextBased === 'function') return c.isTextBased();
              return c.isTextBased;
            })
            .find((c) => {
              const perms = c.permissionsFor(guild.members.me || client.user.id);
              return perms && perms.has('CreateInstantInvite');
            });

          if (channel) {
            const invite = await channel.createInvite({
              maxAge: 0,
              maxUses: 0,
              reason: `Requested by owner ${message.author.tag}`
            });
            inviteText = invite.url;
          }
        } catch {
          inviteText = 'Failed to create invite';
        }

        description += `**${guild.name}**\nID: \`${guild.id}\`\nInvite: ${inviteText}\n\n`;
      }

      if (!description.length) {
        description = "I couldn't create invites for any servers.";
      }

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(
          (text) => text.setContent("**📡 Servers I'm In**"),
          (text) => text.setContent(description.slice(0, 3900))
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addTextDisplayComponents((text) => text.setContent('-# Owner Only Command'));

      return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } }).catch(() => { });
    }

    // ===================== INFO / UTILITY COMMANDS ===================== //

    if (command === 'info') {
      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(
          (text) => text.setContent('**🤖 Bot Information**'),
          (text) => text.setContent(
            [
              '**Developer:** Seylun',
              '',
              '**Built With:**',
              '• Node.js',
              '• discord.js v14',
              '• Groq AI integration',
              '',
              '**Features:**',
              '• AFK system + leaderboard',
              '• Message leaderboard',
              '• AI replies with memory',
              '• Owner-only commands',
              '• Help dropdown',
              '• Random animals (cat, dog, bird)',
              '',
              'Thanks for using Seylun!'
            ].join('\n')
          )
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addTextDisplayComponents((text) => text.setContent(''));

      return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } }).catch(() => { });
    }

    if (command === 'avatar') {
      const user =
        message.mentions.users.first() ||
        (args[0] && (await client.users.fetch(args[0]).catch(() => null))) ||
        message.author;

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents((text) => text.setContent(`**🖼️ Avatar: ${user.username}**`))
        .addMediaGalleryComponents((gallery) =>
          gallery.addItems((item) => item.setURL(user.displayAvatarURL({ size: 1024, dynamic: true })))
        );

      return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } }).catch(() => { });
    }

    if (command === 'userinfo') {
      const user = message.mentions.users.first() || message.author;
      const member = await message.guild.members.fetch(user.id).catch(() => null);

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(
          (text) => text.setContent(`**📌 User Info: ${user.username}**`),
          (text) => text.setContent(
            [
              `**User ID:** ${user.id}`,
              `**Joined Discord:** <t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
              `**Joined This Server:** ${member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'Unknown'}`
            ].join('\n')
          )
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addTextDisplayComponents((text) => text.setContent('\-# \ • Stable Build'));

      return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } }).catch(() => { });
    }

    if (command === 'uptime') {
      const totalMs = client.uptime;

      const units = [
        { label: 'day', ms: 1000 * 60 * 60 * 24 },
        { label: 'hour', ms: 1000 * 60 * 60 },
        { label: 'minute', ms: 1000 * 60 },
        { label: 'second', ms: 1000 }
      ];

      let remaining = totalMs;
      const parts = [];

      for (const u of units) {
        if (remaining >= u.ms) {
          const value = Math.floor(remaining / u.ms);
          remaining -= value * u.ms;
          parts.push(`${value} ${u.label}${value !== 1 ? 's' : ''}`);
        }
      }

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(
          (text) => text.setContent('**⏳ Bot Uptime**'),
          (text) => text.setContent(`I have been online for **${parts.join(', ')}**`)
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addTextDisplayComponents((text) => text.setContent(`-# ${client.user.username}`));

      return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } }).catch(() => { });
    }

    if (command === 'ping') {
      const sent = await message.reply({ content: '🏓 Pinging...', allowedMentions: { repliedUser: false } }).catch(() => null);
      if (!sent) return;

      const latency = sent.createdTimestamp - message.createdTimestamp;
      const apiLatency = Math.round(client.ws.ping);

      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          (text) => text.setContent('**🏓 Pong!**'),
          (text) => text.setContent(`⚡ **Latency:** ${latency}ms\n📡 **API Latency:** ${apiLatency}ms`)
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addTextDisplayComponents((text) => text.setContent(`-# ${client.user.username}`));

      return sent.edit({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } }).catch(() => { });
    }

    // ===================== AFK COMMANDS ===================== //

    if (command === 'afk') {
      const reason = args.join(' ') || 'AFK';

      const now = Date.now();
      const userId = message.author.id;

      // Check both memory and database
      if (afkActive.has(userId) || await getAfkActive(userId)) {
        return message.reply('You are already marked as AFK.').catch(() => { });
      }

      const afkSession = {
        since: now,
        reason
      };

      // Save to both memory (for fast access) and MongoDB (for persistence)
      afkActive.set(userId, afkSession);
      await setAfkActive(userId, afkSession);

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(
          (text) => text.setContent('**🕒 AFK Enabled**'),
          (text) => text.setContent(`You are now marked as AFK.\n**Reason:** ${reason}`)
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addTextDisplayComponents(
          (text) => text.setContent('-# AFK System')
        );

      return message.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false }
      }).catch(() => { });
    }


    if (command === 'afklb') {
      const afkTotals = await getAllAfkData();
      const entries = Array.from(afkTotals.entries())
        .filter(([_, ms]) => ms > 0)
        .sort((a, b) => b[1] - a[1]);

      if (entries.length === 0) {
        return message.reply('No AFK data recorded yet.').catch(() => { });
      }

      const pageSize = 10;
      const totalPages = Math.ceil(entries.length / pageSize);
      const page = 0;

      const start = page * pageSize;
      const pageEntries = entries.slice(start, start + pageSize);

      const lines = pageEntries.map(([oduserId, totalMs], i) => {
        const rank = start + i + 1;
        return `**${rank}.** <@${oduserId}> — ${formatDuration(totalMs)}`;
      });

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(
          (text) => text.setContent('**🏆 AFK Leaderboard**'),
          (text) => text.setContent(lines.join('\n') + `\n\nPage **1** of **${totalPages}**`)
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addActionRowComponents((row) =>
          row.addComponents(
            new ButtonBuilder()
              .setCustomId('afk_prev:0')
              .setLabel('Prev')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('afk_next:0')
              .setLabel('Next')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(totalPages <= 1)
          )
        );

      const sent = await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } }).catch(() => null);
      if (sent) leaderboardPages.set(sent.id, { type: 'afk', page: 0 });
      return;
    }

    // ===================== LEADERBOARD COMMANDS ===================== //

    if (command === 'msglb') {
      const msgCounts = await getAllMsgCounts();
      const entries = Array.from(msgCounts.entries())
        .filter(([k, count]) => {
          const [guildId] = k.split(':');
          return guildId === message.guild.id && count > 0;
        })
        .map(([k, count]) => {
          const oduserId = k.split(':')[1];
          return [oduserId, count];
        })
        .sort((a, b) => b[1] - a[1]);

      if (entries.length === 0) {
        return message.reply('No message data recorded yet.').catch(() => { });
      }

      const pageSize = 10;
      const totalPages = Math.ceil(entries.length / pageSize);
      const page = 0;

      const start = page * pageSize;
      const pageEntries = entries.slice(start, start + pageSize);

      const lines = pageEntries.map(([oduserId, count], i) => {
        const rank = start + i + 1;
        return `**${rank}.** <@${oduserId}> — **${count} messages**`;
      });

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(
          (text) => text.setContent('**🏆 Message Leaderboard**'),
          (text) => text.setContent(lines.join('\n') + `\n\nPage **1** of **${totalPages}**`)
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addActionRowComponents((row) =>
          row.addComponents(
            new ButtonBuilder()
              .setCustomId('msg_prev:0')
              .setLabel('Prev')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('msg_next:0')
              .setLabel('Next')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(totalPages <= 1)
          )
        );

      const sent = await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } }).catch(() => null);
      if (sent) leaderboardPages.set(sent.id, { type: 'msg', page: 0 });
      return;
    }

    // ===================== MODERATION COMMANDS (basic) ===================== //

    if (command === 'kick') {
      if (!message.member.permissions.has('KickMembers') && !isOwner(message)) {
        return message.reply("You don't have permission to kick members.").catch(() => { });
      }

      const user = message.mentions.members.first();
      if (!user) return message.reply('Mention a user to kick.').catch(() => { });

      if (!user.kickable && !isOwner(message)) {
        return message.reply("I can't kick that user.").catch(() => { });
      }

      await user.kick(`Kicked by ${message.author.tag}`).catch(() => { });
      return message.reply(`Kicked **${user.user.tag}**.`).catch(() => { });
    }

    if (command === 'ban') {
      if (!message.member.permissions.has('BanMembers') && !isOwner(message)) {
        return message.reply("You don't have permission to ban members.").catch(() => { });
      }

      const user = message.mentions.members.first();
      if (!user) return message.reply('Mention a user to ban.').catch(() => { });

      if (!user.bannable && !isOwner(message)) {
        return message.reply("I can't ban that user.").catch(() => { });
      }

      await user.ban({ reason: `Banned by ${message.author.tag}` }).catch(() => { });
      return message.reply(`Banned **${user.user.tag}**.`).catch(() => { });
    }

    if (command === 'clear') {
      if (!message.member.permissions.has('ManageMessages') && !isOwner(message)) {
        return message.reply("You don't have permission to clear messages.").catch(() => { });
      }

      const amount = parseInt(args[0]);
      if (!amount || amount < 1 || amount > 100) {
        return message.reply('Provide a number between 1 and 100.').catch(() => { });
      }

      await message.channel.bulkDelete(amount, true).catch(() => { });
      return message
        .reply(`Cleared **${amount}** messages.`)
        .then((msg) => setTimeout(() => msg.delete().catch(() => { }), 3000))
        .catch(() => { });
    }

    // ===================== ADVANCED MODERATION (owner-focused) ===================== //

    if (command === 'forceban') {
      if (!isOwner(message)) {
        return message.reply('Only my owner can use this command.').catch(() => { });
      }

      const idOrMention = args[0];
      if (!idOrMention) {
        return message.reply('Provide a user ID or mention to forceban.').catch(() => { });
      }

      const userId = idOrMention.replace(/\D/g, '');
      if (!userId) return message.reply('Invalid user ID.').catch(() => { });

      await message.guild.members
        .ban(userId, {
          reason: `Forcebanned by owner ${message.author.tag}`
        })
        .catch(() => { });

      return message.reply(`Forcebanned <@${userId}> from this server.`).catch(() => { });
    }

    if (command === 'forcekick') {
      if (!isOwner(message)) {
        return message.reply('Only my owner can use this command.').catch(() => { });
      }

      const member = message.mentions.members.first();
      if (!member) return message.reply('Mention a user to forcekick.').catch(() => { });

      await member.kick(`Forcekicked by owner ${message.author.tag}`).catch(() => { });
      return message.reply(`Forcekicked **${member.user.tag}**.`).catch(() => { });
    }

    if (command === 'purgeuser') {
      if (!message.member.permissions.has('ManageMessages') && !isOwner(message)) {
        return message.reply("You don't have permission to manage messages.").catch(() => { });
      }

      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);

      if (!target) return message.reply('Mention a user to purge messages from.').catch(() => { });
      if (!amount || amount < 1 || amount > 100) {
        return message.reply('Provide an amount between 1 and 100.').catch(() => { });
      }

      const messages = await message.channel.messages.fetch({ limit: 100 }).catch(() => null);
      if (!messages) return message.reply('Failed to fetch messages.').catch(() => { });

      const toDelete = messages.filter((m) => m.author.id === target.id).first(amount);

      await message.channel.bulkDelete(toDelete, true).catch(() => { });
      return message
        .reply(`Deleted **${toDelete.length}** messages from <@${target.id}>.`)
        .then((msg) => setTimeout(() => msg.delete().catch(() => { }), 3000))
        .catch(() => { });
    }

    if (command === 'lock') {
      if (!message.member.permissions.has('ManageChannels') && !isOwner(message)) {
        return message.reply("You don't have permission to lock channels.").catch(() => { });
      }

      await message.channel.permissionOverwrites
        .edit(message.guild.roles.everyone, { SendMessages: false })
        .catch(() => { });

      return message.reply('🔒 Channel locked.').catch(() => { });
    }

    if (command === 'unlock') {
      if (!message.member.permissions.has('ManageChannels') && !isOwner(message)) {
        return message.reply("You don't have permission to unlock channels.").catch(() => { });
      }

      await message.channel.permissionOverwrites
        .edit(message.guild.roles.everyone, { SendMessages: true })
        .catch(() => { });

      return message.reply('🔓 Channel unlocked.').catch(() => { });
    }

    if (command === 'timeout') {
      if (!message.member.permissions.has('ModerateMembers') && !isOwner(message)) {
        return message.reply("You don't have permission to timeout members.").catch(() => { });
      }

      const member = message.mentions.members.first();
      const durationStr = args[1];
      const reason = args.slice(2).join(' ') || `Timed out by ${message.author.tag}`;

      if (!member) return message.reply('Mention a user to timeout.').catch(() => { });
      if (!durationStr) {
        return message.reply('Provide a duration (e.g., 10m, 1h, 1d).').catch(() => { });
      }

      const ms = parseDuration(durationStr);
      if (!ms) {
        return message.reply('Invalid duration format. Use s/m/h/d, e.g., 10m, 1h.').catch(() => { });
      }

      await member.timeout(ms, reason).catch(() => { });
      return message.reply(`Timed out **${member.user.tag}** for **${durationStr}**.`).catch(() => { });
    }

    if (command === 'mute') {
      if (!message.member.permissions.has('ModerateMembers') && !isOwner(message)) {
        return message.reply("You don't have permission to mute members.").catch(() => { });
      }

      const member = message.mentions.members.first();
      const durationStr = args[1];
      const reason = args.slice(2).join(' ') || `Muted by ${message.author.tag}`;

      if (!member) return message.reply('Mention a user to mute.').catch(() => { });
      if (!durationStr) {
        return message.reply('Provide a duration (e.g., 10m, 1h).').catch(() => { });
      }

      const ms = parseDuration(durationStr);
      if (!ms) {
        return message.reply('Invalid duration format. Use s/m/h/d, e.g., 10m, 1h.').catch(() => { });
      }

      await member.timeout(ms, reason).catch(() => { });
      return message.reply(`Muted **${member.user.tag}** for **${durationStr}**.`).catch(() => { });
    }

    if (command === 'unmute') {
      if (!message.member.permissions.has('ModerateMembers') && !isOwner(message)) {
        return message.reply("You don't have permission to unmute members.").catch(() => { });
      }

      const member = message.mentions.members.first();
      if (!member) return message.reply('Mention a user to unmute.').catch(() => { });

      await member.timeout(null, `Unmuted by ${message.author.tag}`).catch(() => { });
      return message.reply(`Unmuted **${member.user.tag}**.`).catch(() => { });
    }

    // ===================== TRANSLATE COMMAND ===================== //

    if (command === 'translate') {
      if (!message.reference || !message.reference.messageId) {
        return message.reply('You need to reply to a message to translate it.').catch(() => { });
      }

      try {
        const targetMsg = await message.channel.messages.fetch(message.reference.messageId);
        const originalText = targetMsg.content;

        if (!originalText || originalText.length < 2) {
          return message
            .reply("That message doesn't contain anything to translate.")
            .catch(() => { });
        }

        const query = encodeURIComponent(originalText);
        const res = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${query}`
        );
        const data = await res.json();

        const translated = data[0]?.map((part) => part[0]).join(' ') || originalText;
        const detectedLang = data[2] || 'unknown';
        const targetLang = 'en';

        const container = new ContainerBuilder()
          .setAccentColor(0x2b2d31)
          .addTextDisplayComponents(
            (text) => text.setContent('**🌐 Translation**'),
            (text) => text.setContent(`**Original Text (${detectedLang} -> ${targetLang}):**\n${originalText}`),
            (text) => text.setContent(`**Translated Text:**\n${translated}`)
          )
          .addSeparatorComponents((sep) => sep.setDivider(true))
          .addTextDisplayComponents((text) => text.setContent(''));

        return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } }).catch(() => { });
      } catch (err) {
        console.error('Translate error:', err);
        return message.reply('Translation failed. API might be down.').catch(() => { });
      }
    }
    if (command === "unban") {
      const target = args[0];

      if (!target) {
        return message.reply("You need to provide a user ID to unban.");
      }

      try {
        const bans = await message.guild.bans.fetch();

        // Try to find the ban entry
        const banEntry =
          bans.get(target) ||
          bans.find((b) => b.user.tag === target) ||
          bans.find((b) => b.user.username === target);

        if (!banEntry) {
          return message.reply("That user is not banned.");
        }

        const user = banEntry.user;

        // Attempt DM (optional)
        user.send(`You have been unbanned from **${message.guild.name}**.`).catch(() => { });

        // Unban
        await message.guild.members.unban(user.id, `Unbanned by ${message.author.tag}`);

        // Confirmation
        const container = new ContainerBuilder()
          .setAccentColor(0x2b2d31)
          .addTextDisplayComponents((t) =>
            t.setContent(`**Unbanned:** ${user.tag} (${user.id})`)
          )
          .addSeparatorComponents((s) => s.setDivider(true))
          .addTextDisplayComponents((t) =>
            t.setContent(`Action performed by: ${message.author.tag}`)
          );

        return message.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { repliedUser: false }
        });
      } catch (err) {
        console.error("UNBAN ERROR:", err);
        return message.reply("Failed to unban that user.");
      }
    }

    // ===================== OWNER / BLACKLIST / STATUS / MOOD ===================== //

    // BLOCK BLACKLISTED USERS FROM USING COMMANDS OR THE CHATBOT
    const ownerBlacklistCheck = await isBlacklisted(message.author.id);
    if (ownerBlacklistCheck) {
      return message.reply("You are blacklisted from using this bot.").catch(() => { });
    }

    if (command === 'blacklist') {
      if (!isOwner(message)) {
        return message.reply('Only my owner can use this command.').catch(() => { });
      }

      const target = message.mentions.users.first();
      if (!target) return message.reply('Mention a user to blacklist.').catch(() => { });

      await addToBlacklist(target.id, 'Blacklisted by owner');
      return message.reply(`Blacklisted <@${target.id}> globally.`).catch(() => { });
    }

    if (command === 'unblacklist') {
      if (!isOwner(message)) {
        return message.reply('Only my owner can use this command.').catch(() => { });
      }

      const target = message.mentions.users.first();
      if (!target) return message.reply('Mention a user to unblacklist.').catch(() => { });

      const targetBlacklisted = await isBlacklisted(target.id);
      if (!targetBlacklisted) {
        return message.reply('That user is not blacklisted.').catch(() => { });
      }

      await removeFromBlacklist(target.id);
      return message.reply(`Unblacklisted <@${target.id}> globally.`).catch(() => { });
    }

    if (command === 'blacklistcheck') {
      if (!isOwner(message)) {
        return message.reply('Only my owner can use this command.').catch(() => { });
      }

      const blacklistMap = await getAllBlacklist();
      const ids = Array.from(blacklistMap.keys());

      if (ids.length === 0) {
        return message.reply('No users are currently blacklisted.').catch(() => { });
      }

      const list = ids.map((id) => `• <@${id}> (\`${id}\`)`).join('\n');

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(
          (text) => text.setContent('**🔒 Blacklisted Users**'),
          (text) => text.setContent(list)
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addTextDisplayComponents((text) => text.setContent(''));


      return message.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false }
      }).catch(() => { });
    }

    if (command === 'changemood') {
      if (!isOwner(message)) return;

      currentMood = args.join(' ') || 'Neutral';
      return message.reply(`Mood set to **${currentMood}**`).catch(() => { });
    }

    if (command === 'setstatus') {
      if (!isOwner(message)) return;

      const status = args.shift()?.toLowerCase();
      const text = args.join(' ') || '';

      if (!['online', 'idle', 'dnd'].includes(status)) {
        return message.reply('Status must be: `online`, `idle`, `dnd`.').catch(() => { });
      }

      client.user.setPresence({
        activities: [{ name: text, type: ActivityType.Playing }],
        status
      });

      return message.reply(`Status updated to **${status}**`).catch(() => { });
    }

    // ===================== HELP COMMAND ===================== //

    if (command === 'help') {
      try {
        const botName = client.user.username;
        const container = new ContainerBuilder()
          .setAccentColor(0x2b2d31)
          .addTextDisplayComponents(
            (text) => text.setContent(`**📚 ${botName} Help Menu**`),
            (text) => text.setContent(
              [
                '**Prefix:** `,`',
                '',
                '🛠️ **Utility** • 🕒 **AFK** • 🏆 **Leaderboard**',
                '🎉 **Fun** • 🦊 **Animals** • 🛡️ **Moderation**',
                '',
                '*Select a category below to view commands*'
              ].join('\n')
            )
          )
          .addSeparatorComponents((sep) => sep.setDivider(true))
          .addActionRowComponents((row) => row.addComponents(createHelpDropdown()))
          .addTextDisplayComponents((text) => text.setContent(`-# ${botName} • Stable Build`));

        return sendContainer(message, container);
      } catch (err) {
        console.error('Error sending help menu:', err);
      }
    }
  } catch (err) {
    console.error('Error in messageCreate handler:', err);
  }
});

// ===================== INTERACTION HANDLER ===================== //

client.on('interactionCreate', async (interaction) => {
  try {
    // ============================================================
    // HELP MENU (wide layout)
    // ============================================================
    if (interaction.isStringSelectMenu() && interaction.customId === 'help-menu') {
      const cat = HELP_CATEGORIES[interaction.values[0]];
      if (!cat) return;

      const botName = client.user.username;
      const commandList = cat.commands.map(c => `**${c.name}** - ${c.desc}`).join('\n');

      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(
          (text) => text.setContent(`**${cat.emoji} ${cat.title}**`),
          (text) => text.setContent(commandList)
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addActionRowComponents((row) => row.addComponents(createHelpDropdown()))
        .addTextDisplayComponents((text) => text.setContent(`-# ${botName} • Help System`));

      return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    // ============================================================
    // LEADERBOARD BUTTONS (AFK + MSG)
    // ============================================================
    if (interaction.isButton()) {
      const [type, pageStr] = interaction.customId.split(':');
      let page = parseInt(pageStr);

      const data = leaderboardPages.get(interaction.message.id);
      if (!data) return;

      const isAfk = data.type === 'afk';
      const isMsg = data.type === 'msg';

      let entries;

      if (isAfk) {
        const afkTotals = await getAllAfkData();
        entries = Array.from(afkTotals.entries())
          .filter(([_, ms]) => ms > 0)
          .sort((a, b) => b[1] - a[1]);
      } else if (isMsg) {
        const msgCounts = await getAllMsgCounts();
        entries = Array.from(msgCounts.entries())
          .filter(([k, count]) => {
            const [guildId] = k.split(':');
            return guildId === interaction.guild.id && count > 0;
          })
          .map(([k, count]) => {
            const oduserId = k.split(':')[1];
            return [oduserId, count];
          })
          .sort((a, b) => b[1] - a[1]);
      }

      const pageSize = 10;
      const totalPages = Math.ceil(entries.length / pageSize);

      if (type.endsWith('next') && page < totalPages - 1) page++;
      if (type.endsWith('prev') && page > 0) page--;

      data.page = page;
      leaderboardPages.set(interaction.message.id, data);

      const start = page * pageSize;
      const pageEntries = entries.slice(start, start + pageSize);

      const lines = pageEntries.map(([oduserId, value], i) => {
        const rank = start + i + 1;
        if (isAfk) return `**${rank}.** <@${oduserId}> — ${formatDuration(value)}`;
        if (isMsg) return `**${rank}.** <@${oduserId}> — **${value} messages**`;
      });

      const botName = client.user.username;
      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(
          (text) => text.setContent(isAfk ? '**🏆 AFK Leaderboard**' : '**🏆 Message Leaderboard**'),
          (text) => text.setContent(lines.join('\n') + `\n\nPage **${page + 1}** of **${totalPages}**`)
        )
        .addSeparatorComponents((sep) => sep.setDivider(true))
        .addActionRowComponents((row) =>
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`${isAfk ? 'afk_prev' : 'msg_prev'}:${page}`)
              .setLabel('Prev')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId(`${isAfk ? 'afk_next' : 'msg_next'}:${page}`)
              .setLabel('Next')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page >= totalPages - 1)
          )
        );

      return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
  } catch (err) {
    console.error('Interaction failed:', err);
  }
});

// ===================== LOGIN ===================== //

client.login(TOKEN);


















































































