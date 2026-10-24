const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

async function findAnnounceChannel(client, guildId) {
  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) return null;

    if (guild.systemChannel && guild.systemChannel.viewable) {
      return guild.systemChannel;
    }

    const channel = guild.channels.cache.find(
      ch =>
        ch.type === ChannelType.GuildText &&
        ch.viewable &&
        ch.permissionsFor(guild.members.me)?.has(['ViewChannel', 'SendMessages'])
    );

    return channel || null;
  } catch (err) {
    console.error('findAnnounceChannel error:', err);
    return null;
  }
}

async function ensureSantaRole(guild, organizerId) {
  const roleName = 'Santa ADM';
  await guild.roles.fetch();
  let role = guild.roles.cache.find(r => r.name === roleName);
  if (!role) {
    try {
      role = await guild.roles.create({ name: roleName, reason: 'Роль организатора Тайного Санты' });
    } catch (err) {
      throw new Error('Не удалось создать роль Santa ADM. У бота нет прав ManageRoles или роль бота ниже по иерархии.');
    }
  }
  const member = await guild.members.fetch(organizerId);
  if (!member.roles.cache.has(role.id)) {
    await member.roles.add(role, 'Выдано организатору события Тайный Санта');
  }
  return role;
}

function makeMainButtons() {
  // Первый ряд: добавляем Выйти в первый ряд
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('create_event').setLabel('Создать событие').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('join_event').setLabel('Присоединиться').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('my_wishlist').setLabel('Мой вишлист').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('show_recipient').setLabel('Показать моего подопечного').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('exit_event').setLabel('Выйти').setStyle(ButtonStyle.Danger)
  );

  // Второй ряд: организатор и анонимные сообщения после жеребьёвки
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('organizer_menu').setLabel('Меню Организатора').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('message_recipient').setLabel('Написать подопечному').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('message_santa').setLabel('Написать Санте').setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

module.exports = { findAnnounceChannel, ensureSantaRole, makeMainButtons };
