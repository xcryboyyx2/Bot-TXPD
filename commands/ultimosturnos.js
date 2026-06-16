const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getPatrolHistory, formatTime, hasModRole } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ultimosturnos')
    .setDescription('Ver turnos realizados en las últimas 24 horas'),
  async execute(interaction) {
    if (!hasModRole(interaction.member)) {
      return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const all = getPatrolHistory();
    const cutoff = Date.now() - 86400000;
    const recent = all.filter(p => p.startTime >= cutoff);

    if (recent.length === 0) {
      return interaction.reply({ content: '✅ No hay turnos registrados en las últimas 24 horas.', flags: MessageFlags.Ephemeral });
    }

    const pending = recent.filter(p => p.status === 'pending');
    const approved = recent.filter(p => p.status === 'approved');
    const rejected = recent.filter(p => p.status === 'rejected');

    const lines = [];
    for (const p of recent.sort((a, b) => b.startTime - a.startTime)) {
      const emoji = p.status === 'approved' ? '✅' : p.status === 'rejected' ? '❌' : '⏳';
      const time = new Date(p.startTime).toLocaleString('es-ES', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });
      lines.push(`${emoji} **${p.displayName}** — ${formatTime(p.elapsed)} — ${time} UTC \`${p.id}\``);
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('📋 Turnos — Últimas 24h')
      .setDescription(lines.join('\n'))
      .addFields(
        { name: '⏳ Pendientes', value: `${pending.length}`, inline: true },
        { name: '✅ Aprobados', value: `${approved.length}`, inline: true },
        { name: '❌ Rechazados', value: `${rejected.length}`, inline: true },
      )
      .setFooter({ text: 'Dudar es traición' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
