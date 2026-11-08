import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { buildAgencyEmbed } from '../agency-embed';
import { SignalApiError, SituationType, getAgencies } from '../signal-api';

export const data = new SlashCommandBuilder()
  .setName('기관')
  .setDescription('피해 상황별로 도움받을 수 있는 기관을 안내합니다')
  .addStringOption((o) =>
    o
      .setName('상황')
      .setDescription('어떤 도움이 필요하세요? (비우면 전체)')
      .addChoices(
        { name: '딥페이크 이미지·영상 피해', value: 'DEEPFAKE_IMAGE' },
        { name: '사진 유포·불법 촬영 피해', value: 'IMAGE_ABUSE' },
        { name: '지금 많이 힘들어요 (위기 상담)', value: 'CRISIS' },
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const situation = (interaction.options.getString('상황') as SituationType | null) ?? undefined;
  await interaction.deferReply({ ephemeral: true });
  try {
    const agencies = await getAgencies(interaction.user.id, situation);
    await interaction.editReply({ embeds: [buildAgencyEmbed('📞 도움받을 수 있는 곳', agencies)] });
  } catch (err) {
    console.error('[/기관]', err);
    await interaction.editReply(
      err instanceof SignalApiError ? err.message : '기관 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
  }
}
