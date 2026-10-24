const { ensureSantaRole } = require('../utils');

module.exports = {
  async handle(interaction, client) {
    const db = client.db;
    const customId = interaction.customId;
    const guild = interaction.guild;
    const user = interaction.user;

    if (customId === 'modal_create_event') {
      const name = interaction.fields.getTextInputValue('event_name');
      const budget = interaction.fields.getTextInputValue('event_budget');
      const date = interaction.fields.getTextInputValue('event_date');
      const eventId = db.createEvent(guild.id, name, budget, date, user.id);
      try {
        await ensureSantaRole(guild, user.id);
      } catch (err) {
        console.error(err);
        await interaction.reply({
          content: 'Событие создано, но не удалось выдать роль Santa ADM. Проверьте права бота.',
          ephemeral: true
        });
        return;
      }
      await interaction.reply({ content: `Событие "${name}" создано. ID: ${eventId}`, ephemeral: true });
    }

    else if (customId.startsWith('modal_wishlist_')) {
      const eventId = Number(customId.split('_')[2]);
      const wishlist = interaction.fields.getTextInputValue('wishlist_text');

      const isParticipant = db.getParticipants(eventId).some(p => p.userId === user.id);
      if (!isParticipant) {
        await interaction.reply({
          content: 'Вы не участвуете в этом событии. Сначала нажмите «Присоединиться».',
          ephemeral: true
        });
        return;
      }

      db.setWishlist(eventId, user.id, wishlist);
      await interaction.reply({ content: 'Вишлист сохранён.', ephemeral: true });

      // Уведомляем Санту. Ошибки только в консоль: сообщение в общий канал
      // раскрыло бы, кто чей Санта.
      try {
        const pairs = db.getPairsByRecipient(eventId, user.id);
        for (const pair of pairs) {
          try {
            const santaUser = await client.users.fetch(pair.santaId);
            const dm = await santaUser.createDM();
            await dm.send({
              content: `Внимание: вишлист вашего подопечного <@${user.id}> был обновлён для события ID ${eventId}.\n\nНовый вишлист:\n${wishlist}`
            });
          } catch (err) {
            console.error('Ошибка отправки DM санте при обновлении вишлиста:', err);
          }
        }
      } catch (err) {
        console.error('Ошибка при уведомлении сант о вишлисте:', err);
      }
    }

    else if (customId.startsWith('modal_budget_')) {
      const eventId = Number(customId.split('_')[2]);
      const budget = interaction.fields.getTextInputValue('budget_text');
      const event = db.getEventById(eventId);
      if (!event) {
        await interaction.reply({ content: 'Событие не найдено.', ephemeral: true });
        return;
      }
      if (event.organizerId !== user.id) {
        await interaction.reply({ content: 'Только организатор может менять бюджет.', ephemeral: true });
        return;
      }
      db.setBudget(eventId, budget);
      await interaction.reply({ content: 'Бюджет обновлён.', ephemeral: true });
    }

    else if (customId.startsWith('modal_santa_to_recipient_')) {
      const eventId = Number(customId.split('_').pop());
      const text = interaction.fields.getTextInputValue('anon_text');
      const event = db.getEventById(eventId);
      const pair = db.getPairBySanta(eventId, user.id);

      if (!event || !pair) {
        await interaction.reply({
          content: 'Не удалось найти пару. Возможно, жеребьёвка ещё не была проведена.',
          ephemeral: true
        });
        return;
      }

      try {
        const recipientUser = await client.users.fetch(pair.recipientId);
        const dm = await recipientUser.createDM();
        await dm.send({
          content:
            `🎄 Анонимное сообщение от вашего Тайного Санты\n` +
            `Событие: **${event.name}**\n\n${text}`
        });
        await interaction.reply({ content: 'Сообщение отправлено подопечному анонимно.', ephemeral: true });
      } catch (err) {
        console.error('Ошибка отправки DM подопечному:', err);
        await interaction.reply({
          content: 'Не удалось отправить сообщение. Попросите подопечного открыть личные сообщения боту.',
          ephemeral: true
        });
      }
    }

    else if (customId.startsWith('modal_recipient_to_santa_')) {
      const eventId = Number(customId.split('_').pop());
      const text = interaction.fields.getTextInputValue('anon_text');
      const event = db.getEventById(eventId);
      const pair = db.getPairByRecipient(eventId, user.id);

      if (!event || !pair) {
        await interaction.reply({
          content: 'Не удалось найти вашего Санту. Возможно, жеребьёвка ещё не была проведена.',
          ephemeral: true
        });
        return;
      }

      try {
        const santaUser = await client.users.fetch(pair.santaId);
        const dm = await santaUser.createDM();
        await dm.send({
          content:
            `🎄 Анонимное сообщение от вашего подопечного\n` +
            `Событие: **${event.name}**\n\n${text}`
        });
        await interaction.reply({ content: 'Сообщение отправлено Санте анонимно.', ephemeral: true });
      } catch (err) {
        console.error('Ошибка отправки DM Санте:', err);
        await interaction.reply({
          content: 'Не удалось отправить сообщение. Попросите Санту открыть личные сообщения боту.',
          ephemeral: true
        });
      }
    }

    else {
      await interaction.reply({ content: 'Неизвестная модалка', ephemeral: true });
    }
  }
};
