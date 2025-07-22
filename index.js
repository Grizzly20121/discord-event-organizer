require('dotenv').config();
const { Client, GatewayIntentBits, Events, Collection, ChannelType, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const { DateTime } = require('luxon');
const token = process.env.TOKEN;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const DATA_PATH = './data.json';
function loadData() {
  if (!fs.existsSync(DATA_PATH)) return { events: [], applications: {} };
  return JSON.parse(fs.readFileSync(DATA_PATH));
}
function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

client.once(Events.ClientReady, () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, member } = interaction;
  const data = loadData();

  const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

  try {
    if (commandName === 'ping') {
      return interaction.reply({ content: '🏓 Pong!', ephemeral: true });
    }

    if (commandName === 'createevent') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Only admins can create events.', ephemeral: true });

      const name = options.getString('name');
      const dateInput = options.getString('date');
      const timezone = options.getString('timezone');

      if (data.events.find(e => e.name === name)) {
        return interaction.reply({ content: '⚠️ Event already exists.', ephemeral: true });
      }

      const parsedDate = DateTime.fromFormat(dateInput, 'dd-MM-yyyy', { zone: timezone });
      if (!parsedDate.isValid) {
        return interaction.reply({ content: '❌ Invalid date format. Use **DD-MM-YYYY**.', ephemeral: true });
      }

      data.events.push({ name, date: dateInput, timezone, groups: [], regionMap: {} });
      saveData(data);

      return interaction.reply(`✅ Event **${name}** created for **${dateInput}** in **${timezone}**.`);
    }

    else if (commandName === 'apply') {
      const eventName = options.getString('event');
      const region = options.getString('region');
      const userId = interaction.user.id;

      const event = data.events.find(e => e.name === eventName);
      if (!event) return interaction.reply({ content: '❌ Event not found.', ephemeral: true });

      if (!data.applications[eventName]) data.applications[eventName] = [];
      if (data.applications[eventName].includes(userId)) {
        return interaction.reply({ content: '⚠️ You already applied for this event.', ephemeral: true });
      }

      data.applications[eventName].push(userId);
      event.regionMap[userId] = region;
      saveData(data);

      return interaction.reply({ content: `✅ You are now signed up for **${eventName}** as **${region.toUpperCase()}**.`, ephemeral: true });
    }

    else if (commandName === 'unapply') {
      const eventName = options.getString('event');
      const userId = interaction.user.id;

      if (!data.applications[eventName] || !data.applications[eventName].includes(userId)) {
        return interaction.reply({ content: '❌ You are not signed up for this event.', ephemeral: true });
      }

      data.applications[eventName] = data.applications[eventName].filter(id => id !== userId);
      delete data.events.find(e => e.name === eventName).regionMap[userId];
      saveData(data);

      return interaction.reply({ content: `🗑️ You have been removed from **${eventName}**.`, ephemeral: true });
    }

    else if (commandName === 'listapplicants') {
      const eventName = options.getString('event');
      const applicants = data.applications[eventName];

      if (!applicants || applicants.length === 0) {
        return interaction.reply('📭 No one has applied yet.');
      }

      const names = await Promise.all(applicants.map(id =>
        interaction.client.users.fetch(id).then(user => `${user.tag} (${data.events.find(e => e.name === eventName).regionMap[id].toUpperCase()})`).catch(() => 'Unknown')
      ));

      return interaction.reply(`📋 Applicants for **${eventName}**:\n${names.join('\n')}`);
    }

    else if (commandName === 'assigngroups') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Only admins can assign groups.', ephemeral: true });

      const eventName = options.getString('event');
      const groupSize = options.getInteger('size');
      const event = data.events.find(e => e.name === eventName);

      if (!event || !data.applications[eventName]) {
        return interaction.reply('❌ No applicants to group.');
      }

      const regions = { eu: [], us: [], aus: [] };

      for (const userId of data.applications[eventName]) {
        const region = event.regionMap[userId];
        if (region === 'aus') {
          regions[regions.aus.length >= 5 ? 'aus' : 'eu'].push(userId);
        } else {
          regions[region].push(userId);
        }
      }

      const finalGroups = [];
      for (const region of ['eu', 'us', 'aus']) {
        const shuffled = regions[region].sort(() => 0.5 - Math.random());
        for (let i = 0; i < shuffled.length; i += groupSize) {
          finalGroups.push(shuffled.slice(i, i + groupSize));
        }
      }

      event.groups = finalGroups;
      saveData(data);

      let message = `🧩 Groups for ${eventName}:\n`;
      for (let i = 0; i < finalGroups.length; i++) {
        const names = await Promise.all(finalGroups[i].map(id =>
          interaction.client.users.fetch(id).then(user => user.username).catch(() => 'Unknown')
        ));
        message += `Group ${i + 1}: ${names.join(', ')}\n`;
      }

      return interaction.reply(message);
    }

    else if (commandName === 'threadgroups') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Only admins can create threads.', ephemeral: true });

      const eventName = options.getString('event');
      const event = data.events.find(e => e.name === eventName);

      if (!event || !event.groups || event.groups.length === 0) {
        return interaction.reply('❌ Create groups for this event first.');
      }

      const parentChannel = interaction.channel;

      for (let i = 0; i < event.groups.length; i++) {
        const group = event.groups[i];
        const thread = await parentChannel.threads.create({
          name: `${eventName}-group${i + 1}`,
          autoArchiveDuration: 1440,
          type: ChannelType.PrivateThread
        });

        for (const userId of group) {
          try {
            await thread.members.add(userId);
          } catch {
            console.warn(`Could not add ${userId} to thread`);
          }
        }
      }

      return interaction.reply(`✅ Threads created for each group in **${eventName}**.`);
    }

    else if (commandName === 'pinggroup') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Only admins can ping groups.', ephemeral: true });

      const eventName = options.getString('event');
      const groupIndex = options.getInteger('group') - 1;
      const event = data.events.find(e => e.name === eventName);

      if (!event || !event.groups || !event.groups[groupIndex]) {
        return interaction.reply('❌ Group not found.');
      }

      const mentions = event.groups[groupIndex].map(id => `<@${id}>`).join(' ');
      return interaction.reply(`📢 Pinging group ${groupIndex + 1}: ${mentions}`);
    }

    else if (commandName === 'jointhread') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Only admins can join threads.', ephemeral: true });

      const eventName = options.getString('event');
      const groupIndex = options.getInteger('group') - 1;
      const event = data.events.find(e => e.name === eventName);
      if (!event || !event.groups[groupIndex]) return interaction.reply('❌ Group not found.');

      const thread = interaction.channel.threads.cache.find(t => t.name === `${eventName}-group${groupIndex + 1}`);
      if (!thread) return interaction.reply('❌ Thread not found.');
      await thread.members.add(interaction.user.id);

      return interaction.reply({ content: '✅ You have joined the thread.', ephemeral: true });
    }

    else if (commandName === 'suggesttime') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Only admins can suggest times.', ephemeral: true });

      const suggestion = options.getString('suggestion');
      const message = await interaction.channel.send(`🕒 Suggested time: **${suggestion}**\nReact with ✅ to confirm.`);
      await message.react('✅');

      return interaction.reply({ content: '✅ Time suggestion sent to thread.', ephemeral: true });
    }

    else if (commandName === 'deleteevent') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Only admins can delete events.', ephemeral: true });

      const eventName = options.getString('event');
      data.events = data.events.filter(e => e.name !== eventName);
      delete data.applications[eventName];
      saveData(data);

      return interaction.reply(`🗑️ Event **${eventName}** deleted.`);
    }

    else if (commandName === 'removeplayer') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Only admins can remove players.', ephemeral: true });

      const eventName = options.getString('event');
      const userId = options.getUser('user').id;

      if (!data.applications[eventName] || !data.applications[eventName].includes(userId)) {
        return interaction.reply({ content: '❌ This user is not signed up for the event.', ephemeral: true });
      }

      data.applications[eventName] = data.applications[eventName].filter(id => id !== userId);
      delete data.events.find(e => e.name === eventName).regionMap[userId];
      saveData(data);

      return interaction.reply({ content: `🗑️ <@${userId}> has been removed from **${eventName}**.`, ephemeral: true });
    }

    else if (commandName === 'ungroup') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Only admins can ungroup.', ephemeral: true });

      const eventName = options.getString('event');
      const event = data.events.find(e => e.name === eventName);
      if (!event) return interaction.reply({ content: '❌ Event not found.', ephemeral: true });

      event.groups = [];
      saveData(data);

      return interaction.reply(`🗑️ Groups removed for **${eventName}**.`);
    }

  } catch (error) {
    console.error('❌ Error during command:', error);
    if (interaction.replied || interaction.deferred) {
      interaction.followUp({ content: '⚠️ An error occurred.', ephemeral: true });
    } else {
      interaction.reply({ content: '⚠️ An error occurred.', ephemeral: true });
    }
  }
});

client.login(token);