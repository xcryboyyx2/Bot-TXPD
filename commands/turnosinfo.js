const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { hasCupulaRole } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('turnosinfo')
    .setDescription('Enviar mensaje personalizado al canal de conteo')
    .addStringOption(option =>
      option.setName('mensaje')
        .setDescription('Contenido del mensaje a publicar')
        .setRequired(true)),
  async execute(interaction) {
    if (!hasCupulaRole(interaction.member)) {
      return interaction.reply({ content: '❌ Solo la cúpula departamental puede usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const threadId = process.env.INFO_THREAD_ID;
    if (!threadId) {
      return interaction.reply({ content: '❌ INFO_THREAD_ID no está configurado.', flags: MessageFlags.Ephemeral });
    }

    const content = interaction.options.getString('mensaje');

    const thread = interaction.guild.channels.cache.get(threadId);
    if (!thread) {
      return interaction.reply({ content: '❌ No se encontró el hilo configurado.', flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setColor(0x1A5276)
      .setDescription(content)
      .setAuthor({ name: interaction.member.displayName, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    try {
      await thread.send({ embeds: [embed] });
      await interaction.reply({ content: '✅ Mensaje enviado.', flags: MessageFlags.Ephemeral });
    } catch {
      await interaction.reply({ content: '❌ Error al enviar el mensaje. Verifica que el bot tenga permisos en ese hilo.', flags: MessageFlags.Ephemeral });
    }
  },
};
