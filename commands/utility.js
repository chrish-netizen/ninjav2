import { ContainerBuilder, MessageFlags, EmbedBuilder } from 'discord.js';

export async function handleUtilityCommands(ctx) {
  const { message, command, client, args } = ctx;

  // PING
  if (command === 'ping') {
    const sent = await message.reply({ content: '🏓 Pinging...', allowedMentions: { repliedUser: false } });
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        (text) => text.setContent('**🏓 Pong!**'),
        (text) => text.setContent(`⚡ **Latency:** ${latency}ms\n📡 **API Latency:** ${apiLatency}ms`)
      )
      .addSeparatorComponents((sep) => sep.setDivider(true))
      .addTextDisplayComponents((text) => text.setContent(`-# ${client.user.username}`));

    await sent.edit({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
    return true;
  }

  // INFO
  if (command === 'info') {
    const servers = client.guilds.cache.size;
    const users = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);

    const container = new ContainerBuilder()
      .setAccentColor(0x2b2d31)
      .addTextDisplayComponents(text =>
        text.setContent(
          `## 🧩 Ninja V2 — Bot Information\n\n` +
          `**Status:** Online\n` +
          `**Servers:** ${servers}\n` +
          `**Users:** ${users}\n\n` +
          `### 🌐 Dashboard\n` +
          `https://ninjav2info.koyeb.app/\n\n` +
          `Thank you for using Ninja V2.`
        )
      );

    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
    return true;
  }

  // AVATAR
  if (command === 'avatar') {
    const user = message.mentions.users.first() || 
                 (args[0] && await client.users.fetch(args[0]).catch(() => null)) || 
                 message.author;

    const container = new ContainerBuilder()
      .setAccentColor(0x2b2d31)
      .addTextDisplayComponents((text) => text.setContent(`**🖼️ Avatar: ${user.username}**`))
      .addMediaGalleryComponents((gallery) =>
        gallery.addItems((item) => item.setURL(user.displayAvatarURL({ size: 1024, dynamic: true })))
      );

    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
    return true;
  }

  // USERINFO
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
      .addTextDisplayComponents((text) => text.setContent('-# Bot • Stable Build'));

    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
    return true;
  }

  // UPTIME
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

    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
    return true;
  }

  return false; // Command not handled
}
