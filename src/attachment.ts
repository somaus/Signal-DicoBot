import { Attachment, ChatInputCommandInteraction } from 'discord.js';

const MAX_BYTES = 10 * 1024 * 1024; // 서버의 이미지 전용 한도
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/** 이미지 첨부를 검증하고 내려받는다. 문제가 있으면 사용자에게 답하고 null을 돌려준다. */
export async function validateImage(
  interaction: ChatInputCommandInteraction,
  attachment: Attachment,
): Promise<boolean> {
  if (!attachment.contentType || !ALLOWED.includes(attachment.contentType)) {
    await interaction.reply({ content: 'JPG, PNG, WEBP 이미지만 분석할 수 있어요.', ephemeral: true });
    return false;
  }
  if (attachment.size > MAX_BYTES) {
    await interaction.reply({ content: '이미지는 10MB 이하여야 해요.', ephemeral: true });
    return false;
  }
  return true;
}

export async function downloadImage(attachment: Attachment): Promise<Blob> {
  const res = await fetch(attachment.url);
  if (!res.ok) throw new Error(`이미지 다운로드 실패 (${res.status})`);
  return res.blob();
}
