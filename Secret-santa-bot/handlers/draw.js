const { findAnnounceChannel } = require('../utils');

// Алгоритм Саттоло: строит один случайный цикл,
// поэтому никто гарантированно не получает самого себя.
function generateDerangement(list) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i); // j < i
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

module.exports = {
  async startDraw(client, eventId) {
    const db = client.db;
    const event = db.getEventById(eventId);
    if (!event) return;

    const notifyOrganizer = async (text) => {
      try {
        const org = await client.users.fetch(event.organizerId);
        const dm = await org.createDM();
        await dm.send(text);
      } catch (err) {
        console.error('Ошибка уведомления организатора:', err);
      }
    };

    // Повторный запуск раздал бы людям разных подопечных
    if (db.getPairsByEvent(eventId).length) {
      await notifyOrganizer(
        `Жеребьёвка для события "${event.name}" уже проведена. ` +
        `Чтобы провести её заново, удалите событие и создайте новое.`
      );
      return;
    }

    const participants = db.getParticipants(eventId);
    if (!participants || participants.length < 2) {
      await notifyOrganizer('Недостаточно участников для жеребьёвки (нужно минимум 2).');
      return;
    }

    const ids = participants.map(p => p.userId);
    const recipients = generateDerangement(ids);

    // Пары сохраняем синхронно, до любых await: иначе быстрый повторный клик
    // успел бы запустить вторую жеребьёвку параллельно с первой.
    for (let i = 0; i < ids.length; i++) {
      db.savePair(eventId, ids[i], recipients[i]);
    }

    const announceChannel = await findAnnounceChannel(client, event.guildId);

    for (let i = 0; i < ids.length; i++) {
      const santaId = ids[i];
      const recipientId = recipients[i];

      try {
        const santaUser = await client.users.fetch(santaId);
        const recipientUser = await client.users.fetch(recipientId);
        const wishlist = db.getWishlist(eventId, recipientId) || 'Вишлист не задан';
        const avatar = recipientUser.displayAvatarURL({ extension: 'png', size: 512 });

        const dm = await santaUser.createDM();
        await dm.send({
          content:
            `Вы назначены Санта для **${recipientUser.tag}**\n` +
            `Аватар: ${avatar}\n` +
            `Вишлист:\n${wishlist}`
        });
      } catch (err) {
        console.error('Ошибка отправки DM санте:', err);

        if (announceChannel) {
          announceChannel.send(
            `Не удалось отправить личное сообщение пользователю <@${santaId}>. ` +
            `Вероятно, у него закрыты DM. Попросите открыть личные сообщения для получения информации о подопечном.`
          ).catch(e => console.error('announceChannel.send error:', e));
        }
      }
    }

    await notifyOrganizer(
      `Жеребьёвка для события "${event.name}" завершена. ` +
      `Всем сантам отправлены личные сообщения (если DM открыты).`
    );
  }
};
