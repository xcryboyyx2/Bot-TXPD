const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ComponentType, MessageFlags,
} = require('discord.js');
const {
  getPendingPatrols, getPatrolById, updatePatrolStatus,
  formatTime, hasReviewRole,
} = require('../utils');

const STATUS_COLORS = {
  approved: 0x00FF00,
  rejected: 0xFF0000,
  pending: 0xFFA500,
};

function buildPatrolEmbed(patrol) {
  const timeStr = formatTime(patrol.elapsed);
  const startDate = new Date(patrol.startTime).toLocaleString('es-ES', { timeZone: 'UTC' });

  const text = patrol.status === 'pending' ? 'Pendiente'
    : patrol.status === 'approved' ? `Aprobado por ${patrol.reviewedByName}`
    : `Rechazado por ${patrol.reviewedByName}`;

  const embed = new EmbedBuilder()
    .setColor(STATUS_COLORS[patrol.status])
    .setTitle(`⏳ Revisión de Turno`)
    .setDescription(`**Oficial:** ${patrol.displayName}\n**Estado:** ${text}`)
    .addFields(
      { name: '🆔 ID Turno', value: `\`${patrol.id}\``, inline: true },
      { name: '⏱ Duración', value: timeStr, inline: true },
      { name: '🕐 Inicio (UTC)', value: startDate, inline: false },
      { name: '📸 Inicio', value: patrol.images.inicio ? `[Ver imagen](${patrol.images.inicio})` : 'No proporcionada', inline: true },
      { name: '📸 Fin', value: patrol.images.fin ? `[Ver imagen](${patrol.images.fin})` : 'No proporcionada', inline: true },
      { name: '📸 /dveh', value: patrol.images.dveh ? `[Ver imagen](${patrol.images.dveh})` : 'No proporcionada', inline: true },
      { name: '📸 /fuerza', value: patrol.images.fuerza ? `[Ver imagen](${patrol.images.fuerza})` : 'No proporcionada', inline: true },
    )
    .setFooter({ text: 'Dudar es traición' })
    .setTimestamp();

  if (patrol.images.inicio) embed.setThumbnail(patrol.images.inicio);
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('revisar')
    .setDescription('Revisar turnos pendientes de verificación'),
  async execute(interaction) {
    if (!hasReviewRole(interaction.member)) {
      return interaction.reply({
        content: '❌ Solo el personal de **Control de Asistencias** puede usar este comando.',
        flags: MessageFlags.Ephemeral,
      });
    }

    let pending = getPendingPatrols();
    if (pending.length === 0) {
      return interaction.reply({
        content: '✅ No hay turnos pendientes de revisión.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // --- Step 1: List of pending patrols ---

    const listDesc = pending.map((p, i) =>
      `**${i + 1}.** ${p.displayName} — ${formatTime(p.elapsed)} — \`${p.id}\``
    ).join('\n');

    const listEmbed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('📋 Turnos Pendientes de Revisión')
      .setDescription(listDesc)
      .setFooter({ text: `Total: ${pending.length} turno(s)` })
      .setTimestamp();

    const selectPatrol = new StringSelectMenuBuilder()
      .setCustomId('revisar_patrol')
      .setPlaceholder('Selecciona un turno para revisar')
      .addOptions(
        pending.map((p, i) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${i + 1}. ${p.displayName}`)
            .setDescription(`${formatTime(p.elapsed)} — ID: ${p.id}`.slice(0, 100))
            .setValue(p.id)
        )
      );

    const row1 = new ActionRowBuilder().addComponents(selectPatrol);

    const reply = await interaction.reply({
      embeds: [listEmbed],
      components: [row1],
      flags: MessageFlags.Ephemeral,
    });

    const filter = i => i.user.id === interaction.user.id;

    try {
      const patrolSelect = await reply.awaitMessageComponent({
        filter,
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      const patrolId = patrolSelect.values[0];
      const patrol = getPatrolById(patrolId);
      if (!patrol || patrol.status !== 'pending') {
        return patrolSelect.update({
          content: '❌ Este turno ya no está pendiente.',
          embeds: [],
          components: [],
        });
      }

      // --- Step 2: Show patrol detail with approve/reject ---

      const actionSelect = new StringSelectMenuBuilder()
        .setCustomId('revisar_accion')
        .setPlaceholder('Selecciona una acción')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Aprobar')
            .setDescription('Aprobar este turno')
            .setValue('approve')
            .setEmoji('✅'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Rechazar')
            .setDescription('Rechazar este turno')
            .setValue('reject')
            .setEmoji('❌'),
        );

      const row2 = new ActionRowBuilder().addComponents(actionSelect);

      const detailEmbed = buildPatrolEmbed(patrol);

      await patrolSelect.update({ embeds: [detailEmbed], components: [row2] });

      const actionCollect = await patrolSelect.message.awaitMessageComponent({
        filter,
        componentType: ComponentType.StringSelect,
        time: 120000,
      });

      const action = actionCollect.values[0];
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      let logMsgId;

      const logChannelId = process.env.LOG_CHANNEL_ID;
      const logChannel = logChannelId ? interaction.guild.channels.cache.get(logChannelId) : null;
      const timeStr = formatTime(patrol.elapsed);
      const dateStr = new Date(patrol.startTime).toLocaleString('es-ES', { timeZone: 'UTC', dateStyle: 'long', timeStyle: 'short' });
      const member = interaction.guild.members.cache.get(patrol.userId);
      const mention = member ? `${member}` : patrol.displayName;

      if (newStatus === 'approved') {
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Patrullaje Aprobado')
            .setDescription(`${mention} ha realizado su patrullaje de forma exitosa y ha servido a la ciudadanía como se debe. ¡Esperamos volver a verte en servicio pronto!`)
            .addFields(
              { name: '⏱ Horas', value: timeStr, inline: true },
              { name: '📅 Fecha', value: dateStr, inline: true },
            )
            .setFooter({ text: 'Dudar es traición' })
            .setTimestamp();

          const bannerUrl = process.env.LOG_BANNER_URL || patrol.images.inicio;
          if (bannerUrl) logEmbed.setImage(bannerUrl);

          const logMsg = await logChannel.send({ embeds: [logEmbed] });
          logMsgId = logMsg.id;
        }
      } else {
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Patrullaje Rechazado')
            .setDescription(`${mention} — El turno \`${patrol.id}\` ha sido rechazado.`)
            .addFields(
              { name: '⏱ Horas', value: timeStr, inline: true },
              { name: '📅 Fecha', value: dateStr, inline: true },
            )
            .setFooter({ text: 'Dudar es traición' })
            .setTimestamp();

          const bannerUrl = process.env.LOG_BANNER_URL || patrol.images.inicio;
          if (bannerUrl) logEmbed.setImage(bannerUrl);

          const logMsg = await logChannel.send({ embeds: [logEmbed] });
          logMsgId = logMsg.id;
        }
      }

      const officerMember = interaction.guild.members.cache.get(patrol.userId);

      if (newStatus === 'approved') {
        const receiptEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('📄 Comprobante de Patrullaje')
          .setDescription(`**Oficial:** ${patrol.displayName}\n**Estado:** ✅ Aprobado`)
          .addFields(
            { name: '🆔 ID Turno', value: `\`${patrol.id}\``, inline: true },
            { name: '⏱ Horas', value: formatTime(patrol.elapsed), inline: true },
            { name: '📸 Inicio', value: patrol.images.inicio ? `[Ver imagen](${patrol.images.inicio})` : 'No proporcionada', inline: true },
            { name: '📸 Fin', value: patrol.images.fin ? `[Ver imagen](${patrol.images.fin})` : 'No proporcionada', inline: true },
            { name: '📸 /dveh', value: patrol.images.dveh ? `[Ver imagen](${patrol.images.dveh})` : 'No proporcionada', inline: true },
            { name: '📸 /fuerza', value: patrol.images.fuerza ? `[Ver imagen](${patrol.images.fuerza})` : 'No proporcionada', inline: true },
          )
          .setFooter({ text: 'Dudar es traición' })
          .setTimestamp();

        if (patrol.images.inicio) receiptEmbed.setThumbnail(patrol.images.inicio);

        if (officerMember) {
          try {
            await officerMember.send({ embeds: [receiptEmbed] });
          } catch {}
        }
      } else {
        const rejectEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Patrullaje Rechazado')
          .setDescription(`**Oficial:** ${patrol.displayName}\n\nTu turno \`${patrol.id}\` ha sido **rechazado**.\n\nSi crees que esto fue un error, abre un ticket y contacta al personal encargado.`)
          .addFields(
            { name: '⏱ Horas', value: formatTime(patrol.elapsed), inline: true },
          )
          .setFooter({ text: 'Dudar es traición' })
          .setTimestamp();

        if (officerMember) {
          try {
            await officerMember.send({ embeds: [rejectEmbed] });
          } catch {}
        }
      }

      updatePatrolStatus(patrol.id, newStatus, interaction.user.id, interaction.user.displayName, logMsgId);

      const resultColor = newStatus === 'approved' ? 0x00FF00 : 0xFF0000;
      const resultEmoji = newStatus === 'approved' ? '✅' : '❌';
      const resultText = newStatus === 'approved' ? 'Aprobado' : 'Rechazado';

      const resultEmbed = new EmbedBuilder()
        .setColor(resultColor)
        .setTitle(`${resultEmoji} Turno ${resultText}`)
        .setDescription(`**Oficial:** ${patrol.displayName}\n**Turno:** \`${patrol.id}\``)
        .addFields({ name: '⏱ Duración', value: formatTime(patrol.elapsed), inline: true })
        .setTimestamp();

      await actionCollect.update({ embeds: [resultEmbed], components: [] });

      // --- Continue with next pending ---
      pending = getPendingPatrols();
      if (pending.length === 0) {
        await interaction.followUp({
          content: '✅ **Todos los turnos han sido revisados.**',
          flags: MessageFlags.Ephemeral,
        });
      } else {
        const remainDesc = pending.map((p, i) =>
          `**${i + 1}.** ${p.displayName} — ${formatTime(p.elapsed)} — \`${p.id}\``
        ).join('\n');

        const remainEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('📋 Turnos Pendientes Restantes')
          .setDescription(remainDesc)
          .setFooter({ text: `Restantes: ${pending.length} turno(s)` })
          .setTimestamp();

        await interaction.followUp({
          content: 'Usa `/revisar` nuevamente para seguir revisando.',
          embeds: [remainEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }

    } catch {
      await interaction.editReply({ content: '⏰ Tiempo de espera agotado.', components: [] });
    }
  },
};
