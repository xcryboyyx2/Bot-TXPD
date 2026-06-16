const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChannelType } = require('discord.js');
const { hasModRole, hasReviewRole } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('turnosinfo')
    .setDescription('Crear post informativo sobre el sistema de turnos en el foro'),
  async execute(interaction) {
    if (!hasModRole(interaction.member) && !hasReviewRole(interaction.member)) {
      return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const forumId = process.env.PATROL_FORUM_ID;
    if (!forumId) {
      return interaction.reply({ content: '❌ PATROL_FORUM_ID no está configurado.', flags: MessageFlags.Ephemeral });
    }

    const forum = interaction.guild.channels.cache.get(forumId);
    if (!forum || forum.type !== ChannelType.GuildForum) {
      return interaction.reply({ content: '❌ No se encontró el foro de patrullaje.', flags: MessageFlags.Ephemeral });
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

    try {
      await forum.threads.create({
        name: 'duty',
        message: { embeds: [embed] },
        autoArchiveDuration: 1440,
      });
      await interaction.reply({ content: '✅ Post "duty" creado en el foro.', flags: MessageFlags.Ephemeral });
    } catch (e) {
      if (e.code === 160004) {
        return interaction.reply({ content: '❌ Ya existe un post llamado "duty". Borra el existente primero.', flags: MessageFlags.Ephemeral });
      }
      await interaction.reply({ content: `❌ Error al crear el post: ${e.message}`, flags: MessageFlags.Ephemeral });
    }
  },
};
