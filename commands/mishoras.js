const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getPatrolHistory, formatTime, hasOfficerRole } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mishoras')
    .setDescription('Ver tus horas totales de patrullaje'),
  async execute(interaction) {
    if (!hasOfficerRole(interaction.member)) {
      return interaction.reply({ content: '❌ Solo los oficiales pueden usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const history = getPatrolHistory(interaction.user.id);

    if (history.length === 0) {
      return interaction.reply('No tienes turnos registrados aún.');
    }

    const totalMs = history.reduce((sum, h) => sum + h.elapsed, 0);

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`📊 Horas de ${interaction.member.displayName}`)
      .addFields(
        { name: '⏱ Tiempo total', value: formatTime(totalMs), inline: true },
        { name: '📋 Turnos completados', value: `${history.length}`, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
