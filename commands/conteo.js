const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, MessageFlags } = require('discord.js');
const { getRanking, getPatrolHistory, formatTime, hasOfficerRole } = require('../utils');

const MS_24H = 24 * 60 * 60 * 1000;
const MS_15D = 15 * 24 * 60 * 60 * 1000;
const MS_30D = 30 * 24 * 60 * 60 * 1000;

function getFilteredRanking(limitMs) {
  if (!limitMs) return getRanking().map(e => ({ ...e, filteredMs: e.totalMs }));

  const cutoff = Date.now() - limitMs;
  const history = getPatrolHistory();
  const userMap = {};

  for (const h of history) {
    if (h.startTime < cutoff) continue;
    if (!userMap[h.userId]) {
      userMap[h.userId] = { userId: h.userId, userName: h.userName, displayName: h.displayName, filteredMs: 0, count: 0 };
    }
    userMap[h.userId].filteredMs += h.elapsed;
    userMap[h.userId].count++;
  }

  return Object.values(userMap).sort((a, b) => b.filteredMs - a.filteredMs);
}

function buildRankingEmbed(entries, guild, periodName) {
  if (entries.length === 0) {
    return new EmbedBuilder()
      .setColor(0xCC0000)
      .setTitle('🏆 Conteo — ' + periodName)
      .setDescription('No hay turnos registrados en este período.');
  }

  const medalEmojis = ['🥇', '🥈', '🥉'];
  const top = entries.slice(0, 10);
  const description = top.map((entry, index) => {
    const medal = medalEmojis[index] || `**${index + 1}.**`;
    const member = guild?.members.cache.get(entry.userId);
    const name = member ? member.displayName : entry.displayName;
    return `${medal} **${name}** — ${formatTime(entry.filteredMs)} (${entry.count} turnos)`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle(`🏆 Conteo — ${periodName}`)
    .setDescription(description)
    .setFooter({ text: 'Top 10 oficiales' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('conteo')
    .setDescription('Ver conteo de horas de patrullaje'),
  async execute(interaction) {
    if (!hasOfficerRole(interaction.member)) {
      return interaction.reply({ content: '❌ Solo los oficiales pueden usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('conteo_periodo')
      .setPlaceholder('Selecciona un período')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Diarias (24h)')
          .setDescription('Últimas 24 horas')
          .setValue('24h')
          .setEmoji('📅'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Quincenales (15 días)')
          .setDescription('Últimos 15 días')
          .setValue('15d')
          .setEmoji('📆'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Mensuales (30 días)')
          .setDescription('Últimos 30 días')
          .setValue('30d')
          .setEmoji('📊'),
      );

    const row = new ActionRowBuilder().addComponents(select);

    const reply = await interaction.reply({
      content: '📋 **Selecciona el período para ver el conteo:**',
      components: [row],
      flags: MessageFlags.Ephemeral,
    });

    const filter = i => i.customId === 'conteo_periodo' && i.user.id === interaction.user.id;

    try {
      const collected = await reply.awaitMessageComponent({ filter, componentType: ComponentType.StringSelect, time: 60000 });

      const value = collected.values[0];
      let limitMs, periodName;

      switch (value) {
        case '24h':
          limitMs = MS_24H;
          periodName = 'Diarias (24h)';
          break;
        case '15d':
          limitMs = MS_15D;
          periodName = 'Quincenales (15 días)';
          break;
        case '30d':
          limitMs = MS_30D;
          periodName = 'Mensuales (30 días)';
          break;
      }

      const filtered = getFilteredRanking(limitMs);
      const embed = buildRankingEmbed(filtered, interaction.guild, periodName);

      await collected.update({ content: null, embeds: [embed], components: [] });
    } catch {
      await interaction.editReply({ content: '⏰ Tiempo de espera agotado.', components: [] });
    }
  },
};
