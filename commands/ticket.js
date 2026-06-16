const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, MessageFlags } = require('discord.js');
const { hasModRole } = require('../utils');

const SECTIONS = {
  control_asistencias: {
    label: 'Control de Asistencias',
    emoji: '📋',
    desc: 'Ayuda referente a tus turnos y dudas sobre tus horas',
    color: 0x00FF00,
    title: '📋 Control de Asistencias',
    content: 'Bienvenido a la sección de Control de asistencias, por favor, realiza el siguiente formato para ser atendido a la brevedad por el personal encargado del Control de asistencias:\n\n- Nombre_Apellido:\n- Razón/Duda:\n- SS del comprobante del turno:',
    roles: ['Control de Asistencias'],
  },
  asistencia_supervisores: {
    label: 'Asistencia de Supervisores',
    emoji: '👮',
    desc: 'Quejas, dudas y/o soporte del personal de Supervisores',
    color: 0x3498DB,
    title: '👮 Asistencia de Supervisores',
    content: 'Bienvenido al apartado para recibir asistencia del personal de Supervisores del departamento, por favor, redacta tu problema o duda y espera asitencia de los mismos siguiendo el formato:\n\nNombre_Apellido:\nRango departamental:\nDuda/Razón/Queja:',
    roles: ['Police Supervisor', 'Police Chief Supervisor'],
  },
  cupula: {
    label: 'Personal de Cúpula',
    emoji: '🏛️',
    desc: 'Asistencia de la cúpula departamental de Texas',
    color: 0xFFD700,
    title: '🏛️ Personal de Cúpula',
    content: 'Bienvenido al apartado para recibir asistencia del personal de cúpula, por favor, redacta tu queja/duda o problema para recibir la asistencia de la cúpula departamental de TXPD usando el siguiente formato:\n\n- Nombre_Apellido:\n- Rango departamental:\n- Queja/problema/duda:\n\nEvita tags innecesarios y espera pacientemente al personal.',
    roles: ['Police Sergeant I', 'Police Sergeant II'],
  },
  asuntos_internos: {
    label: 'Asuntos Internos',
    emoji: '🔍',
    desc: 'Ayuda o atención de A.I (Special Investigation Section)',
    color: 0x2C3E50,
    title: '🔍 Asuntos Internos',
    content: 'Bienvenido al apartado de Asuntos Internos, en este apartado vas a conseguir atención del personal de la Special Investigation Section (SEE), por favor, redacta tu queja/problema/duda realizando el siguiente formato:\n\nNombre_Apellido:\nRango departamental:\nQueja/duda/problema:\n\nEvita taggeos innecesarios y espera pacientemente al personal.',
    roles: ['Special Investigation Section'],
  },
  retired_officer: {
    label: 'Reintegro — Oficiales Retirados',
    emoji: '🪖',
    desc: 'Solicitar reintegro al departamento',
    color: 0x808080,
    title: '🪖 Reintegro — Oficiales Retirados',
    content: 'Bienvenido al apartado de Reintegro para Oficiales Retirados, por favor, realiza el siguiente formato para ser atendido a la brevedad:\n\n- Nombre_Apellido:\n- Rango al momento del retiro:\n- Tiempo fuera del departamento:\n- Razón del retiro:\n- Razón del reintegro:',
    roles: ['Retired Officer'],
    restrictToRoles: ['Retired Officer'],
  },
  reporte: {
    label: 'Reporte al personal operativo o superior',
    emoji: '⚠️',
    desc: 'Reportar a un oficial por algún problema',
    color: 0xE74C3C,
    title: '⚠️ Reporte al personal operativo o superior',
    content: 'Bienvenido al respectivo apartado para el reporte o negligencia del personal operativo, ya sea de grado superior a ti o si tuviste algún problema con el personal operativo que requiera atención más directa del personal competente. Por favor, rellena el siguiente formato:\n\nNombre_Apellido:\nRango departamental:\nJerarquía y Nombre_Apellido del oficial reportado:\nAlguna prueba contundente de lo hecho:\n\nPor favor evita tags innecesarios y espera pacientemente.',
    roles: [],
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Enviar el panel de atención al canal'),
  async execute(interaction) {
    if (!hasModRole(interaction.member)) {
      return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const panelEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎫 Centro de Soporte')
      .setDescription('Bienvenido al apartado de soporte, por favor, selecciona uno de los siguientes apartados para recibir asistencia en el área correspondiente y espera pacientemente la respuesta del personal encargado para solucionar tus dudas.')
      .setImage('https://i.imgur.com/hazLgQY.gif')
      .setFooter({ text: 'Sistema de Tickets — TXPD' })
      .setTimestamp();

    const select = new StringSelectMenuBuilder()
      .setCustomId('ticket_panel_select')
      .setPlaceholder('Selecciona un departamento...')
      .addOptions(
        Object.entries(SECTIONS).map(([id, s]) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(s.label)
            .setDescription(s.desc)
            .setValue(id)
            .setEmoji(s.emoji)
        )
      );

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.channel.send({
      embeds: [panelEmbed],
      components: [row],
    });

    await interaction.reply({ content: '✅ Panel de atención enviado correctamente.', flags: MessageFlags.Ephemeral });
  },
};

// Export sections for use in index.js
module.exports.SECTIONS = SECTIONS;
