const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getActivePatrol, startPatrol, hasOfficerRole, isPatrolChannel } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inicio')
    .setDescription('Iniciar turno de patrullaje'),
  async execute(interaction) {
    if (!hasOfficerRole(interaction.member)) {
      return interaction.reply({ content: '❌ Solo los oficiales con rol **Refuerzos** pueden usar este comando.', flags: MessageFlags.Ephemeral });
    }

    if (!isPatrolChannel(interaction)) {
      return interaction.reply({ content: '❌ Este comando solo puede usarse en el foro de patrullaje.', flags: MessageFlags.Ephemeral });
    }

    const existing = getActivePatrol(interaction.user.id);
    if (existing) {
      return interaction.reply({ content: 'Ya tienes un turno activo. Usa /fin para terminarlo o /cancelarturno para cancelarlo.', flags: MessageFlags.Ephemeral });
    }

    startPatrol(interaction.user.id, interaction.channelId);

    const role = interaction.guild.roles.cache.find(r => r.name === 'On duty');
    if (role) await interaction.member.roles.add(role);

    const embed = new EmbedBuilder()
      .setColor(0x1A5276)
      .setAuthor({ name: interaction.member.displayName, iconURL: interaction.user.displayAvatarURL() })
      .setTitle('🚔 INICIO DE PATRULLAJE')
      .setDescription(`${interaction.user}`)
      .addFields({ name: '⏱ Tiempo', value: '**00:00:00**', inline: true })
      .setFooter({ text: 'Dudar es traición' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
