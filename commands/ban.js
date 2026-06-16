const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { hasModRole } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banear a un usuario del servidor')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario a banear')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('razon')
        .setDescription('Razón del baneo')
        .setRequired(false)),
  async execute(interaction) {
    if (!hasModRole(interaction.member)) {
      return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const target = interaction.options.getMember('usuario');
    const reason = interaction.options.getString('razon') || 'No especificada';

    if (!target) {
      return interaction.reply({ content: '❌ El usuario no está en el servidor.', flags: MessageFlags.Ephemeral });
    }

    if (!target.bannable) {
      return interaction.reply({ content: '❌ No puedo banear a ese usuario.', flags: MessageFlags.Ephemeral });
    }

    await target.ban({ reason });

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🔨 Usuario Baneado')
      .addFields(
        { name: 'Usuario', value: `${target.displayName} (${target.id})`, inline: true },
        { name: 'Moderador', value: interaction.member.displayName, inline: true },
        { name: 'Razón', value: reason, inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
