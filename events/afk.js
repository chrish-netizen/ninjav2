import { ContainerBuilder, MessageFlags } from 'discord.js';
import { getAfkData, setAfkData, getAfkActive, deleteAfkActive } from '../src/database.js';

function formatDuration(ms) {
  const units = [
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

export async function handleAfkSystem(message, state) {
  const userId = message.author.id;

  // Check if user is returning from AFK
  let data = state.afkActive.get(userId);
  if (!data) {
    data = await getAfkActive(userId);
  }

  if (data) {
    const duration = Date.now() - data.since;
    const prev = await getAfkData(userId) || 0;
    await setAfkData(userId, prev + duration);

    state.afkActive.delete(userId);
    await deleteAfkActive(userId);

    const container = new ContainerBuilder()
      .setAccentColor(0x2b2d31)
      .addTextDisplayComponents(
        (text) => text.setContent('**👋 Welcome Back**'),
        (text) => text.setContent(`You were AFK for **${formatDuration(duration)}**`)
      )
      .addSeparatorComponents((sep) => sep.setDivider(true))
      .addTextDisplayComponents((text) => text.setContent('-# AFK System'));

    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
  }

  // Check for AFK mentions
  if (message.mentions.users.size > 0) {
    for (const user of message.mentions.users.values()) {
      let afkData = state.afkActive.get(user.id);
      if (!afkData) {
        afkData = await getAfkActive(user.id);
      }

      if (afkData) {
        const duration = Date.now() - afkData.since;
        const container = new ContainerBuilder()
          .setAccentColor(0x2b2d31)
          .addTextDisplayComponents(
            (text) => text.setContent('**💤 User is AFK**'),
            (text) => text.setContent(
              [
                `**${user.username}** is currently AFK.`,
                `**Reason:** ${afkData.reason || 'No reason provided'}`,
                `**Away for:** ${formatDuration(duration)}`
              ].join('\n')
            )
          )
          .addSeparatorComponents((sep) => sep.setDivider(true))
          .addTextDisplayComponents((text) => text.setContent('-# AFK System'));

        await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
      }
    }
  }
}
