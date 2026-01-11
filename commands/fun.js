import { ContainerBuilder, MessageFlags, MediaGalleryBuilder, MediaGalleryItemBuilder } from 'discord.js';
import fetch from 'node-fetch';

const roasts = [
  "You're not stupid — you just have bad luck thinking.",
  "If common sense was a currency, you'd be in debt.",
  "You're like a cloud. Once you disappear, it's a beautiful day.",
  "You have the confidence of someone who shouldn't.",
  "You're proof that evolution can go in reverse."
];

const lores = [
  "was forged in the depths of a forgotten group chat, born from pure chaos and questionable decisions.",
  "once challenged a Discord mod to a duel and won using only reaction emojis.",
  "is rumored to be the final boss of every dead server.",
  "escaped from a parallel universe where everyone speaks in slash commands.",
  "was banned from 17 servers for excessive rizz deployment."
];

export async function handleFunCommands(ctx) {
  const { message, command } = ctx;

  // ROAST
  if (command === 'roast') {
    const target = message.mentions.users.first() || message.author;
    const roast = roasts[Math.floor(Math.random() * roasts.length)];

    const container = new ContainerBuilder()
      .setAccentColor(0x2b2d31)
      .addTextDisplayComponents(
        (text) => text.setContent('**🔥 Roast Generator**'),
        (text) => text.setContent(`<@${target.id}> ${roast}`)
      )
      .addSeparatorComponents((sep) => sep.setDivider(true));

    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
    return true;
  }

  // LORE
  if (command === 'lore') {
    const target = message.mentions.users.first() || message.author;
    const lore = lores[Math.floor(Math.random() * lores.length)];

    const container = new ContainerBuilder()
      .setAccentColor(0x2b2d31)
      .addTextDisplayComponents(
        (text) => text.setContent('**📜 Character Lore**'),
        (text) => text.setContent(`<@${target.id}> ${lore}`)
      )
      .addSeparatorComponents((sep) => sep.setDivider(true));

    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
    return true;
  }

  // CAT
  if (command === 'cat') {
    try {
      const res = await fetch("https://api.thecatapi.com/v1/images/search");
      const data = await res.json();
      const image = data[0]?.url;

      if (!image) return message.reply("Couldn't fetch a cat right now.");

      const gallery = new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image));
      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(text => text.setContent("## 🐱 Random Cat"))
        .addMediaGalleryComponents(gallery);

      await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
      return true;
    } catch (err) {
      await message.reply("Cat API failed.");
      return true;
    }
  }

  // DOG
  if (command === 'dog') {
    try {
      const res = await fetch("https://dog.ceo/api/breeds/image/random");
      const data = await res.json();
      const image = data.message;

      if (!image) return message.reply("Couldn't fetch a dog right now.");

      const gallery = new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image));
      const container = new ContainerBuilder()
        .setAccentColor(0x2b2d31)
        .addTextDisplayComponents(text => text.setContent("## 🐶 Random Dog"))
        .addMediaGalleryComponents(gallery);

      await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
      return true;
    } catch (err) {
      await message.reply("Dog API failed.");
      return true;
    }
  }

  return false;
}
