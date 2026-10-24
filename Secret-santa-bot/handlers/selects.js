const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const drawHandler = require('./draw');

module.exports = {
  async handle(interaction, client) {
    const db = client.db;
    const customId = interaction.customId;
    const user = interaction.user;
    const guild = interaction.guild;
    if (customId === 'select_join_event') {
      const eventId = Number(interaction.values[0]);

      if (!db.getEventById(eventId)) {
        await interaction.update({ content: 'Событие не найдено.', components: [] });
        return;
      }
      if (db.getPairsByEvent(eventId).length) {
        await interaction.update({ content: 'Жеребьёвка уже проведена, присоединиться нельзя.', components: [] });
        return;
      }
      db.addParticipant(eventId, user.id);

      const modal = new ModalBuilder()
        .setCustomId(`modal_wishlist_${eventId}`)
        .setTitle('Мой вишлист');

      const wishlist = new TextInputBuilder()
        .setCustomId('wishlist_text')
        .setLabel('Опишите ваш вишлист (обязательно)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(new ActionRowBuilder().addComponents(wishlist));
      await interaction.showModal(modal);
      return;
    }
    if (customId === 'select_wishlist_event') {
      const eventId = Number(interaction.values[0]);

      const modal = new ModalBuilder()
        .setCustomId(`modal_wishlist_${eventId}`)
        .setTitle('Мой вишлист');

      const wishlist = new TextInputBuilder()
        .setCustomId('wishlist_text')
        .setLabel('Опишите ваш вишлист')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(new ActionRowBuilder().addComponents(wishlist));
      await interaction.showModal(modal);
      return;
    }
    if (customId === 'select_exit_event') {
      const eventId = Number(interaction.values[0]);

      if (db.getPairsByEvent(eventId).length) {
        await interaction.update({
          content: 'Жеребьёвка уже проведена, выйти нельзя. Обратитесь к организатору.',
          components: []
        });
        return;
      }
      db.removeParticipant(eventId, user.id);

      await interaction.update({
        content: 'Вы вышли из события.',
        components: []
      });
      return;
    }
    if (customId === 'select_show_recipient_event') {
      const eventId = Number(interaction.values[0]);
      const pair = db.getPairBySanta(eventId, user.id);

      if (!pair) {
        await interaction.update({
          content: 'Жеребьёвка ещё не проводилась или вы не назначены как Санта.',
          components: []
        });
        return;
      }

      const recipientId = pair.recipientId;

      try {
        const recipientUser = await client.users.fetch(recipientId);
        const wishlist = db.getWishlist(eventId, recipientId) || 'Вишлист не задан';
        const avatar = recipientUser.displayAvatarURL({ extension: 'png', size: 512 });

        const dm = await user.createDM();
        await dm.send({
          content:
            `Вот информация о вашем подопечном:\n\n` +
            `**Ник:** ${recipientUser.tag}\n` +
            `**Аватар:** ${avatar}\n` +
            `**Вишлист:**\n${wishlist}`
        });

        await interaction.update({
          content: 'Информация отправлена в личные сообщения.',
          components: []
        });
      } catch (err) {
        console.error('Ошибка show_recipient:', err);
        await interaction.update({
          content: 'Не удалось получить информацию о подопечном. Возможно, он покинул сервер или у него закрыты DM.',
          components: []
        });
      }
      return;
    }
    if (customId === 'select_message_recipient_event') {
      const eventId = Number(interaction.values[0]);
      const pair = db.getPairBySanta(eventId, user.id);

      if (!pair) {
        await interaction.update({
          content: 'Жеребьёвка ещё не проводилась или вы не участвуете в этом событии как Санта.',
          components: []
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`modal_santa_to_recipient_${eventId}`)
        .setTitle('Сообщение подопечному');

      const text = new TextInputBuilder()
        .setCustomId('anon_text')
        .setLabel('Текст (имя не будет показано)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(new ActionRowBuilder().addComponents(text));
      await interaction.showModal(modal);
      return;
    }

    if (customId === 'select_message_santa_event') {
      const eventId = Number(interaction.values[0]);
      const pair = db.getPairByRecipient(eventId, user.id);

      if (!pair) {
        await interaction.update({
          content: 'Жеребьёвка ещё не проводилась или у вас нет Санты в этом событии.',
          components: []
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`modal_recipient_to_santa_${eventId}`)
        .setTitle('Сообщение Санте');

      const text = new TextInputBuilder()
        .setCustomId('anon_text')
        .setLabel('Текст (имя не будет показано)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(new ActionRowBuilder().addComponents(text));
      await interaction.showModal(modal);
      return;
    }

    if (customId === 'select_start_draw_event') {
      const eventId = Number(interaction.values[0]);
      const ev = db.getEventById(eventId);

      if (!ev || ev.organizerId !== user.id || ev.guildId !== guild.id) {
        await interaction.update({ content: 'Нет доступа к этому событию.', components: [] });
        return;
      }
      if (db.getPairsByEvent(eventId).length) {
        await interaction.update({
          content: 'Жеребьёвка уже проведена. Чтобы провести её заново, удалите событие и создайте новое.',
          components: []
        });
        return;
      }

      await interaction.update({
        content: 'Запускаю жеребьёвку...',
        components: []
      });

      await drawHandler.startDraw(client, eventId);
      return;
    }
    if (customId === 'select_budget_event') {
      const eventId = Number(interaction.values[0]);

      const modal = new ModalBuilder()
        .setCustomId(`modal_budget_${eventId}`)
        .setTitle('Изменить бюджет игры');

      const budgetInput = new TextInputBuilder()
        .setCustomId('budget_text')
        .setLabel('Новый бюджет')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(budgetInput));
      await interaction.showModal(modal);
      return;
    }
    if (customId === 'select_organizer_participants_event') {
      const eventId = Number(interaction.values[0]);
      const event = db.getEventById(eventId);

      if (!event) {
        await interaction.update({ content: 'Событие не найдено.', components: [] });
        return;
      }
      if (event.organizerId !== user.id) {
        await interaction.update({ content: 'Только создатель события может просматривать список участников.', components: [] });
        return;
      }

      const participants = db.getParticipants(eventId);
      let text = `Список участников для события "${event.name}" (ID ${eventId}):\n\n`;

      if (!participants.length) text += 'Участников нет.\n';
      else participants.forEach(p => text += `• <@${p.userId}> (ID: ${p.userId})\n`);

      try {
        const dm = await user.createDM();
        const chunkSize = 1900;

        for (let i = 0; i < text.length; i += chunkSize) {
          await dm.send(text.slice(i, i + chunkSize));
        }

        await interaction.update({
          content: 'Список участников отправлен вам в личные сообщения.',
          components: []
        });
      } catch (err) {
        await interaction.update({
          content: 'Не удалось отправить DM. Проверьте, открыты ли у вас личные сообщения.',
          components: []
        });
      }
      return;
    }
    if (customId === 'select_organizer_pairs_event') {
      const eventId = Number(interaction.values[0]);
      const event = db.getEventById(eventId);

      if (!event) {
        await interaction.update({ content: 'Событие не найдено.', components: [] });
        return;
      }
      if (event.organizerId !== user.id) {
        await interaction.update({ content: 'Только создатель события может просматривать список пар.', components: [] });
        return;
      }

      const pairs = db.getPairsByEvent(eventId);
      let text = `Пары для события "${event.name}" (ID ${eventId}):\n\n`;

      if (!pairs.length) text += 'Пары ещё не назначены.\n';
      else pairs.forEach(pr => text += `• <@${pr.santaId}> → <@${pr.recipientId}>\n`);

      try {
        const dm = await user.createDM();
        const chunkSize = 1900;

        for (let i = 0; i < text.length; i += chunkSize) {
          await dm.send(text.slice(i, i + chunkSize));
        }

        await interaction.update({
          content: 'Список пар отправлен вам в личные сообщения.',
          components: []
        });
      } catch (err) {
        await interaction.update({
          content: 'Не удалось отправить DM. Проверьте, открыты ли у вас личные сообщения.',
          components: []
        });
      }
      return;
    }
    if (customId === 'select_finish_event') {
      const eventId = Number(interaction.values[0]);
      const event = db.getEventById(eventId);

      if (!event) {
        await interaction.update({ content: 'Событие не найдено.', components: [] });
        return;
      }
      if (event.organizerId !== user.id) {
        await interaction.update({ content: 'Только создатель события может завершить его.', components: [] });
        return;
      }

      const confirmButton = new ButtonBuilder()
        .setCustomId(`confirm_finish_${eventId}`)
        .setLabel('Подтвердить удаление')
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel_finish_${eventId}`)
        .setLabel('Отменить')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

      await interaction.update({
        content:
          `Вы действительно хотите **удалить** событие "${event.name}" (ID ${eventId})?\n` +
          `Это действие удалит всех участников и пары и не обратимо.`,
        components: [row]
      });
      return;
    }
    await interaction.reply({
      content: 'Неизвестный селект.',
      ephemeral: true
    });
  }
};
