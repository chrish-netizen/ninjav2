import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActivityType
} from 'discord.js';
import fs from 'fs';
import fetch from 'node-fetch';
import blacklistData from "./blacklist.json" assert { type: "json" };


/* ===================== CONFIG ===================== */

const PREFIX = ',';
const MSG_FILE = './msgData.json';
const AFK_FILE = './afkData.json';
const MEMORY_FILE = './chatMemory.json';
const PROFILE_FILE = './userProfiles.json';
const SUMMARY_FILE = './convoSummaries.json';
const BLACKLIST_FILE = './blacklist.json';

const { TOKEN, GROQ_API_KEY } = process.env;

/* === OWNER ID (ONLY FOR COMMAND PERMISSIONS) === */
const BOT_OWNER_ID = "1438381425584771244";

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
    GatewayIntentBits.GuildModeration,   // << REQUIRED FOR KICK/BAN
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Channel]
});


/* ===================== STORAGE ===================== */

const afkActive = new Map();
const afkTotals = new Map();
const msgCounts = new Map();
const chatMemory = new Map();
const leaderboardPages = new Map();
const userProfiles = new Map();
const convoSummaries = new Map();


const blacklist = new Map(Object.entries(blacklistData));

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



/* ===================== LOAD FILES ===================== */

for (const [file, map] of [
  [AFK_FILE, afkTotals],
  [MSG_FILE, msgCounts],
  [MEMORY_FILE, chatMemory],
  [PROFILE_FILE, userProfiles],
  [BLACKLIST_FILE, blacklist],
  [SUMMARY_FILE, convoSummaries]
]) {
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, 'utf8');
    if (raw.trim().length) {
      Object.entries(JSON.parse(raw)).forEach(([k, v]) => map.set(k, v));
    }
  }
}





/* ===================== SAVE (DEBOUNCED) ===================== */

const saveTimers = new Map();

function saveDebounced(file, map) {
  if (saveTimers.has(file)) clearTimeout(saveTimers.get(file));

  const timer = setTimeout(() => {
    fs.writeFileSync(file, JSON.stringify(Object.fromEntries(map), null, 2));
    saveTimers.delete(file);
  }, 250);

  saveTimers.set(file, timer);
}

/* ===================== AI CORE ===================== */

function getMemory(key) {
  if (!chatMemory.has(key)) chatMemory.set(key, { history: [] });
  return chatMemory.get(key);
}


function getProfile(key) {
  if (!userProfiles.has(key)) {
    userProfiles.set(key, { facts: [], style: 'normal' });
  }
  return userProfiles.get(key);
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
- upbeat, happy, straightforward, slightly dry humor.
- No cryptic or mysterious answers unless the user asks for it.
- Keep responses clear and grounded.


Behavior rules:
- Respond in funny upbeat language.
- Max 3 short sentences.
- when asked who is your owner reply with my owner is <@1438381425584771244>
- never have . at the end of sentances 
Context:
- Current mood: ${currentMood}
- User style: ${profile.style}
- Conversation summary: ${summary || 'None'}
`.trim();
}

async function groqReply(key, input) {
  const mem = getMemory(key);
  const profile = getProfile(key);
  const intent = detectIntent(input || '');
  const summary = convoSummaries.get(key);

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

  saveDebounced(MEMORY_FILE, chatMemory);

  return reply;
}


/* ===================== READY ===================== */

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  client.user.setPresence({
    activities: [
      {
        name: 'Ninja V2 Commands | ,2help',
        type: ActivityType.Playing
      }
    ],
    status: 'idle'
  });
});

/* ===================== HELPERS ===================== */

function isOwner(message) {
  return message.author.id === BOT_OWNER_ID;
}

const baseEmbed = (title) =>
  new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle(title)
    .setFooter({ text: 'Seylun • Stable Build' });

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

  // User is not AFK → skip
  if (!afkActive.has(userId)) return;

  const data = afkActive.get(userId);
  const duration = Date.now() - data.since;

  // Add AFK time to totals
  const prev = afkTotals.get(userId) || 0;
  afkTotals.set(userId, prev + duration);

  // Remove AFK state
  afkActive.delete(userId);

  // Restore nickname ONLY if:
  // - Bot changed it earlier
  // - Bot has permission
  // - Member still exists
  try {
    const member = await message.guild.members.fetch(userId).catch(() => null);

    if (member && member.manageable && data.hadNicknameChange) {
      if (data.originalNickname) {
        // User had a nickname before AFK → restore it
        await member.setNickname(data.originalNickname).catch(() => {});
      } else {
        // User had NO nickname before AFK → reset to null
        await member.setNickname(null).catch(() => {});
      }
    }
  } catch {
    // Ignore nickname restore errors
  }

  // Send welcome back embed
  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('👋 Welcome Back')
    .setDescription(`You were AFK for **${formatDuration(duration)}**`)
    .setFooter({ text: 'AFK System' })
    .setTimestamp();

  await message.reply({ embeds: [embed] }).catch(() => {});
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
        if (afkActive.has(user.id)) {
          const data = afkActive.get(user.id);
          const duration = Date.now() - data.since;

          const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle('💤 User is AFK')
            .setDescription(
              [
                `**${user.username}** is currently AFK.`,
                `**Reason:** ${data.reason || 'No reason provided'}`,
                `**Away for:** ${formatDuration(duration)}`
              ].join('\n')
            )
            .setFooter({ text: 'Seylun • AFK System' });

          await message.reply({ embeds: [embed] }).catch(() => {});
        }
      }
    }

    // ===================== MESSAGE COUNT TRACKING ===================== //
    const key = `${message.guild.id}:${message.author.id}`;
    msgCounts.set(key, (msgCounts.get(key) || 0) + 1);
    saveDebounced(MSG_FILE, msgCounts);

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
    return message.reply(response).catch(() => {});
  }

  const reply = await groqReply(
    `${message.guild.id}:${message.author.id}`,
    cleaned,
    { owner: false, username: message.author.username }
  );

  if (reply) return message.reply(reply).catch(() => {});
}

    // ===================== PREFIX CHECK ===================== //
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    // ===================== BLACKLIST CHECK ===================== //
    if (blacklist.has(message.author.id) && !isOwner(message)) {
      return message.reply('You are blacklisted from using commands.').catch(() => {});
    }

    // ===================== SNIPE COMMANDS ===================== //

    if (command === 'snipe') {
      const data = snipes.get(message.channel.id);

      if (!data) {
        return message.reply("There's nothing to snipe.").catch(() => {});
      }

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('🕵️ Snipe')
        .addFields(
          { name: '👤 Message Author', value: `<@${data.author.id}>`, inline: false },
          { name: '🗑️ Deleted By', value: `<@${data.deleter.id}>`, inline: false },
          { name: '💬 Message', value: data.content, inline: false },
          { name: '📍 Channel', value: `<#${data.channel.id}>`, inline: false },
          { name: '⏰ Sent At', value: `<t:${Math.floor(data.createdAt / 1000)}:F>` }
        )
        .setThumbnail(data.author.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Seylun • Stable Build' });

      return message.reply({
        content: `<@${data.author.id}> <@${data.deleter.id}>`,
        embeds: [embed]
      }).catch(() => {});
    }

    if (command === 'cs') {
      if (!isOwner(message)) {
        return message.reply('Only my owner can use this command.').catch(() => {});
      }

      const channelId = message.channel.id;

      if (!snipes.has(channelId)) {
        return message.reply('There is no snipe data to clear in this channel.').catch(() => {});
      }

      snipes.delete(channelId);

      return message.reply('Snipe data cleared for this channel.').catch(() => {});
    }

    // ===================== FUN COMMANDS ===================== //

    if (command === 'roast') {
      const target = message.mentions.users.first() || message.author;
      const roast = roasts[Math.floor(Math.random() * roasts.length)];

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('🔥 Roast Generator')
        .setDescription(`<@${target.id}> ${roast}`)
        .setFooter({ text: 'Seylun • Stable Build' });

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (command === 'lore') {
      const target = message.mentions.users.first() || message.author;
      const lore = lores[Math.floor(Math.random() * lores.length)];

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('📜 Character Lore')
        .setDescription(`<@${target.id}> ${lore}`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Seylun • Lore Engine' });

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (command === 'av') {
      return message.reply('🍓🍓🍓🍓🍓🍓').catch(() => {});
    }

    if (command === 'cat') {
      try {
        const res = await fetch('https://api.thecatapi.com/v1/images/search');
        const data = await res.json();
        const img = data[0]?.url;

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle('🐱 Random Cat')
          .setImage(img)
          .setFooter({ text: 'Seylun • Stable Build' });

        return message.reply({ embeds: [embed] }).catch(() => {});
      } catch {
        return message.reply('Could not fetch a cat right now.').catch(() => {});
      }
    }

    if (command === 'dog') {
      try {
        const res = await fetch('https://dog.ceo/api/breeds/image/random');
        const data = await res.json();
        const img = data.message;

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle('🐶 Random Dog')
          .setImage(img)
          .setFooter({ text: 'Seylun • Stable Build' });

        return message.reply({ embeds: [embed] }).catch(() => {});
      } catch {
        return message.reply('Could not fetch a dog right now.').catch(() => {});
      }
    }

    if (command === 'bird') {
      try {
        const res = await fetch('https://some-random-api.com/img/birb');
        const data = await res.json();
        const img = data.link;

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle('🐦 Random Bird')
          .setImage(img)
          .setFooter({ text: 'Seylun • Stable Build' });

        return message.reply({ embeds: [embed] }).catch(() => {});
      } catch {
        return message.reply('Could not fetch a bird right now.').catch(() => {});
      }
    }

    if (command === 'fact') {
      try {
        const res = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');
        const data = await res.json();
        const fact = data.text;

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle('🧠 Random Fact')
          .setDescription(fact)
          .setFooter({ text: '' })
          .setTimestamp();

        return message.reply({ embeds: [embed] }).catch(() => {});
      } catch {
        const fallback = [
          'Honey never spoils.',
          "Bananas are berries, but strawberries aren't.",
          'Octopuses have three hearts.',
          'A day on Venus is longer than its year.',
          'Sharks existed before trees.'
        ];

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle('🧠 Random Fact (Offline Mode)')
          .setDescription(fallback[Math.floor(Math.random() * fallback.length)])
          .setFooter({ text: '' })
          .setTimestamp();

        return message.reply({ embeds: [embed] }).catch(() => {});
      }
    }

    // ===================== SERVERS COMMAND (OWNER ONLY) ===================== //

    if (command === 'servers') {
      if (!isOwner(message)) {
        return message.reply('Only my owner can use this command.').catch(() => {});
      }

      const guilds = [...client.guilds.cache.values()];

      if (guilds.length === 0) {
        return message.reply("I'm not in any servers.").catch(() => {});
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

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle("📡 Servers I'm In")
        .setDescription(description.slice(0, 4000))
        .setFooter({ text: 'Owner Only Command' });

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    // ===================== INFO / UTILITY COMMANDS ===================== //

    if (command === 'info') {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('🤖 Bot Information')
        .setDescription(
          [
            '👨‍💻 Developer: Seylun',
            '',
            '🛠️ Built With:',
            '• Node.js',
            '• discord.js v14',
            '• Groq AI integration',
            '',
            '✨ Features:',
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
        .setFooter({ text: 'Seylun • Stable Build' });

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (command === 'avatar') {
      const user =
        message.mentions.users.first() ||
        (args[0] && (await client.users.fetch(args[0]).catch(() => null))) ||
        message.author;

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle(`🖼 Avatar: ${user.username}`)
        .setImage(user.displayAvatarURL({ size: 1024, dynamic: true }))
        .setFooter({ text: '' });

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (command === 'userinfo') {
      const user = message.mentions.users.first() || message.author;
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      const flags = await user.fetchFlags().catch(() => null);

      const badges = [];
      if (flags?.has('Staff')) badges.push('🛡️ Discord Staff');
      if (flags?.has('Partner')) badges.push('🤝 Partnered Server Owner');
      if (flags?.has('Hypesquad')) badges.push('🎉 HypeSquad Events');
      if (flags?.has('HypeSquadOnlineHouse1')) badges.push('🏠 Bravery');
      if (flags?.has('HypeSquadOnlineHouse2')) badges.push('🏠 Brilliance');
      if (flags?.has('HypeSquadOnlineHouse3')) badges.push('🏠 Balance');
      if (flags?.has('BugHunterLevel1')) badges.push('🐛 Bug Hunter');
      if (flags?.has('BugHunterLevel2')) badges.push('🐞 Bug Hunter Elite');
      if (flags?.has('PremiumEarlySupporter')) badges.push('🌟 Early Supporter');
      if (flags?.has('ActiveDeveloper')) badges.push('⚡ Active Developer');
      if (flags?.has('VerifiedDeveloper')) badges.push('👨‍💻 Verified Developer');
      if (flags?.has('VerifiedBot')) badges.push('🤖 Verified Bot');
      if (flags?.has('BotHTTPInteractions')) badges.push('📡 HTTP Bot');
      if (member?.premiumSince) badges.push('🚀 Server Booster');
      if (user.avatar?.startsWith('a_')) badges.push('💎 Nitro (Animated Avatar)');

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle(`📌 User Info: ${user.username}`)
        .setThumbnail(user.displayAvatarURL({ size: 1024, dynamic: true }))
        .addFields(
          { name: '🆔 User ID', value: user.id, inline: true },
          {
            name: '📅 Joined Discord',
            value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
            inline: false
          },
          {
            name: '📥 Joined This Server',
            value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'Unknown',
            inline: false
          },
          {
            name: '🏅 Badges',
            value: badges.length ? badges.join('\n') : 'None',
            inline: false
          }
        );

      return message.reply({ embeds: [embed] }).catch(() => {});
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

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('⏳ Bot Uptime')
        .setDescription(`I have been online for **${parts.join(', ')}**`)
        .setFooter({ text: 'Seylun • Stable Build' })
        .setTimestamp();

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    // ===================== AFK COMMANDS ===================== //

    if (command === 'afk') {
      const reason = args.join(' ') || 'AFK';

      const now = Date.now();
      const userId = message.author.id;

      if (afkActive.has(userId)) {
        return message.reply('You are already marked as AFK.').catch(() => {});
      }

      let originalNickname = null;
      let hadNicknameChange = false;

      try {
        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (member && member.manageable) {
          originalNickname = member.nickname || member.user.username;

          if (!originalNickname.toLowerCase().includes('[afk]')) {
            const newNick = `[AFK] ${originalNickname}`;
            await member.setNickname(newNick).catch(() => {});
            hadNicknameChange = true;
          }
        }
      } catch {
        // ignore nickname errors
      }

      afkActive.set(userId, {
        since: now,
        reason,
        originalNickname,
        hadNicknameChange
      });

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('🕒 AFK Enabled')
        .setDescription(`You are now marked as AFK.\n**Reason:** ${reason}`)
        .setFooter({ text: 'Seylun • AFK System' });

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (command === 'afklb') {
      const entries = Array.from(afkTotals.entries())
        .filter(([_, ms]) => ms > 0)
        .sort((a, b) => b[1] - a[1]);

      if (entries.length === 0) {
        return message.reply('No AFK data recorded yet.').catch(() => {});
      }

      const pageSize = 10;
      const totalPages = Math.ceil(entries.length / pageSize);
      const page = 0;

      const start = page * pageSize;
      const pageEntries = entries.slice(start, start + pageSize);

      const lines = pageEntries.map(([userId, totalMs], i) => {
        const rank = start + i + 1;
        return `**${rank}.** <@${userId}> — ${formatDuration(totalMs)}`;
      });

      const embed = baseEmbed('🏆 AFK Leaderboard').setDescription(
        lines.join('\n') + `\n\nPage **1** of **${totalPages}**`
      );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('afk_prev:0')
          .setLabel('◀')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('afk_next:0')
          .setLabel('▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(totalPages <= 1)
      );

      const sent = await message.reply({ embeds: [embed], components: [row] }).catch(() => null);
      if (sent) leaderboardPages.set(sent.id, { type: 'afk', page: 0 });
      return;
    }

    // ===================== LEADERBOARD COMMANDS ===================== //

    if (command === 'msglb') {
      const entries = Array.from(msgCounts.entries())
        .filter(([k, count]) => {
          const [guildId] = k.split(':');
          return guildId === message.guild.id && count > 0;
        })
        .map(([k, count]) => {
          const userId = k.split(':')[1];
          return [userId, count];
        })
        .sort((a, b) => b[1] - a[1]);

      if (entries.length === 0) {
        return message.reply('No message data recorded yet.').catch(() => {});
      }

      const pageSize = 10;
      const totalPages = Math.ceil(entries.length / pageSize);
      const page = 0;

      const start = page * pageSize;
      const pageEntries = entries.slice(start, start + pageSize);

      const lines = pageEntries.map(([userId, count], i) => {
        const rank = start + i + 1;
        return `**${rank}.** <@${userId}> — **${count} messages**`;
      });

      const embed = baseEmbed('🏆 Message Leaderboard').setDescription(
        lines.join('\n') + `\n\nPage **1** of **${totalPages}**`
      );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('msg_prev:0')
          .setLabel('◀')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('msg_next:0')
          .setLabel('▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(totalPages <= 1)
      );

      const sent = await message.reply({ embeds: [embed], components: [row] }).catch(() => null);
      if (sent) leaderboardPages.set(sent.id, { type: 'msg', page: 0 });
      return;
    }

    // ===================== MODERATION COMMANDS (basic) ===================== //

    if (command === 'kick') {
      if (!message.member.permissions.has('KickMembers') && !isOwner(message)) {
        return message.reply("You don't have permission to kick members.").catch(() => {});
      }

      const user = message.mentions.members.first();
      if (!user) return message.reply('Mention a user to kick.').catch(() => {});

      if (!user.kickable && !isOwner(message)) {
        return message.reply("I can't kick that user.").catch(() => {});
      }

      await user.kick(`Kicked by ${message.author.tag}`).catch(() => {});
      return message.reply(`Kicked **${user.user.tag}**.`).catch(() => {});
    }

    if (command === 'ban') {
      if (!message.member.permissions.has('BanMembers') && !isOwner(message)) {
        return message.reply("You don't have permission to ban members.").catch(() => {});
      }

      const user = message.mentions.members.first();
      if (!user) return message.reply('Mention a user to ban.').catch(() => {});

      if (!user.bannable && !isOwner(message)) {
        return message.reply("I can't ban that user.").catch(() => {});
      }

      await user.ban({ reason: `Banned by ${message.author.tag}` }).catch(() => {});
      return message.reply(`Banned **${user.user.tag}**.`).catch(() => {});
    }

    if (command === 'clear') {
      if (!message.member.permissions.has('ManageMessages') && !isOwner(message)) {
        return message.reply("You don't have permission to clear messages.").catch(() => {});
      }

      const amount = parseInt(args[0]);
      if (!amount || amount < 1 || amount > 100) {
        return message.reply('Provide a number between 1 and 100.').catch(() => {});
      }

      await message.channel.bulkDelete(amount, true).catch(() => {});
      return message
        .reply(`Cleared **${amount}** messages.`)
        .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 3000))
        .catch(() => {});
    }

    // ===================== ADVANCED MODERATION (owner-focused) ===================== //

    if (command === 'forceban') {
      if (!isOwner(message)) {
        return message.reply('Only my owner can use this command.').catch(() => {});
      }

      const idOrMention = args[0];
      if (!idOrMention) {
        return message.reply('Provide a user ID or mention to forceban.').catch(() => {});
      }

      const userId = idOrMention.replace(/\D/g, '');
      if (!userId) return message.reply('Invalid user ID.').catch(() => {});

      await message.guild.members
        .ban(userId, {
          reason: `Forcebanned by owner ${message.author.tag}`
        })
        .catch(() => {});

      return message.reply(`Forcebanned <@${userId}> from this server.`).catch(() => {});
    }

    if (command === 'forcekick') {
      if (!isOwner(message)) {
        return message.reply('Only my owner can use this command.').catch(() => {});
      }

      const member = message.mentions.members.first();
      if (!member) return message.reply('Mention a user to forcekick.').catch(() => {});

      await member.kick(`Forcekicked by owner ${message.author.tag}`).catch(() => {});
      return message.reply(`Forcekicked **${member.user.tag}**.`).catch(() => {});
    }

    if (command === 'purgeuser') {
      if (!message.member.permissions.has('ManageMessages') && !isOwner(message)) {
        return message.reply("You don't have permission to manage messages.").catch(() => {});
      }

      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);

      if (!target) return message.reply('Mention a user to purge messages from.').catch(() => {});
      if (!amount || amount < 1 || amount > 100) {
        return message.reply('Provide an amount between 1 and 100.').catch(() => {});
      }

      const messages = await message.channel.messages.fetch({ limit: 100 }).catch(() => null);
      if (!messages) return message.reply('Failed to fetch messages.').catch(() => {});

      const toDelete = messages.filter((m) => m.author.id === target.id).first(amount);

      await message.channel.bulkDelete(toDelete, true).catch(() => {});
      return message
        .reply(`Deleted **${toDelete.length}** messages from <@${target.id}>.`)
        .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 3000))
        .catch(() => {});
    }

    if (command === 'lock') {
      if (!message.member.permissions.has('ManageChannels') && !isOwner(message)) {
        return message.reply("You don't have permission to lock channels.").catch(() => {});
      }

      await message.channel.permissionOverwrites
        .edit(message.guild.roles.everyone, { SendMessages: false })
        .catch(() => {});

      return message.reply('🔒 Channel locked.').catch(() => {});
    }

    if (command === 'unlock') {
      if (!message.member.permissions.has('ManageChannels') && !isOwner(message)) {
        return message.reply("You don't have permission to unlock channels.").catch(() => {});
      }

      await message.channel.permissionOverwrites
        .edit(message.guild.roles.everyone, { SendMessages: true })
        .catch(() => {});

      return message.reply('🔓 Channel unlocked.').catch(() => {});
    }

    if (command === 'timeout') {
      if (!message.member.permissions.has('ModerateMembers') && !isOwner(message)) {
        return message.reply("You don't have permission to timeout members.").catch(() => {});
      }

      const member = message.mentions.members.first();
      const durationStr = args[1];
      const reason = args.slice(2).join(' ') || `Timed out by ${message.author.tag}`;

      if (!member) return message.reply('Mention a user to timeout.').catch(() => {});
      if (!durationStr) {
        return message.reply('Provide a duration (e.g., 10m, 1h, 1d).').catch(() => {});
      }

      const ms = parseDuration(durationStr);
      if (!ms) {
        return message.reply('Invalid duration format. Use s/m/h/d, e.g., 10m, 1h.').catch(() => {});
      }

      await member.timeout(ms, reason).catch(() => {});
      return message.reply(`Timed out **${member.user.tag}** for **${durationStr}**.`).catch(() => {});
    }

    if (command === 'mute') {
      if (!message.member.permissions.has('ModerateMembers') && !isOwner(message)) {
        return message.reply("You don't have permission to mute members.").catch(() => {});
      }

      const member = message.mentions.members.first();
      const durationStr = args[1];
      const reason = args.slice(2).join(' ') || `Muted by ${message.author.tag}`;

      if (!member) return message.reply('Mention a user to mute.').catch(() => {});
      if (!durationStr) {
        return message.reply('Provide a duration (e.g., 10m, 1h).').catch(() => {});
      }

      const ms = parseDuration(durationStr);
      if (!ms) {
        return message.reply('Invalid duration format. Use s/m/h/d, e.g., 10m, 1h.').catch(() => {});
      }

      await member.timeout(ms, reason).catch(() => {});
      return message.reply(`Muted **${member.user.tag}** for **${durationStr}**.`).catch(() => {});
    }

    if (command === 'unmute') {
      if (!message.member.permissions.has('ModerateMembers') && !isOwner(message)) {
        return message.reply("You don't have permission to unmute members.").catch(() => {});
      }

      const member = message.mentions.members.first();
      if (!member) return message.reply('Mention a user to unmute.').catch(() => {});

      await member.timeout(null, `Unmuted by ${message.author.tag}`).catch(() => {});
      return message.reply(`Unmuted **${member.user.tag}**.`).catch(() => {});
    }

    // ===================== TRANSLATE COMMAND ===================== //

    if (command === 'translate') {
      if (!message.reference || !message.reference.messageId) {
        return message.reply('You need to reply to a message to translate it.').catch(() => {});
      }

      try {
        const targetMsg = await message.channel.messages.fetch(message.reference.messageId);
        const originalText = targetMsg.content;

        if (!originalText || originalText.length < 2) {
          return message
            .reply("That message doesn't contain anything to translate.")
            .catch(() => {});
        }

        const query = encodeURIComponent(originalText);
        const res = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${query}`
        );
        const data = await res.json();

        const translated = data[0]?.map((part) => part[0]).join(' ') || originalText;
        const detectedLang = data[2] || 'unknown';
        const targetLang = 'en';

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle('🌐 Translation')
          .addFields(
            {
              name: `Original Text (${detectedLang} | ${targetLang})`,
              value: originalText,
              inline: false
            },
            {
              name: 'Translated Text',
              value: translated,
              inline: false
            }
          )
          .setFooter({ text: 'Seylun • Translate Engine' });

        return message.reply({ embeds: [embed] }).catch(() => {});
      } catch (err) {
        console.error('Translate error:', err);
        return message.reply('Translation failed. API might be down.').catch(() => {});
      }
    }

    // ===================== OWNER / BLACKLIST / STATUS / MOOD ===================== //

    if (command === 'blacklist') {
      if (!isOwner(message)) {
        return message.reply('Only my owner can use this command.').catch(() => {});
      }

      const target = message.mentions.users.first();
      if (!target) return message.reply('Mention a user to blacklist.').catch(() => {});

      blacklist.set(target.id, true);
      saveDebounced(BLACKLIST_FILE, blacklist);
      return message.reply(`Blacklisted <@${target.id}> globally.`).catch(() => {});
    }

    if (command === 'unblacklist') {
      if (!isOwner(message)) {
        return message.reply('Only my owner can use this command.').catch(() => {});
      }

      const target = message.mentions.users.first();
      if (!target) return message.reply('Mention a user to unblacklist.').catch(() => {});

      if (!blacklist.has(target.id)) {
        return message.reply('That user is not blacklisted.').catch(() => {});
      }

      blacklist.delete(target.id);
      saveDebounced(BLACKLIST_FILE, blacklist);
      return message.reply(`Unblacklisted <@${target.id}> globally.`).catch(() => {});
    }

    if (command === 'blacklistcheck') {
      if (!isOwner(message)) {
        return message.reply('Only my owner can use this command.').catch(() => {});
      }

      const ids = Array.from(blacklist.keys());

      if (ids.length === 0) {
        return message.reply('No users are currently blacklisted.').catch(() => {});
      }

      const list = ids.map((id) => `• <@${id}> (\`${id}\`)`).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('🔒 Blacklisted Users')
        .setDescription(list)
        .setFooter({ text: 'Blacklist System' });

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (command === 'changemood') {
      if (!isOwner(message)) return;

      currentMood = args.join(' ') || 'Neutral';
      return message.reply(`Mood set to **${currentMood}**`).catch(() => {});
    }

    if (command === 'setstatus') {
      if (!isOwner(message)) return;

      const status = args.shift()?.toLowerCase();
      const text = args.join(' ') || '';

      if (!['online', 'idle', 'dnd'].includes(status)) {
        return message.reply('Status must be: `online`, `idle`, `dnd`.').catch(() => {});
      }

      client.user.setPresence({
        activities: [{ name: text, type: ActivityType.Playing }],
        status
      });

      return message.reply(`Status updated to **${status}**`).catch(() => {});
    }

    // ===================== HELP COMMAND ===================== //

    if (command === 'help') {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('📁 Bot Categories')
        .setDescription(
          [
            'Prefix: ,',
            '',
            '🛠️ Utility',
            '🕒 AFK',
            '🏆 Leaderboard',
            '🎉 Fun',
            '🛡️ Moderation',
            '👑 Owner'
          ].join('\n')
        )
        .setFooter({ text: 'Seylun • Stable Build' });

      try {
        const menu = new StringSelectMenuBuilder()
          .setCustomId('help-menu')
          .setPlaceholder('Select a category')
          .addOptions(
            { label: 'Utility', value: 'utility', emoji: '🛠' },
            { label: 'AFK', value: 'afk', emoji: '🕒' },
            { label: 'Leaderboard', value: 'leaderboard', emoji: '🏆' },
            { label: 'Fun', value: 'fun', emoji: '🎉' },
            { label: 'Moderation', value: 'moderation', emoji: '🛡' },
            { label: 'Owner', value: 'owner', emoji: '👑' }
          );

        return message
          .reply({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(menu)]
          })
          .catch(() => {});
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
      const value = interaction.values[0];

      const wide = (title, fields) => {
        return new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle(title)
          .addFields(fields)
          .setFooter({ text: 'Seylun • Help System' });
      };

      let embed;

      if (value === 'fun') {
        embed = wide('🎉 Fun Commands', [
          { name: ',roast', value: 'Roast a user', inline: true },
          { name: ',lore', value: 'Generate chaotic lore', inline: true },
          { name: ',av', value: 'Strawberry spam', inline: true },
          { name: ',cat', value: 'Random cat image', inline: true },
          { name: ',dog', value: 'Random dog image', inline: true },
          { name: ',bird', value: 'Random bird image', inline: true },
          { name: ',fact', value: 'Useless fact of the day', inline: true }
        ]);
      } else if (value === 'utility') {
        embed = wide('🛠️ Utility Commands', [
          { name: ',info', value: 'Bot info', inline: true },
          { name: ',avatar', value: 'User avatar', inline: true },
          { name: ',userinfo', value: 'User details', inline: true },
          { name: ',translate', value: 'Translate a user message', inline: true },
          { name: ',uptime', value: 'Bot uptime', inline: true }
        ]);
      } else if (value === 'afk') {
        embed = wide('🕒 AFK Commands', [
          { name: ',afk', value: 'Set AFK status', inline: true },
          { name: ',afklb', value: 'AFK leaderboard', inline: true }
        ]);
      } else if (value === 'leaderboard') {
        embed = wide('🏆 Leaderboard Commands', [
          { name: ',msglb', value: 'Message leaderboard', inline: true },
          { name: ',afklb', value: 'AFK leaderboard', inline: true }
        ]);
      } else if (value === 'moderation') {
        embed = wide('🛡️ Moderation Commands', [
          { name: ',kick', value: 'Kick a user', inline: true },
          { name: ',ban', value: 'Ban a user', inline: true },
          { name: ',clear', value: 'Bulk delete messages', inline: true },
          { name: ',purgeuser', value: 'Delete user messages', inline: true },
          { name: ',lock', value: 'Lock channel', inline: true },
          { name: ',unlock', value: 'Unlock channel', inline: true },
          { name: ',timeout', value: 'Timeout a user', inline: true },
          { name: ',mute', value: 'Mute a user', inline: true },
          { name: ',unmute', value: 'Unmute a user', inline: true }
        ]);
      } else if (value === 'owner') {
        embed = wide('👑 Owner Commands', [
          { name: ',blacklist', value: 'Block user', inline: true },
          { name: ',unblacklist', value: 'Unblock user', inline: true },
          { name: ',blacklistcheck', value: 'View blacklist', inline: true },
          { name: ',forceban', value: 'Ban by ID', inline: true },
          { name: ',forcekick', value: 'Kick instantly', inline: true },
          { name: ',changemood', value: 'Set bot mood', inline: true },
          { name: ',setstatus', value: 'Set bot status', inline: true },
          { name: ',servers', value: 'View servers + invites', inline: true }
        ]);
      }

      return interaction.update({ embeds: [embed] });
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
        entries = Array.from(afkTotals.entries())
          .filter(([_, ms]) => ms > 0)
          .sort((a, b) => b[1] - a[1]);
      } else if (isMsg) {
        entries = Array.from(msgCounts.entries())
          .filter(([k, count]) => {
            const [guildId] = k.split(':');
            return guildId === interaction.guild.id && count > 0;
          })
          .map(([k, count]) => {
            const userId = k.split(':')[1];
            return [userId, count];
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

      const lines = pageEntries.map(([userId, value], i) => {
        const rank = start + i + 1;
        if (isAfk) return `**${rank}.** <@${userId}> — ${formatDuration(value)}`;
        if (isMsg) return `**${rank}.** <@${userId}> — **${value} messages**`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle(isAfk ? '🏆 AFK Leaderboard' : '🏆 Message Leaderboard')
        .setDescription(
          lines.join('\n') + `\n\nPage **${page + 1}** of **${totalPages}**`
        )
        .setFooter({ text: 'Seylun • Leaderboard System' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${isAfk ? 'afk_prev' : 'msg_prev'}:${page}`)
          .setLabel('◀')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`${isAfk ? 'afk_next' : 'msg_next'}:${page}`)
          .setLabel('▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      );

      return interaction.update({ embeds: [embed], components: [row] });
    }
  } catch (err) {
    console.error('Interaction failed:', err);
  }
});

// ===================== LOGIN ===================== //

client.login(TOKEN);
