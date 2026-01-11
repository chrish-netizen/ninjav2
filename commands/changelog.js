import { ContainerBuilder, MessageFlags, ButtonBuilder, ButtonStyle, ActionRowBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';

const changelog = [
  {
    title: "Bug Fixes",
    version: "1.0.3",
    date: "2026-01-09",
    changes: ["Fixed ,time","Fixed all storage"],
  },
  {
    title: "Timzones Update",
    version: "1.0.2",
    date: "2026-01-07",
    changes: ["Added 25+ timezones", "Added ,settz command ", "added a ,time command","Added a ,tzunlink command"],
  },
  {
    title: "Initial Release",
    version: "1.0.1",
    date: "2026-01-05",
    changes: ["Fixed afk storage","Added a ,changelog command"],
  },
];

export async function handleChangelogCommand(ctx) {
  const { message, command } = ctx;

  if (command !== 'changelog') return false;

  try {
    if (!changelog || !Array.isArray(changelog) || changelog.length === 0) {
      await message.reply("No changelog entries available.");
      return true;
    }

    const page = 0;
    const entry = changelog[page];

    if (!entry || typeof entry !== 'object') {
      await message.reply("Could not load changelog entry.");
      return true;
    }

    if (!entry.title || !entry.version || !entry.date || !entry.changes) {
      await message.reply("Changelog entry is missing required fields.");
      return true;
    }

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`## ${entry.title}\n**Version:** \`${entry.version}\`\n**Date:** \`${entry.date}\``)
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(entry.changes.map(c => `• ${c}`).join("\n"))
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`*Page ${page + 1} of ${changelog.length}*`)
      );

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`cl_prev_${page}`)
          .setLabel("Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),

        new ButtonBuilder()
          .setCustomId(`cl_next_${page}`)
          .setLabel("Next")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === changelog.length - 1),

        new ButtonBuilder()
          .setCustomId("cl_latest")
          .setLabel("Latest")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0)
      );

    container.addActionRowComponents(row);

    await message.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
    return true;
  } catch (error) {
    console.error("Changelog command error:", error);
    await message.reply("An error occurred loading the changelog.");
    return true;
  }
}

// Export for interactions handler
export { changelog };
