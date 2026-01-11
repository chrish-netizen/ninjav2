import { ContainerBuilder, MessageFlags, MediaGalleryBuilder, MediaGalleryItemBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';

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

 

  // AV (Strawberry spam)
  if (command === 'av') {
    await message.reply('🍓🍓🍓🍓🍓🍓');
    return true;
  }

  // SHIP
  if (command === 'ship') {
    const users = message.mentions.users;

    if (users.size < 2) {
      await message.reply("Mention **two** users to ship.");
      return true;
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
      .setAccentColor(0x2b2d31)
      .addTextDisplayComponents(
        (text) => text.setContent(`## 💞 Shipping ${user1.username} × ${user2.username}`),
        (text) => text.setContent(`**Compatibility:** ${percentage}%\n${status}`)
      )
      .addSeparatorComponents((sep) => sep.setDivider(true))
      .addTextDisplayComponents(
        (text) => text.setContent("-# Ship System")
      );

    await message.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { repliedUser: false }
    });
    return true;
  }

  // PROPHECY
  if (command === 'prophecy') {
    const target = message.mentions.users.first() || message.author;

    const visions = [
      "a fracture forming in your timeline",
      "an echo of yourself watching from the corner of reality",
      "a forgotten memory trying to rewrite itself",
      "a shadow that doesn't belong to you",
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
      "you notice a symbol you've never seen before",
      "a stranger recognizes you without meeting you",
      "time feels slightly out of sync",
      "you hear footsteps behind you with no source",
      "your name appears where it shouldn't"
    ];

    const outcomes = [
      "a shift in your path",
      "an unexpected encounter",
      "a revelation you weren't meant to see",
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

    await message.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { repliedUser: false }
    });
    return true;
  }

  // AURA
  if (command === 'aura') {
    const target = message.mentions.users.first() || message.author;
    const aura = Math.floor(Math.random() * 10001);

    let rank;
    if (aura > 9000) rank = "🌟 LEGENDARY";
    else if (aura > 7000) rank = "✨ MYTHICAL";
    else if (aura > 5000) rank = "💎 EPIC";
    else if (aura > 3000) rank = "🔥 RARE";
    else if (aura > 1000) rank = "⚡ UNCOMMON";
    else rank = "🗿 COMMON";

    const container = new ContainerBuilder()
      .setAccentColor(0x2b2d31)
      .addTextDisplayComponents(
        (text) => text.setContent(`## ✨ ${target.username}'s Aura`),
        (text) => text.setContent(`**Aura Points:** ${aura}\n**Rank:** ${rank}`)
      )
      .addSeparatorComponents((sep) => sep.setDivider(true))
      .addTextDisplayComponents(
        (text) => text.setContent("-# Aura System")
      );

    await message.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { repliedUser: false }
    });
    return true;
  }



  // POKEMON
  if (command === 'pokemon') {
    try {
      const id = Math.floor(Math.random() * 1025) + 1;
      const response = await fetch("https://pokeapi.co/api/v2/pokemon/" + id);
      if (!response.ok) throw new Error("API error");

      const data = await response.json();
      const name = data.name.charAt(0).toUpperCase() + data.name.slice(1);

      const isShiny = Math.random() < 0.20;

      const speciesRes = await fetch(data.species.url);
      const species = await speciesRes.json();

      const evoRes = await fetch(species.evolution_chain.url);
      const evoData = await evoRes.json();

      const evoLine = [];
      let evoNode = evoData.chain;

      while (evoNode) {
        evoLine.push(evoNode.species.name);
        evoNode = evoNode.evolves_to[0];
      }

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

      return true;
    } catch (err) {
      console.error(err);
      await message.reply("Failed to load a Pokémon.");
      return true;
    }
  }

  // FACT
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
        .addTextDisplayComponents((text) => text.setContent('-# Bot • Stable Build'));

      await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
      return true;
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
        .addSeparatorComponents((sep) => sep.setDivider(true));

      await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
      return true;
    }
  }

  

  return false;
}
