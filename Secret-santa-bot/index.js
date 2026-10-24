require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const handlers = require('./handlers');
const db = require('./db');
db.init(); // таблицы должны существовать до первого запроса
const PREFIX = process.env.PREFIX || '!';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.db = db;

client.once('ready', () => {
  console.log(`Готово: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.content === `${PREFIX}menu`) {
    await handlers.sendMainMenu(message.channel);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) await handlers.handleButton(interaction, client);
    else if (interaction.isStringSelectMenu()) await handlers.handleSelect(interaction, client);
    else if (interaction.isModalSubmit()) await handlers.handleModal(interaction, client);
  } catch (err) {
    console.error('Ошибка interactionCreate:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Произошла ошибка. Попробуйте снова.', ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
