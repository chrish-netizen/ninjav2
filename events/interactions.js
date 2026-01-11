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
