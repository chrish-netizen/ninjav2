import { ContainerBuilder, MessageFlags, StringSelectMenuBuilder } from 'discord.js';

// Help categories data
const HELP_CATEGORIES = {
  utility: {
    emoji: '🛠️',
    title: 'Utility Commands',
    commands: [
      { name: ',serverinfo', desc: 'shows everything about the server' },
      { name: ',ping', desc: 'Check bot latency' },
      { name: ',info', desc: 'Bot info' },
      { name: ',avatar', desc: 'User avatar' },
      { name: ',userinfo', desc: 'User details' },
      { name: ',translate', desc: 'Translate a message' },
      { name: ',ownerinfo', desc: 'show the owners info' },
      { name: ',memberdm', desc: 'DM any user with the command' },
      { name: ',servericon', desc: 'show the servers icon' },
      { name: ',changelog', desc: 'show all bot updates' },
      { name: ',settz', desc: 'set your timezone with a valid country' },
      { name: ',time', desc: 'shows time and allows you to change tz' },
      { name: ',unlinktime', desc: 'unlink your timezone' },
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
function createHelpDropdown() {
  return new StringSelectMenuBuilder()
    .setCustomId('help-menu')
    .setPlaceholder('Select a category')
    .addOptions(
      Object.entries(HELP_CATEGORIES).map(([value, { emoji, title }]) => ({
        label: title.replace(' Commands', ''),
        value,
        description: title
      }))
    );
}

export async function handleHelpCommand(ctx) {
  const { message, command, client } = ctx;

  if (command !== 'help') return false;

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

    await message.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { repliedUser: false }
    });

    return true;
  } catch (err) {
    console.error('Error sending help menu:', err);
    return true;
  }
}

// Export for interactions handler
export { HELP_CATEGORIES, createHelpDropdown };
