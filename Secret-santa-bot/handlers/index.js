const buttons = require('./buttons');
const selects = require('./selects');
const modals = require('./modals');

async function sendMainMenu(channel) {
  const { makeMainButtons } = require('../utils');
  const rows = makeMainButtons();
  await channel.send({ content: 'Управление Тайным Сантой', components: rows });
}

async function handleButton(interaction, client) {
  await buttons.handle(interaction, client);
}

async function handleSelect(interaction, client) {
  await selects.handle(interaction, client);
}

async function handleModal(interaction, client) {
  await modals.handle(interaction, client);
}

module.exports = { sendMainMenu, handleButton, handleSelect, handleModal };
