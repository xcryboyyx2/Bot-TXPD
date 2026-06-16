const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getPatrolHistory, formatTime, hasModRole } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ultimosturnos')
    .setDescription('Ver turnos registrados')
    .addIntegerOption(option =>
      option.setName('horas')
        .setDescription('Horas hacia atrás (0 = todos, default 24)')
        .setRequired(false)),
  async execute(interaction) {
    if (!hasModRole(interaction.member)) {
      return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const hours = interaction.options.getInteger('horas') ?? 24;
    const all = getPatrolHistory();
    const cutoff = hours > 0 ? Date.now() - hours * 3600000 : 0;
    const recent = all.filter(p => p.startTime >= cutoff);

    if (recent.length === 0) {
      const msg = hours > 0 ? `en las últimas ${hours}h` : 'registrados';
      return interaction.reply({ content: `✅ No hay turnos ${msg}.`, flags: MessageFlags.Ephemeral });
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

    const hoursLabel = hours > 0 ? `Últimas ${hours}h` : 'Todos los turnos';
    let desc = lines.join('\n');
    if (desc.length > 4000) desc = desc.slice(0, 3997) + '...';

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`📋 ${hoursLabel}`)
      .setDescription(desc)
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
