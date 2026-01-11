import { MessageFlags } from 'discord.js';

export async function handleInteractions(interaction, state) {
  if (interaction.isButton()) {
    // Handle button interactions (leaderboards, etc.)
    await interaction.reply({ content: 'Button clicked!', ephemeral: true });
  }
  
  if (interaction.isStringSelectMenu()) {
    // Handle select menus
    await interaction.reply({ content: 'Menu selected!', ephemeral: true });
  }
}
import { HELP_CATEGORIES } from './help.js';

export async function handleInteraction(interaction) {
  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId === 'help-menu') {
    const category = interaction.values[0];
    const data = HELP_CATEGORIES[category];

    if (!data) {
      return interaction.reply({
        content: 'Category not found.',
        ephemeral: true
      });
    }

    const commandList = data.commands
      .map(cmd => `\`${cmd.name}\` — ${cmd.desc}`)
      .join('\n');

    return interaction.reply({
      content: `**${data.emoji} ${data.title}**\n\n${commandList}`,
      ephemeral: true
    });
  }
}
