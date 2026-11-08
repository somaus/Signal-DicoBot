import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name} 가 필요합니다.`);
  return value;
}

export const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('DISCORD_CLIENT_ID'),
  guildId: process.env.DISCORD_GUILD_ID || undefined,
  signalApiUrl: (process.env.SIGNAL_API_URL ?? 'http://localhost:8080').replace(/\/$/, ''),
};
