const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.TOKEN;

const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Test if the bot is responsive'),

  new SlashCommandBuilder()
    .setName('createevent')
    .setDescription('Create a new event')
    .addStringOption(opt => opt.setName('name').setDescription('Event name').setRequired(true))
    .addStringOption(opt => opt.setName('date').setDescription('Date (DD-MM-YYYY)').setRequired(true))
    .addStringOption(opt => opt.setName('timezone').setDescription('Timezone (e.g., UTC, CEST)').setRequired(true)),

  new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Apply to an event')
    .addStringOption(opt => opt.setName('event').setDescription('Event name').setRequired(true))
    .addStringOption(opt => opt.setName('region')
      .setDescription('Select your region')
      .setRequired(true)
      .addChoices(
        { name: 'EU', value: 'eu' },
        { name: 'US', value: 'us' },
        { name: 'Australia', value: 'aus' }
      )),

  new SlashCommandBuilder()
    .setName('unapply')
    .setDescription('Cancel your application')
    .addStringOption(opt => opt.setName('event').setDescription('Event name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('listapplicants')
    .setDescription('List applicants for an event')
    .addStringOption(opt => opt.setName('event').setDescription('Event name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('assigngroups')
    .setDescription('Assign applicants into groups')
    .addStringOption(opt => opt.setName('event').setDescription('Event name').setRequired(true))
    .addIntegerOption(opt => opt.setName('size').setDescription('Group size').setRequired(true)),

  new SlashCommandBuilder()
    .setName('threadgroups')
    .setDescription('Create private threads for each group')
    .addStringOption(opt => opt.setName('event').setDescription('Event name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('pinggroup')
    .setDescription('Ping a group from an event')
    .addStringOption(opt => opt.setName('event').setDescription('Event name').setRequired(true))
    .addIntegerOption(opt => opt.setName('group').setDescription('Group number (1, 2, ...)').setRequired(true)),

  new SlashCommandBuilder()
    .setName('suggesttime')
    .setDescription('Suggest a time and day in a thread (admin only)')
    .addStringOption(opt => opt.setName('suggestion').setDescription('e.g. Friday 20:00 CEST').setRequired(true)),

  new SlashCommandBuilder()
    .setName('jointhread')
    .setDescription('Join a group thread (admin only)')
    .addStringOption(opt => opt.setName('event').setDescription('Event name').setRequired(true))
    .addIntegerOption(opt => opt.setName('group').setDescription('Group number').setRequired(true)),

  new SlashCommandBuilder()
    .setName('deleteevent')
    .setDescription('Delete an event')
    .addStringOption(opt => opt.setName('event').setDescription('Event name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('removeplayer')
    .setDescription('Remove a player from an event (admin only)')
    .addStringOption(opt => opt.setName('event').setDescription('Event name').setRequired(true))
    .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true)),

  new SlashCommandBuilder()
    .setName('ungroup')
    .setDescription('Remove all groups from an event (admin only)')
    .addStringOption(opt => opt.setName('event').setDescription('Event name').setRequired(true)),

].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('🔁 Deploying slash commands...');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('✅ Commands deployed successfully!');
  } catch (error) {
    console.error('❌ Failed to deploy commands:', error);
  }
})();