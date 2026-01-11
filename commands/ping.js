import { ContainerBuilder, MessageFlags } from 'discord.js';

export async function handlePingCommand(ctx) {
  const { message, command, client } = ctx;
  
  if (command !== 'ping') return false;
  
  const sent = await message.reply({ 
    content: '🏓 Pinging...', 
    allowedMentions: { repliedUser: false } 
  });
  
  const latency = sent.createdTimestamp - message.createdTimestamp;
  const apiLatency = Math.round(client.ws.ping);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      (text) => text.setContent('**🏓 Pong!**'),
      (text) => text.setContent(`⚡ **Latency:** ${latency}ms\n📡 **API Latency:** ${apiLatency}ms`)
    )
    .addSeparatorComponents((sep) => sep.setDivider(true))
    .addTextDisplayComponents((text) => text.setContent(`-# ${client.user.username}`));

  await sent.edit({ 
    content: '', 
    components: [container], 
    flags: MessageFlags.IsComponentsV2 
  });
  
  return true;
}
