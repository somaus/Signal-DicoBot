import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import {
  Detection,
  FailureReason,
  SignalApiError,
  createDetection,
  waitForDetection,
} from '../signal-api';

const MAX_BYTES = 10 * 1024 * 1024; // 서버의 이미지 전용 한도
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export const data = new SlashCommandBuilder()
  .setName('탐지')
  .setDescription('사진이 딥페이크(AI 합성)일 가능성을 분석합니다')
  .addAttachmentOption((o) => o.setName('이미지').setDescription('분석할 사진 (10MB 이하)').setRequired(true));

const FAILURE_TEXT: Record<FailureReason, string> = {
  NO_FACE_DETECTED: '사진에서 얼굴을 찾지 못했어요. 얼굴이 잘 보이는 사진으로 다시 시도해 주세요.',
  VIDEO_NOT_SUPPORTED: '영상은 아직 지원하지 않아요. 이미지로 시도해 주세요.',
  AI_SERVER_ERROR: '분석 서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
  TIMEOUT: '분석 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.',
};

const BAND = {
  LOW: { label: '낮음', color: 0x2ecc71 },
  UNCERTAIN: { label: '판단 어려움', color: 0xf1c40f },
  HIGH: { label: '높음', color: 0xe74c3c },
  UNDETERMINED: { label: '판단 불가', color: 0x95a5a6 },
} as const;

const VERDICT = {
  REAL: { label: '낮음', color: 0x2ecc71 },
  SUSPICIOUS: { label: '의심됨', color: 0xf1c40f },
  FAKE: { label: '높음', color: 0xe74c3c },
} as const;

function buildEmbed(d: Detection, imageUrl: string): EmbedBuilder {
  const embed = new EmbedBuilder().setTitle('🔍 딥페이크 탐지 결과').setThumbnail(imageUrl);

  const level = d.band ? BAND[d.band] : d.verdict ? VERDICT[d.verdict] : BAND.UNDETERMINED;
  embed.setColor(level.color).addFields({ name: '합성 가능성', value: `**${level.label}**`, inline: true });

  if (d.riskScore !== null) {
    embed.addFields({ name: '위험 점수', value: `${d.riskScore}/100`, inline: true });
  }
  if (d.band === 'UNDETERMINED' && d.undeterminedReason) {
    embed.addFields({ name: '사유', value: d.undeterminedReason });
  }
  if (d.evidences.length > 0) {
    const text = d.evidences
      .slice(0, 5)
      .map((e) => `• ${e.description}`)
      .join('\n');
    embed.addFields({ name: '근거', value: text.slice(0, 1000) });
  }
  embed.setFooter({
    text: '참고용 결과예요. 실제 합성 여부를 보장하지 않습니다. 피해가 의심되면 /기관 에서 도움받을 곳을 확인하세요.',
  });
  return embed;
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const attachment = interaction.options.getAttachment('이미지', true);

  if (!attachment.contentType || !ALLOWED.includes(attachment.contentType)) {
    await interaction.reply({ content: 'JPG, PNG, WEBP 이미지만 분석할 수 있어요.', ephemeral: true });
    return;
  }
  if (attachment.size > MAX_BYTES) {
    await interaction.reply({ content: '이미지는 10MB 이하여야 해요.', ephemeral: true });
    return;
  }

  // 피해 관련 사진일 수 있어 결과는 본인에게만 보인다.
  await interaction.deferReply({ ephemeral: true });

  try {
    const imageRes = await fetch(attachment.url);
    if (!imageRes.ok) throw new Error(`이미지 다운로드 실패 (${imageRes.status})`);
    const blob = await imageRes.blob();

    const userId = interaction.user.id;
    const detectionId = await createDetection(userId, blob, attachment.name);
    await interaction.editReply('분석 중이에요… 잠시만 기다려 주세요 ⏳');

    const detection = await waitForDetection(userId, detectionId);
    if (detection.status === 'FAILED') {
      await interaction.editReply(
        (detection.failureReason && FAILURE_TEXT[detection.failureReason]) ?? '분석에 실패했어요. 다시 시도해 주세요.',
      );
      return;
    }
    await interaction.editReply({ content: '', embeds: [buildEmbed(detection, attachment.url)] });
  } catch (err) {
    console.error('[/탐지]', err);
    const message =
      err instanceof SignalApiError ? err.message : '분석 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
    await interaction.editReply(message);
  }
}
