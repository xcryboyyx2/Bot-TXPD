const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { hasModRole, hasSupervisorRole } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsar a un miembro del servidor')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario a expulsar')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('razon')
        .setDescription('Razón de la expulsión')
        .setRequired(false)),
  async execute(interaction) {
    if (!hasModRole(interaction.member) && !hasSupervisorRole(interaction.member)) {
      return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const target = interaction.options.getMember('usuario');
    const reason = interaction.options.getString('razon') || 'No especificada';

    if (!target) {
      return interaction.reply({ content: '❌ El usuario no está en el servidor.', flags: MessageFlags.Ephemeral });
    }

    if (!target.kickable) {
      return interaction.reply({ content: '❌ No puedo expulsar a ese usuario.', flags: MessageFlags.Ephemeral });
    }

    await target.kick(reason);

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('👢 Usuario Expulsado')
      .addFields(
        { name: 'Usuario', value: `${target.displayName} (${target.id})`, inline: true },
        { name: 'Moderador', value: interaction.member.displayName, inline: true },
        { name: 'Razón', value: reason, inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
