const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getActivePatrol, endPatrol, savePatrolHistory, formatTime, hasOfficerRole, isPatrolChannel } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fin')
    .setDescription('Finalizar turno de patrullaje')
    .addAttachmentOption(option =>
      option.setName('inicio')
        .setDescription('Captura de inicio de patrullaje (opcional)')
        .setRequired(false))
    .addAttachmentOption(option =>
      option.setName('fin')
        .setDescription('Captura de fin de patrullaje (opcional)')
        .setRequired(false))
    .addAttachmentOption(option =>
      option.setName('dveh')
        .setDescription('Captura de /dveh (opcional)')
        .setRequired(false))
    .addAttachmentOption(option =>
      option.setName('fuerza')
        .setDescription('Captura de /fuerza (opcional)')
        .setRequired(false)),
  async execute(interaction) {
    if (!hasOfficerRole(interaction.member)) {
      await interaction.reply({ content: '❌ Solo los oficiales con rol **Refuerzos** pueden usar este comando.', flags: MessageFlags.Ephemeral });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    if (!isPatrolChannel(interaction)) {
      await interaction.reply({ content: '❌ Este comando solo puede usarse en el foro de patrullaje.', flags: MessageFlags.Ephemeral });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    const existing = getActivePatrol(interaction.user.id);
    if (!existing) {
      await interaction.reply({ content: 'No tienes un turno activo. Usa /inicio para empezar uno.', flags: MessageFlags.Ephemeral });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    const result = endPatrol(interaction.user.id);
    const timeStr = formatTime(result.elapsed);

    const role = interaction.guild.roles.cache.find(r => r.name === 'On duty');
    if (role) await interaction.member.roles.remove(role);

    const imgInicio = interaction.options.getAttachment('inicio');
    const imgFin = interaction.options.getAttachment('fin');
    const imgDveh = interaction.options.getAttachment('dveh');
    const imgFuerza = interaction.options.getAttachment('fuerza');

    const patrol = savePatrolHistory(
      interaction.user.id,
      interaction.member.displayName,
      interaction.member.displayName,
      result.startTime,
      result.elapsed,
      { inicio: imgInicio?.url || null, fin: imgFin?.url || null, dveh: imgDveh?.url || null, fuerza: imgFuerza?.url || null }
    );

    const patrolDate = new Date().toLocaleDateString('es-ES', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });

    const receiptEmbed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('📄 Comprobante de Patrullaje')
      .setDescription(`**Oficial:** ${interaction.member.displayName}\n**Estado:** ⏳ Pendiente de revisión`)
      .addFields(
        { name: '🆔 ID Turno', value: `\`${patrol.id}\``, inline: true },
        { name: '📅 Fecha', value: patrolDate, inline: true },
        { name: '⏱ Horas', value: formatTime(result.elapsed), inline: true },
        { name: '📸 Inicio', value: imgInicio ? `[Ver imagen](${imgInicio.url})` : 'No proporcionada', inline: true },
        { name: '📸 Fin', value: imgFin ? `[Ver imagen](${imgFin.url})` : 'No proporcionada', inline: true },
        { name: '📸 /dveh', value: imgDveh ? `[Ver imagen](${imgDveh.url})` : 'No proporcionada', inline: true },
        { name: '📸 /fuerza', value: imgFuerza ? `[Ver imagen](${imgFuerza.url})` : 'No proporcionada', inline: true },
      )
      .setFooter({ text: 'Dudar es traición' })
      .setTimestamp();

    receiptEmbed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 1024 }));

    try {
      await interaction.user.send({ embeds: [receiptEmbed] });
    } catch {}

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Turno Finalizado')
      .setDescription(`**${interaction.user.displayName}** ha terminado su patrullaje`)
      .addFields(
        { name: '⏱ Tiempo total', value: timeStr, inline: true },
        { name: '📸 Inicio', value: imgInicio ? '[Ver imagen](' + imgInicio.url + ')' : 'No proporcionada', inline: true },
        { name: '📸 Fin', value: imgFin ? '[Ver imagen](' + imgFin.url + ')' : 'No proporcionada', inline: true },
        { name: '📸 /dveh', value: imgDveh ? '[Ver imagen](' + imgDveh.url + ')' : 'No proporcionada', inline: true },
        { name: '📸 /fuerza', value: imgFuerza ? '[Ver imagen](' + imgFuerza.url + ')' : 'No proporcionada', inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
  },
};
