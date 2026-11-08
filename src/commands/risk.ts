import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { downloadImage, validateImage } from '../attachment';
import {
  AssessmentFailureReason,
  RiskAssessment,
  RiskLevel,
  SignalApiError,
  createRiskAssessment,
  waitForRiskAssessment,
} from '../signal-api';

export const data = new SlashCommandBuilder()
  .setName('위험도')
  .setDescription('SNS에 올리기 전에 사진의 도용·합성 위험을 진단합니다')
  .addAttachmentOption((o) => o.setName('이미지').setDescription('진단할 사진 (10MB 이하)').setRequired(true));

const LEVEL: Record<RiskLevel, { label: string; color: number }> = {
  LOW: { label: '낮음 🟢', color: 0x2ecc71 },
  MEDIUM: { label: '보통 🟡', color: 0xf1c40f },
  HIGH: { label: '높음 🔴', color: 0xe74c3c },
};

const FAILURE_TEXT: Record<AssessmentFailureReason, string> = {
  NO_FACE_DETECTED: '사진에서 얼굴을 찾지 못했어요. 얼굴이 잘 보이는 사진으로 다시 시도해 주세요.',
  AI_SERVER_ERROR: '진단 서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
  TIMEOUT: '진단 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.',
};

function bar(score: number): string {
  const filled = Math.round(score / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function buildEmbed(r: RiskAssessment, imageUrl: string): EmbedBuilder {
  const level = LEVEL[r.overallRiskLevel];
  const embed = new EmbedBuilder()
    .setTitle('🛡️ 사진 위험도 진단')
    .setColor(level.color)
    .setThumbnail(imageUrl)
    .setDescription(`종합 위험도: **${level.label}** (${r.overallScore}/100)`);

  if (!r.faceDetected) embed.addFields({ name: '얼굴', value: '사진에서 얼굴이 검출되지 않았어요.' });

  for (const f of r.factors.slice(0, 6)) {
    embed.addFields({
      name: `${f.label} · ${f.score}`,
      value: `\`${bar(f.score)}\`\n${f.description}`.slice(0, 1000),
    });
  }
  if (r.recommendations.length > 0) {
    embed.addFields({
      name: '💡 이렇게 하면 안전해요',
      value: r.recommendations.map((t) => `• ${t}`).join('\n').slice(0, 1000),
    });
  }
  return embed.setFooter({ text: 'AI 추정 결과라 참고용이에요.' });
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const attachment = interaction.options.getAttachment('이미지', true);
  if (!(await validateImage(interaction, attachment))) return;

  await interaction.deferReply({ ephemeral: true });
  try {
    const blob = await downloadImage(attachment);
    const userId = interaction.user.id;
    const accepted = await createRiskAssessment(userId, blob, attachment.name);
    if (accepted.status === 'PROCESSING') await interaction.editReply('진단 중이에요… 잠시만 기다려 주세요 ⏳');

    const result = await waitForRiskAssessment(userId, accepted);
    if (result.status === 'FAILED') {
      await interaction.editReply(
        (result.failureReason && FAILURE_TEXT[result.failureReason]) ?? '진단에 실패했어요. 다시 시도해 주세요.',
      );
      return;
    }
    await interaction.editReply({ embeds: [buildEmbed(result, attachment.url)] });
  } catch (err) {
    console.error('[/위험도]', err);
    await interaction.editReply(
      err instanceof SignalApiError ? err.message : '진단 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
    );
  }
}
