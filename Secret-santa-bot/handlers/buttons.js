const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { findAnnounceChannel } = require('../utils');

const MAX_OPTIONS = 25; // лимит Discord на количество опций в селекте

function eventOptions(events) {
  return events.slice(0, MAX_OPTIONS).map(e => ({
    label: String(e.name).slice(0, 100),
    value: String(e.id),
    description: `Бюджет: ${e.budget || '—'}`.slice(0, 100)
  }));
}

module.exports = {

  async handle(interaction, client) {
    const db = client.db;
    const guild = interaction.guild;
    const user = interaction.user;

    try {
      console.log(
        `[buttons] customId=${interaction.customId} user=${user.tag} userId=${user.id} guild=${guild ? guild.id : 'DM'}`
      );
    } catch (e) {}

    try {

      if (interaction.customId && interaction.customId.startsWith('confirm_finish_')) {
        const eventId = Number(interaction.customId.split('_')[2]);
        const event = db.getEventById(eventId);
        if (!event) {
          await interaction.update({ content: 'Событие не найдено.', components: [] });
          return;
        }
        if (event.organizerId !== user.id) {
          await interaction.update({
            content: 'Только создатель события может подтвердить его удаление.',
            components: []
          });
          return;
        }

        try {
          db.deleteEvent(eventId);

          // Если у организатора не осталось событий — снимаем роль Santa ADM
          try {
            const left = db.getEventsByGuild(guild.id).filter(e => e.organizerId === user.id);
            if (!left.length) {
              const role = guild.roles.cache.find(r => r.name === 'Santa ADM');
              const member = await guild.members.fetch(user.id);
              if (role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role, 'Событие Тайного Санты удалено');
              }
            }
          } catch (err) {
            console.error('Не удалось снять роль Santa ADM:', err);
          }

          try {
            const org = await client.users.fetch(user.id);
            const dm = await org.createDM();
            await dm.send(`Событие "${event.name}" (ID ${eventId}) было подтверждённо удалено.`);
          } catch (err) {
            console.error('notify org DM error:', err);
          }

          try {
            const announceChannel = await findAnnounceChannel(client, guild.id);
            if (announceChannel)
              await announceChannel.send(
                `Событие "${event.name}" было удалено организатором <@${user.id}>.`
              );
          } catch (err) {
            console.error('announce channel error:', err);
          }

          await interaction.update({
            content: `Событие "${event.name}" успешно удалено.`,
            components: []
          });
        } catch (err) {
          console.error('Ошибка при удалении события:', err);
          await interaction.update({
            content: 'Не удалось удалить событие. Обратитесь к администратору.',
            components: []
          });
        }
        return;
      }

      if (interaction.customId && interaction.customId.startsWith('cancel_finish_')) {
        const eventId = Number(interaction.customId.split('_')[2]);
        const event = db.getEventById(eventId);
        const name = event ? event.name : 'событие';
        await interaction.update({
          content: `Удаление ${name} отменено.`,
          components: []
        });
        return;
      }

      switch (interaction.customId) {

        case 'show_recipient': {
          const events = db.getEventsByGuild(guild.id);
          if (!events.length) {
            await interaction.reply({
              content: 'Нет активных событий на этом сервере.',
              ephemeral: true
            });
            return;
          }

          const select = new StringSelectMenuBuilder()
            .setCustomId('select_show_recipient_event')
            .setPlaceholder('Выберите событие')
            .addOptions(eventOptions(events));

          const row = new ActionRowBuilder().addComponents(select);
          await interaction.reply({
            content: 'Выберите событие, для которого хотите узнать подопечного',
            components: [row],
            ephemeral: true
          });
          break;
        }

        case 'create_event': {
          const modal = new ModalBuilder()
            .setCustomId('modal_create_event')
            .setTitle('Создать событие Тайный Санта');
          const titleInput = new TextInputBuilder()
            .setCustomId('event_name')
            .setLabel('Название события')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setRequired(true);
          const budgetInput = new TextInputBuilder()
            .setCustomId('event_budget')
            .setLabel('Бюджет (например 1000 руб)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(50)
            .setRequired(true);
          const dateInput = new TextInputBuilder()
            .setCustomId('event_date')
            .setLabel('Дата (например 25.12.2025)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(30)
            .setRequired(true);
          modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(budgetInput),
            new ActionRowBuilder().addComponents(dateInput)
          );
          await interaction.showModal(modal);
          break;
        }

        case 'join_event': {
          const events = db.getEventsByGuild(guild.id);
          if (!events.length) {
            await interaction.reply({
              content: 'Нет активных событий на этом сервере.',
              ephemeral: true
            });
            return;
          }
          const select = new StringSelectMenuBuilder()
            .setCustomId('select_join_event')
            .setPlaceholder('Выберите событие')
            .addOptions(eventOptions(events));
          const row = new ActionRowBuilder().addComponents(select);
          await interaction.reply({
            content: 'Выберите событие для присоединения',
            components: [row],
            ephemeral: true
          });
          break;
        }

        case 'my_wishlist': {
          const events = db.getEventsByGuild(guild.id);
          if (!events.length) {
            await interaction.reply({
              content: 'Нет активных событий на этом сервере.',
              ephemeral: true
            });
            return;
          }
          const select = new StringSelectMenuBuilder()
            .setCustomId('select_wishlist_event')
            .setPlaceholder('Выберите событие для вишлиста')
            .addOptions(eventOptions(events));
          const row = new ActionRowBuilder().addComponents(select);
          await interaction.reply({
            content: 'Выберите событие, для которого хотите задать вишлист',
            components: [row],
            ephemeral: true
          });
          break;
        }

        case 'exit_event': {
          const events = db.getEventsByGuild(guild.id);
          if (!events.length) {
            await interaction.reply({
              content: 'Нет активных событий на этом сервере.',
              ephemeral: true
            });
            return;
          }
          const select = new StringSelectMenuBuilder()
            .setCustomId('select_exit_event')
            .setPlaceholder('Выберите событие, чтобы выйти')
            .addOptions(eventOptions(events));
          const row = new ActionRowBuilder().addComponents(select);
          await interaction.reply({
            content: 'Выберите событие, чтобы выйти из него',
            components: [row],
            ephemeral: true
          });
          break;
        }

        case 'message_recipient':
        case 'message_santa': {
          const isToRecipient = interaction.customId === 'message_recipient';
          const events = db.getEventsByGuild(guild.id);
          if (!events.length) {
            await interaction.reply({
              content: 'Нет активных событий на этом сервере.',
              ephemeral: true
            });
            return;
          }

          const select = new StringSelectMenuBuilder()
            .setCustomId(isToRecipient ? 'select_message_recipient_event' : 'select_message_santa_event')
            .setPlaceholder('Выберите событие')
            .addOptions(eventOptions(events));

          await interaction.reply({
            content: isToRecipient
              ? 'Выберите событие, чтобы анонимно написать своему подопечному'
              : 'Выберите событие, чтобы анонимно написать своему Санте',
            components: [new ActionRowBuilder().addComponents(select)],
            ephemeral: true
          });
          break;
        }

        case 'organizer_menu': {

          try {
            const member = await guild.members.fetch(user.id);
            const santaRole = guild.roles.cache.find(r => r.name === 'Santa ADM');
            if (!santaRole || !member.roles.cache.has(santaRole.id)) {
              await interaction.reply({
                content:
                  'Меню организатора доступно только организаторам с ролью Santa ADM.',
                ephemeral: true
              });
              return;
            }

            const viewParticipantsBtn = new ButtonBuilder()
              .setCustomId('organizer_view_participants')
              .setLabel('Просмотр участников')
              .setStyle(ButtonStyle.Primary);
            const viewPairsBtn = new ButtonBuilder()
              .setCustomId('organizer_view_pairs')
              .setLabel('Просмотр пар')
              .setStyle(ButtonStyle.Primary);
            const startDrawBtn = new ButtonBuilder()
              .setCustomId('organizer_start_draw')
              .setLabel('Начать жеребьёвку')
              .setStyle(ButtonStyle.Success);
            const changeBudgetBtn = new ButtonBuilder()
              .setCustomId('organizer_change_budget')
              .setLabel('Изменить бюджет')
              .setStyle(ButtonStyle.Secondary);
            const finishBtn = new ButtonBuilder()
              .setCustomId('organizer_finish_event')
              .setLabel('Завершить событие')
              .setStyle(ButtonStyle.Danger);
            const closeBtn = new ButtonBuilder()
              .setCustomId('organizer_close')
              .setLabel('Закрыть')
              .setStyle(ButtonStyle.Secondary);

            const row1 = new ActionRowBuilder().addComponents(
              viewParticipantsBtn,
              viewPairsBtn,
              startDrawBtn,
              changeBudgetBtn,
              finishBtn
            );
            const row2 = new ActionRowBuilder().addComponents(closeBtn);

            await interaction.reply({
              content: 'Меню Организатора',
              components: [row1, row2],
              ephemeral: true
            });
          } catch (err) {
            console.error('Ошибка в organizer_menu:', err);
            await interaction.reply({
              content:
                'Не удалось открыть меню организатора. Проверьте роль и доступ.',
              ephemeral: true
            });
          }
          break;
        }

        case 'organizer_view_participants': {
          const events = db
            .getEventsByGuild(guild.id)
            .filter(e => e.organizerId === user.id);
          if (!events.length) {
            await interaction.reply({
              content: 'У вас нет созданных событий на этом сервере.',
              ephemeral: true
            });
            return;
          }
          const select = new StringSelectMenuBuilder()
            .setCustomId('select_organizer_participants_event')
            .setPlaceholder('Выберите событие для просмотра участников')
            .addOptions(eventOptions(events));
          await interaction.reply({
            content: 'Выберите событие, чтобы получить список участников в DM',
            components: [new ActionRowBuilder().addComponents(select)],
            ephemeral: true
          });
          break;
        }

        case 'organizer_view_pairs': {
          const events = db
            .getEventsByGuild(guild.id)
            .filter(e => e.organizerId === user.id);
          if (!events.length) {
            await interaction.reply({
              content: 'У вас нет созданных событий на этом сервере.',
              ephemeral: true
            });
            return;
          }
          const select = new StringSelectMenuBuilder()
            .setCustomId('select_organizer_pairs_event')
            .setPlaceholder('Выберите событие для просмотра пар')
            .addOptions(eventOptions(events));
          await interaction.reply({
            content: 'Выберите событие, чтобы получить список пар в DM',
            components: [new ActionRowBuilder().addComponents(select)],
            ephemeral: true
          });
          break;
        }

        case 'organizer_start_draw': {
          const events = db
            .getEventsByGuild(guild.id)
            .filter(e => e.organizerId === user.id);
          if (!events.length) {
            await interaction.reply({
              content: 'У вас нет созданных событий на этом сервере.',
              ephemeral: true
            });
            return;
          }
          const select = new StringSelectMenuBuilder()
            .setCustomId('select_start_draw_event')
            .setPlaceholder('Выберите событие для жеребьёвки')
            .addOptions(eventOptions(events));
          await interaction.reply({
            content: 'Выберите событие для начала жеребьёвки',
            components: [new ActionRowBuilder().addComponents(select)],
            ephemeral: true
          });
          break;
        }

        case 'organizer_change_budget': {
          const events = db
            .getEventsByGuild(guild.id)
            .filter(e => e.organizerId === user.id);
          if (!events.length) {
            await interaction.reply({
              content: 'У вас нет созданных событий на этом сервере.',
              ephemeral: true
            });
            return;
          }
          const select = new StringSelectMenuBuilder()
            .setCustomId('select_budget_event')
            .setPlaceholder('Выберите событие для изменения бюджета')
            .addOptions(eventOptions(events));
          await interaction.reply({
            content: 'Выберите событие для изменения бюджета',
            components: [new ActionRowBuilder().addComponents(select)],
            ephemeral: true
          });
          break;
        }

        case 'organizer_finish_event': {
          const events = db
            .getEventsByGuild(guild.id)
            .filter(e => e.organizerId === user.id);
          if (!events.length) {
            await interaction.reply({
              content: 'У вас нет созданных событий на этом сервере.',
              ephemeral: true
            });
            return;
          }
          const select = new StringSelectMenuBuilder()
            .setCustomId('select_finish_event')
            .setPlaceholder('Выберите событие для завершения')
            .addOptions(eventOptions(events));
          await interaction.reply({
            content: 'Выберите событие, которое хотите завершить (удалить)',
            components: [new ActionRowBuilder().addComponents(select)],
            ephemeral: true
          });
          break;
        }

        case 'organizer_close': {
          await interaction.update({
            content: 'Меню организатора закрыто.',
            components: []
          });
          break;
        }

        default:
          console.warn(`[buttons] Неизвестная кнопка: ${interaction.customId}`);
          await interaction.reply({ content: 'Неизвестная кнопка', ephemeral: true });
      }
    } catch (err) {
      console.error('Ошибка в handlers/buttons.js:', err);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Произошла ошибка. Попробуйте снова.',
            ephemeral: true
          });
        } else {
          await interaction.followUp({
            content: 'Произошла ошибка. Попробуйте снова.',
            ephemeral: true
          });
        }
      } catch (e) {
        console.error('Ошибка отправки сообщения об ошибке:', e);
      }
    }
  }
};
