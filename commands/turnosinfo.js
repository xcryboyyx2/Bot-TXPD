const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { hasModRole } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('turnosinfo')
    .setDescription('Enviar mensaje informativo sobre el sistema de turnos'),
  async execute(interaction) {
    if (!hasModRole(interaction.member)) {
      return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setColor(0x1A5276)
      .setTitle('🚔 Función de los turnos')
      .setDescription('Se implementa un nuevo formato para automatizar los turnos hechos por el personal operativo, se va a utilizar esto para llevar un mejor control y comodidad del personal operativo.\n\nSu uso consta de 3 comandos para iniciar, finalizar y terminar un turno por si no puedes completarlo.')
      .addFields(
        { name: '`/inicio`', value: 'Iniciar tu turno de patrullaje.', inline: false },
        { name: '`/fin`', value: 'Finalizar tu turno de patrullaje. (Fotos obligatorias requeridas)', inline: false },
        { name: '`/cancelarturno`', value: 'Cancelar tu turno por si tienes inconvenientes.', inline: false },
      )
      .setFooter({ text: 'Eviten mal usar este hilo, únicamente se usará para los tres comandos antes mencionados.' })
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });
    await interaction.reply({ content: '✅ Mensaje enviado.', flags: MessageFlags.Ephemeral });
  },
};
