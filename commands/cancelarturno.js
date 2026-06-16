const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getActivePatrol, cancelPatrol, formatTime, hasOfficerRole, isPatrolChannel } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cancelarturno')
    .setDescription('Cancelar el turno de patrullaje actual'),
  async execute(interaction) {
    if (!hasOfficerRole(interaction.member)) {
      await interaction.reply({ content: '❌ Solo los oficiales con rol **Refuerzos** pueden usar este comando.', flags: MessageFlags.Ephemeral });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    if (!isPatrolChannel(interaction)) {
      await interaction.reply({ content: '❌ Este comando solo puede usarse en el foro de patrullaje.', flags: MessageFlags.Ephemeral });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    const existing = getActivePatrol(interaction.user.id);
    if (!existing) {
      await interaction.reply({ content: 'No tienes un turno activo para cancelar.', flags: MessageFlags.Ephemeral });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    const result = cancelPatrol(interaction.user.id);
    const elapsed = Date.now() - result.startTime;

    const role = interaction.guild.roles.cache.find(r => r.name === 'On duty');
    if (role) await interaction.member.roles.remove(role);
    const timeStr = formatTime(elapsed);

    const cancelEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setAuthor({ name: interaction.member.displayName, iconURL: interaction.user.displayAvatarURL() })
      .setTitle('❌ TURNO CANCELADO')
      .setDescription(`${interaction.user}`)
      .addFields({ name: '⏱ Tiempo transcurrido', value: timeStr, inline: true })
      .setFooter({ text: 'No registrado' })
      .setTimestamp();

    await interaction.reply({ embeds: [cancelEmbed], flags: MessageFlags.Ephemeral });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
  },
};
