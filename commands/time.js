import { ContainerBuilder, MessageFlags, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getUserProfile, setUserProfile } from '../src/database.js';

const timezones = [
  // Americas
  { label: "🇺🇸 New York (GMT-5)", value: "America/New_York" },
  { label: "🇺🇸 Los Angeles (GMT-8)", value: "America/Los_Angeles" },
  { label: "🇨🇦 Toronto (GMT-5)", value: "America/Toronto" },
  { label: "🇲🇽 Mexico City (GMT-6)", value: "America/Mexico_City" },
  { label: "🇧🇷 São Paulo (GMT-3)", value: "America/Sao_Paulo" },
  { label: "🇦🇷 Buenos Aires (GMT-3)", value: "America/Argentina/Buenos_Aires" },
  
  // Europe
  { label: "🇬🇧 London (GMT+0)", value: "Europe/London" },
  { label: "🇫🇷 Paris (GMT+1)", value: "Europe/Paris" },
  { label: "🇩🇪 Berlin (GMT+1)", value: "Europe/Berlin" },
  { label: "🇪🇸 Madrid (GMT+1)", value: "Europe/Madrid" },
  { label: "🇮🇹 Rome (GMT+1)", value: "Europe/Rome" },
  { label: "🇳🇱 Amsterdam (GMT+1)", value: "Europe/Amsterdam" },
  { label: "🇷🇺 Moscow (GMT+3)", value: "Europe/Moscow" },
  { label: "🇬🇷 Athens (GMT+2)", value: "Europe/Athens" },
  
  // Asia
  { label: "🇦🇪 Dubai (GMT+4)", value: "Asia/Dubai" },
  { label: "🇮🇳 Mumbai (GMT+5:30)", value: "Asia/Kolkata" },
  { label: "🇹🇭 Bangkok (GMT+7)", value: "Asia/Bangkok" },
  { label: "🇸🇬 Singapore (GMT+8)", value: "Asia/Singapore" },
  { label: "🇵🇭 Manila (GMT+8)", value: "Asia/Manila" },
  { label: "🇯🇵 Tokyo (GMT+9)", value: "Asia/Tokyo" },
  { label: "🇰🇷 Seoul (GMT+9)", value: "Asia/Seoul" },
  
  // Oceania & Africa
  { label: "🇦🇺 Sydney (GMT+11)", value: "Australia/Sydney" },
  { label: "🇳🇿 Auckland (GMT+13)", value: "Pacific/Auckland" },
  { label: "🇿🇦 Johannesburg (GMT+2)", value: "Africa/Johannesburg" },
  { label: "🇪🇬 Cairo (GMT+2)", value: "Africa/Cairo" }
];

export async function handleTimeCommands(ctx) {
  const { message, command, args } = ctx;

  // TIME
  if (command === 'time') {
    try {
      const targetUser = message.mentions.users.first() || message.author;
      const profile = await getUserProfile(targetUser.id);
      
      if (profile && profile.timezone) {
        try {
          const now = new Date().toLocaleString("en-US", { 
            timeZone: profile.timezone,
            dateStyle: "full",
            timeStyle: "long"
          });
          
          const container = new ContainerBuilder()
            .addTextDisplayComponents(
              (text) => text.setContent(targetUser.id === message.author.id ? "**⏰ Your Time**" : `**⏰ ${targetUser.username}'s Time**`),
              (text) => text.setContent(
                `**Timezone:** ${profile.timezone}\n` +
                `**Current Time:** ${now}`
              )
            );
          
          if (targetUser.id === message.author.id) {
            container.addActionRowComponents((row) =>
              row.addComponents(
                new ButtonBuilder()
                  .setCustomId("time_change")
                  .setLabel("Change Timezone")
                  .setStyle(ButtonStyle.Primary),
                
                new ButtonBuilder()
                  .setCustomId("time_unlink")
                  .setLabel("Remove Timezone")
                  .setStyle(ButtonStyle.Danger)
              )
            );
          }
          
          await message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false }
          });
          return true;
        } catch (err) {
          // Invalid timezone, fall through
        }
      }
      
      if (targetUser.id !== message.author.id) {
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            (text) => text.setContent("**❌ No Timezone Set**"),
            (text) => text.setContent(`${targetUser.username} hasn't set their timezone yet.`)
          );
        
        await message.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { repliedUser: false }
        });
        return true;
      }
      
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          (text) => text.setContent("**⏰ Select Your Timezone**"),
          (text) => text.setContent("Choose your timezone from the menu below, or use `,settz <timezone>` for others.")
        )
        .addActionRowComponents((row) =>
          row.addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("time_select")
              .setPlaceholder("Select your timezone")
              .addOptions(timezones)
          )
        );
      
      await message.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false }
      });
      return true;
      
    } catch (error) {
      console.error("Time command error:", error);
      await message.reply("An error occurred while loading the timezone selector.");
      return true;
    }
  }

  // SETTZ
  if (command === 'settz') {
    try {
      const timezone = args.join(" ");
      
      if (!timezone) {
        await message.reply("Usage: `,settz <timezone>`\nExample: `,settz Asia/Manila`\n\nOr use `,time` to select from a list.");
        return true;
      }
      
      try {
        new Date().toLocaleString("en-US", { timeZone: timezone });
        
        const profile = await getUserProfile(message.author.id) || {};
        profile.timezone = timezone;
        await setUserProfile(message.author.id, profile);
        
        const now = new Date().toLocaleString("en-US", { 
          timeZone: timezone,
          dateStyle: "full",
          timeStyle: "long"
        });
        
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            (text) => text.setContent("**✅ Timezone Saved**"),
            (text) => text.setContent(
              `**Timezone:** ${timezone}\n` +
              `**Current Time:** ${now}\n\n` +
              `Use \`,time\` to view your time anytime!`
            )
          );
        
        await message.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { repliedUser: false }
        });
        return true;
        
      } catch (err) {
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            (text) => text.setContent("**❌ Invalid Timezone**"),
            (text) => text.setContent(
              `**${timezone}** is not a valid timezone.\n\n` +
              `Select from the list below, or see the full list at:\nhttps://en.wikipedia.org/wiki/List_of_tz_database_time_zones`
            )
          )
          .addActionRowComponents((row) =>
            row.addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("time_select")
                .setPlaceholder("Select your timezone")
                .addOptions(timezones)
            )
          );
        
        await message.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { repliedUser: false }
        });
        return true;
      }
      
    } catch (error) {
      console.error("Settz command error:", error);
      await message.reply("An error occurred while setting your timezone.");
      return true;
    }
  }

  // TIMEUNLINK
  if (command === 'timeunlink') {
    try {
      const profile = await getUserProfile(message.author.id);
      
      if (!profile || !profile.timezone) {
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            (text) => text.setContent("**❌ No Timezone Set**"),
            (text) => text.setContent("You don't have a timezone saved. Use `,time` to set one!")
          );
        
        await message.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { repliedUser: false }
        });
        return true;
      }
      
      profile.timezone = null;
      await setUserProfile(message.author.id, profile);
      
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          (text) => text.setContent("**✅ Timezone Removed**"),
          (text) => text.setContent("Your timezone has been removed successfully.")
        );
      
      await message.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false }
      });
      return true;
      
    } catch (error) {
      console.error("Timeunlink command error:", error);
      await message.reply("An error occurred while removing your timezone.");
      return true;
    }
  }

  return false;
}

// Export for interactions handler
export { timezones };
