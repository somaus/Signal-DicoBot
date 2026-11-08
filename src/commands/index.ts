import { ChatInputCommandInteraction, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
import * as agency from './agency';
import * as chat from './chat';
import * as detect from './detect';
import * as risk from './risk';

export interface Command {
  data: SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands = new Map<string, Command>(
  [detect, risk, agency, chat].map((c) => [c.data.name, c] as [string, Command]),
);
