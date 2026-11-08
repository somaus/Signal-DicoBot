import { EmbedBuilder } from 'discord.js';
import { Agency } from './signal-api';

export function buildAgencyEmbed(title: string, agencies: Agency[]): EmbedBuilder {
  const embed = new EmbedBuilder().setTitle(title).setColor(0x3498db);
  if (agencies.length === 0) return embed.setDescription('등록된 기관이 없어요.');

  for (const a of agencies.slice(0, 10)) {
    const lines = [
      a.phone && `📞 ${a.phone}`,
      a.availableHours && `🕐 ${a.availableHours}`,
      a.website && `🔗 ${a.website}`,
      a.supportedActions.length > 0 && `지원: ${a.supportedActions.join(', ')}`,
    ].filter(Boolean);
    embed.addFields({ name: a.name, value: lines.join('\n') || '-' });
  }
  return embed;
}
