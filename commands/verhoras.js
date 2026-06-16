const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getPatrolHistory, formatTime, hasModRole } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verhoras')
    .setDescription('Ver turnos realizados por un oficial hoy')
    .addStringOption(option =>
      option.setName('nombre')
        .setDescription('Nombre_Apellido del oficial')
        .setRequired(true)),
  async execute(interaction) {
    if (!hasModRole(interaction.member)) {
      return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const query = interaction.options.getString('nombre').toLowerCase().replace(/_/g, ' ').trim();
    const all = getPatrolHistory();

    const members = await interaction.guild.members.fetch();
    let targetUser = members.find(m =>
      m.displayName.toLowerCase().replace(/_/g, ' ').includes(query) ||
      m.user.username.toLowerCase().replace(/_/g, ' ').includes(query)
    );

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    const userPatrols = all.filter(p => {
      const nameMatch = p.displayName.toLowerCase().replace(/_/g, ' ') === query ||
                        p.displayName.toLowerCase().replace(/_/g, ' ').includes(query) ||
                        (targetUser && p.userId === targetUser.id);
      const timeMatch = p.startTime >= todayStart.getTime() && p.startTime <= todayEnd.getTime();
      return nameMatch && timeMatch;
    });

    if (userPatrols.length === 0) {
      return interaction.reply({ content: `❌ No se encontraron turnos hoy para **${query}**.`, flags: MessageFlags.Ephemeral });
    }

    const displayName = targetUser ? targetUser.displayName : userPatrols[0].displayName;
    let totalMs = 0;
    const lines = [];
    for (const p of userPatrols.sort((a, b) => a.startTime - b.startTime)) {
      const start = new Date(p.startTime).toLocaleString('es-ES', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });
      const end = new Date(p.endTime).toLocaleString('es-ES', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });
      const emoji = p.status === 'approved' ? '✅' : p.status === 'rejected' ? '❌' : '⏳';
      lines.push(`${emoji} ${start} - ${end} (${formatTime(p.elapsed)}) \`${p.id}\``);
      totalMs += p.elapsed;
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`📋 Turnos de ${displayName}`)
      .setDescription(lines.join('\n'))
      .addFields(
        { name: '📅 Fecha', value: new Date().toLocaleDateString('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }), inline: true },
        { name: '⏱ Total', value: formatTime(totalMs), inline: true },
        { name: '📊 Turnos', value: `${userPatrols.length}`, inline: true },
      )
      .setFooter({ text: 'Dudar es traición' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
