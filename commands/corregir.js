const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ComponentType, MessageFlags,
} = require('discord.js');
const {
  getReviewedPatrols, revertPatrolStatus, formatTime, hasModRole, hasReviewRole,
} = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('corregir')
    .setDescription('Revertir un turno aprobado/rechazado a revisión'),
  async execute(interaction) {
    if (!hasModRole(interaction.member) && !hasReviewRole(interaction.member)) {
      return interaction.reply({
        content: '❌ No tienes permiso para usar este comando.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const reviewed = getReviewedPatrols();
    if (reviewed.length === 0) {
      return interaction.reply({
        content: 'No hay turnos aprobados o rechazados para corregir.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('corregir_seleccion')
      .setPlaceholder('Selecciona un turno para revertir')
      .addOptions(
        reviewed.slice(0, 20).map(p => {
          const statusEmoji = p.status === 'approved' ? '✅' : '❌';
          const label = `${statusEmoji} ${p.displayName} — ${formatTime(p.elapsed)}`.slice(0, 100);
          return new StringSelectMenuOptionBuilder()
            .setLabel(label)
            .setDescription(`ID: ${p.id} — ${p.status === 'approved' ? 'Aprobado' : 'Rechazado'}`.slice(0, 100))
            .setValue(p.id);
        })
      );

    const row = new ActionRowBuilder().addComponents(select);

    const reply = await interaction.reply({
      content: '🔄 **Selecciona el turno que deseas revertir a revisión:**',
      components: [row],
      flags: MessageFlags.Ephemeral,
    });

    const filter = i => i.customId === 'corregir_seleccion' && i.user.id === interaction.user.id;

    try {
      const collected = await reply.awaitMessageComponent({ filter, componentType: ComponentType.StringSelect, time: 60000 });
      const patrolId = collected.values[0];
      const result = revertPatrolStatus(patrolId);

      if (!result) {
        return collected.update({ content: '❌ Error al revertir el turno.', components: [] });
      }

      if (result.oldLogMessageId) {
        const logChannelId = process.env.LOG_CHANNEL_ID;
        if (logChannelId) {
          const logChannel = interaction.guild.channels.cache.get(logChannelId);
          if (logChannel) {
            try {
              const logMsg = await logChannel.messages.fetch(result.oldLogMessageId);
              await logMsg.delete();
            } catch {}
          }
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('🔄 Turno Revertido')
        .setDescription(`**Oficial:** ${result.displayName}\n**Estado anterior:** ${result.oldStatus === 'approved' ? '✅ Aprobado' : '❌ Rechazado'}\n**Nuevo estado:** ⏳ Pendiente de revisión`)
        .addFields({ name: '⏱ Duración', value: formatTime(result.elapsed), inline: true })
        .setTimestamp();

      await collected.update({ content: null, embeds: [embed], components: [] });
    } catch {
      await interaction.editReply({ content: '⏰ Tiempo de espera agotado.', components: [] });
    }
  },
};
