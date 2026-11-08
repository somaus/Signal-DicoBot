import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import {
  SignalApiError,
  createChatSession,
  deleteChatSession,
  getChatSummary,
  sendChatMessage,
} from '../signal-api';

export const data = new SlashCommandBuilder()
  .setName('상담')
  .setDescription('익명 상담 챗봇과 이야기합니다 (나에게만 보여요)')
  .addSubcommand((s) =>
    s
      .setName('말하기')
      .setDescription('상담 챗봇에게 메시지를 보냅니다')
      .addStringOption((o) => o.setName('내용').setDescription('하고 싶은 말').setRequired(true).setMaxLength(2000)),
  )
  .addSubcommand((s) => s.setName('요약').setDescription('지금까지 상담 내용을 요약해서 보여줍니다'))
  .addSubcommand((s) => s.setName('종료').setDescription('상담을 끝내고 대화 기록을 삭제합니다'));

// 디스코드 유저 → 상담 세션. 재시작하면 사라지고, 서버에는 saveConsent=false로 만든다.
const sessions = new Map<string, string>();

async function say(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const content = interaction.options.getString('내용', true);

  let sessionId = sessions.get(userId);
  if (!sessionId) {
    sessionId = await createChatSession(userId);
    sessions.set(userId, sessionId);
  }
  const res = await sendChatMessage(userId, sessionId, content);

  const embed = new EmbedBuilder()
    .setColor(res.crisisDetected ? 0xe74c3c : 0x9b59b6)
    .setDescription(res.reply.slice(0, 4000));

  if (res.crisisDetected) {
    embed.setTitle('💙 지금 많이 힘드시군요');
    if (res.recommendedAgencies.length > 0) {
      embed.addFields({ name: '바로 연락할 수 있는 곳', value: res.recommendedAgencies.map((a) => `• ${a}`).join('\n') });
    }
  }
  if (res.suggestedActions.length > 0) {
    embed.addFields({ name: '지금 할 수 있는 일', value: res.suggestedActions.map((a) => `• ${a}`).join('\n').slice(0, 1000) });
  }
  const { completedCount, totalCount } = res.progress;
  embed.setFooter({
    text: res.sessionEnded
      ? '상담이 마무리됐어요. /상담 요약 으로 정리를 볼 수 있어요.'
      : `안내 진행 ${completedCount}/${totalCount} 단계 · 끝나면 /상담 종료 로 기록을 지우세요`,
  });
  await interaction.editReply({ embeds: [embed] });
}

async function summary(interaction: ChatInputCommandInteraction): Promise<void> {
  const sessionId = sessions.get(interaction.user.id);
  if (!sessionId) {
    await interaction.editReply('진행 중인 상담이 없어요. `/상담 말하기`로 시작해 보세요.');
    return;
  }
  const s = await getChatSummary(interaction.user.id, sessionId);
  const embed = new EmbedBuilder()
    .setTitle('📝 상담 요약')
    .setColor(0x9b59b6)
    .addFields(
      { name: '상황', value: s.situation || '-' },
      { name: '위험도', value: `${s.riskLevel} — ${s.riskDescription}` },
      { name: '권장 단계', value: s.recommendedSteps.map((t, i) => `${i + 1}. ${t}`).join('\n') || '-' },
    )
    .setFooter({ text: `안내 진행 ${s.progressPercent}%` });
  await interaction.editReply({ embeds: [embed] });
}

async function end(interaction: ChatInputCommandInteraction): Promise<void> {
  const sessionId = sessions.get(interaction.user.id);
  if (!sessionId) {
    await interaction.editReply('진행 중인 상담이 없어요.');
    return;
  }
  await deleteChatSession(interaction.user.id, sessionId);
  sessions.delete(interaction.user.id);
  await interaction.editReply('상담 기록을 삭제했어요. 언제든 다시 이야기해 주세요 💙');
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  try {
    const sub = interaction.options.getSubcommand();
    if (sub === '말하기') await say(interaction);
    else if (sub === '요약') await summary(interaction);
    else await end(interaction);
  } catch (err) {
    console.error('[/상담]', err);
    // 서버에서 세션이 사라졌을 수 있어 404면 로컬 매핑을 비운다
    if (err instanceof SignalApiError && err.status === 404) sessions.delete(interaction.user.id);
    await interaction.editReply(
      err instanceof SignalApiError ? err.message : '상담 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
    );
  }
}
