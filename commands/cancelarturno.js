const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getActivePatrol, cancelPatrol, formatTime, hasOfficerRole } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cancelarturno')
    .setDescription('Cancelar el turno de patrullaje actual'),
  async execute(interaction) {
    if (!hasOfficerRole(interaction.member)) {
      return interaction.reply({ content: '❌ Solo los oficiales con rol **Refuerzos** pueden usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const existing = getActivePatrol(interaction.user.id);
    if (!existing) {
      return interaction.reply({ content: 'No tienes un turno activo para cancelar.', flags: MessageFlags.Ephemeral });
    }

    const result = cancelPatrol(interaction.user.id);
    const elapsed = Date.now() - result.startTime;

    const role = interaction.guild.roles.cache.find(r => r.name === 'On duty');
    if (role) await interaction.member.roles.remove(role);
    const timeStr = formatTime(elapsed);

    await interaction.reply({ content: `❌ Turno cancelado. Tiempo transcurrido: **${timeStr}** (no registrado).`, flags: MessageFlags.Ephemeral });
  },
};
