const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { hasModRole } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Silenciar a un miembro del servidor')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario a silenciar')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('minutos')
        .setDescription('Duración en minutos')
        .setRequired(true)
        .setMinValue(1))
    .addStringOption(option =>
      option.setName('razon')
        .setDescription('Razón del silencio')
        .setRequired(false)),
  async execute(interaction) {
    if (!hasModRole(interaction.member)) {
      return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const target = interaction.options.getMember('usuario');
    const minutes = interaction.options.getInteger('minutos');
    const reason = interaction.options.getString('razon') || 'No especificada';

    if (!target) {
      return interaction.reply({ content: '❌ El usuario no está en el servidor.', flags: MessageFlags.Ephemeral });
    }

    if (!target.moderatable) {
      return interaction.reply({ content: '❌ No puedo silenciar a ese usuario.', flags: MessageFlags.Ephemeral });
    }

    const durationMs = minutes * 60 * 1000;
    await target.timeout(durationMs, reason);

    const embed = new EmbedBuilder()
      .setColor(0xFFFF00)
      .setTitle('🔇 Usuario Silenciado')
      .addFields(
        { name: 'Usuario', value: `${target.displayName} (${target.id})`, inline: true },
        { name: 'Duración', value: `${minutes} minuto(s)`, inline: true },
        { name: 'Moderador', value: interaction.member.displayName, inline: true },
        { name: 'Razón', value: reason, inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
