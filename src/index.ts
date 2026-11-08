import { Client, Events, GatewayIntentBits } from 'discord.js';
import { buildAgencyEmbed } from './agency-embed';
import { commands } from './commands';
import { SituationType, getAgencies } from './signal-api';
import { config } from './config';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => console.log(`로그인: ${c.user.tag}`));

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId.startsWith('agency:')) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const situation = interaction.customId.slice('agency:'.length) as SituationType;
      const agencies = await getAgencies(interaction.user.id, situation);
      await interaction.editReply({ embeds: [buildAgencyEmbed('📞 도움받을 수 있는 곳', agencies)] });
    } catch (err) {
      console.error('[agency button]', err);
      await interaction.editReply('기관 정보를 불러오지 못했어요. `/기관` 명령어로 다시 시도해 주세요.');
    }
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  const command = commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[${interaction.commandName}]`, err);
    const msg = '명령어 처리 중 오류가 발생했어요.';
    if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(() => {});
    else await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
  }
});

client.login(config.token);
