import { REST, Routes } from 'discord.js';
import { commands } from './commands';
import { config } from './config';

async function main() {
  const rest = new REST().setToken(config.token);
  const body = [...commands.values()].map((c) => c.data.toJSON());
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);
  await rest.put(route, { body });
  console.log(`${body.length}개 명령어 등록 완료 (${config.guildId ? '길드' : '글로벌'})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
