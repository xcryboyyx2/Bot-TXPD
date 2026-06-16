require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, Collection, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { hasModRole, hasSupervisorRole } = require('./utils');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

client.once('clientReady', async () => {
  setInterval(() => {
    try {
      client.user?.setPresence({
        activities: [{ name: 'Texas Police Department - Newgamers 3', type: 3 }],
        status: 'online',
      });
    } catch {}
  }, 120000);
  console.log(`Bot conectado como ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  const commands = client.commands.map(cmd => cmd.data.toJSON());
  const guildId = process.env.GUILD_ID;

  try {
    if (guildId) {
      // Delete global commands to avoid duplicates
      await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
      await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
      console.log(`Comandos registrados en el guild ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      console.log('Comandos slash registrados globalmente');
    }
  } catch (error) {
    console.error('Error registrando comandos:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_panel_select') {
    await handleTicketCreate(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId === 'ticket_close') {
    await handleTicketClose(interaction);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'Hubo un error al ejecutar el comando.', flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: 'Hubo un error al ejecutar el comando.', flags: MessageFlags.Ephemeral });
      }
    } catch {}
  }
});

async function handleTicketCreate(interaction) {
  const { SECTIONS } = require('./commands/ticket');
  const sectionId = interaction.values[0];
  const section = SECTIONS[sectionId];
  if (!section) return;

  const categoryId = process.env.TICKET_CATEGORY_ID;
  if (!categoryId) {
    return interaction.reply({ content: '❌ Sistema de tickets no configurado (TICKET_CATEGORY_ID).', flags: MessageFlags.Ephemeral });
  }

  const category = interaction.guild.channels.cache.get(categoryId);
  if (!category) {
    return interaction.reply({ content: '❌ Categoría de tickets no encontrada.', flags: MessageFlags.Ephemeral });
  }

  if (section.restrictToRoles && section.restrictToRoles.length > 0) {
    const hasRole = interaction.member.roles.cache.some(r => section.restrictToRoles.includes(r.name));
    if (!hasRole) {
      return interaction.reply({ content: '❌ No tienes permisos para crear este tipo de ticket.', flags: MessageFlags.Ephemeral });
    }
  }

  const counterPath = path.join(__dirname, 'data', 'ticket_counter.json');
  let ticketNum = 1;
  try {
    const data = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
    ticketNum = data.count + 1;
  } catch {}

  const channelName = `ticket-${String(ticketNum).padStart(3, '0')}`;

  const overwrites = [
    {
      id: interaction.guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
    {
      id: interaction.guild.members.me.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
  ];

  const GLOBAL_STAFF = ['Police Sergeant I', 'Police Sergeant II', 'Police Lieutenant', 'Police Captain', 'Police Commander'];
  const allRoles = [...new Set([...(section.roles || []), ...GLOBAL_STAFF])];
  const staffMentions = [];
  for (const roleName of allRoles) {
    const role = interaction.guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      overwrites.push({
        id: role.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      });
    }
  }
  // Special Investigation Section can see all tickets except cúpula
  if (sectionId !== 'cupula') {
    const sisRole = interaction.guild.roles.cache.find(r => r.name === 'Special Investigation Section');
    if (sisRole) {
      overwrites.push({
        id: sisRole.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      });
    }
  }

  for (const roleName of (section.roles || [])) {
    const role = interaction.guild.roles.cache.find(r => r.name === roleName);
    if (role) staffMentions.push(`<@&${role.id}>`);
  }

  try {
    const channel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId,
      topic: `${interaction.user.id} | ${sectionId}`,
      permissionOverwrites: overwrites,
    });

    fs.writeFileSync(counterPath, JSON.stringify({ count: ticketNum }));

    const welcomeEmbed = new EmbedBuilder()
      .setColor(section.color)
      .setTitle(`🎫 ${section.title}`)
      .setDescription(section.content)
      .setFooter({ text: 'Presiona 🔒 para cerrar el ticket' })
      .setTimestamp();

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Cerrar Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒'),
    );

    await channel.send({
      content: `${interaction.user} — ${staffMentions.length > 0 ? staffMentions.join(' ') : '@staff'}`,
      embeds: [welcomeEmbed],
      components: [closeRow],
    });

    await interaction.reply({ content: `✅ Ticket creado: ${channel}`, flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error('Error creando ticket:', error);
    await interaction.reply({ content: '❌ Error al crear el ticket.', flags: MessageFlags.Ephemeral });
  }
}

async function handleTicketClose(interaction) {
  const channel = interaction.channel;

  if (!channel.name.startsWith('ticket-')) {
    return interaction.reply({ content: '❌ Esto no es un canal de ticket.', flags: MessageFlags.Ephemeral });
  }

  const topic = channel.topic;
  const creatorId = topic ? topic.split(' | ')[0].trim() : null;
  const sectionId = topic ? topic.split(' | ')[1]?.trim() : null;
  const isCreator = creatorId === interaction.user.id;

  const { SECTIONS } = require('./commands/ticket');
  const sectionRoles = (sectionId && SECTIONS[sectionId]) ? SECTIONS[sectionId].roles : [];
  const GLOBAL_STAFF = ['Police Sergeant I', 'Police Sergeant II', 'Police Lieutenant', 'Police Captain', 'Police Commander'];
  const closeStaffRoles = [...sectionRoles, ...GLOBAL_STAFF];
  if (sectionId !== 'cupula') closeStaffRoles.push('Special Investigation Section');
  const isStaff = interaction.member.roles.cache.some(r => closeStaffRoles.includes(r.name));

  if (!isCreator && !isStaff) {
    return interaction.reply({ content: '❌ No tienes permiso para cerrar este ticket.', flags: MessageFlags.Ephemeral });
  }

  await interaction.reply({ content: '🔒 Generando transcripción y cerrando ticket...' });

  // --- Generate transcript ---
  let transcriptFile = null;
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const allMessages = [...messages.values()].reverse();

    let html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${channel.name} — Transcripción</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background: #2b2d31; color: #dbdee1; padding: 24px; }
  .header { background: #1e1f22; padding: 24px; border-radius: 12px; margin-bottom: 16px; border-left: 4px solid #5865f2; }
  .header h1 { color: #f2f3f5; font-size: 22px; font-weight: 700; }
  .header .meta { color: #949ba4; font-size: 13px; margin-top: 6px; }
  .header .meta span { margin-right: 16px; }
  .msg { display: flex; gap: 12px; padding: 8px 12px; border-radius: 8px; transition: background .1s; }
  .msg:hover { background: #35373c; }
  .msg .avatar { width: 40px; height: 40px; border-radius: 50%; background: #5865f2; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; color: #fff; flex-shrink: 0; margin-top: 4px; }
  .msg .body { flex: 1; min-width: 0; }
  .msg .author { color: #f2f3f5; font-weight: 600; font-size: 14px; }
  .msg .time { color: #949ba4; font-size: 11px; margin-left: 8px; font-weight: 400; }
  .msg .content { color: #dbdee1; font-size: 15px; margin-top: 2px; white-space: pre-wrap; word-break: break-word; line-height: 1.4; }
  .msg .content .empty { color: #949ba4; font-style: italic; }
  .msg .attachment { margin-top: 6px; }
  .msg .attachment a { color: #00a8fc; text-decoration: none; font-size: 14px; background: #1e1f22; padding: 6px 12px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; }
  .msg .attachment a:hover { background: #35373c; }
  .system { text-align: center; color: #949ba4; font-size: 13px; padding: 12px; font-style: italic; }
  .footer { text-align: center; color: #5c5f66; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #3f4148; }
</style>
</head>
<body>
<div class="header">
  <h1>🔒 ${channel.name}</h1>
  <div class="meta">
    <span>📁 Creado por: ${creatorId ? (interaction.guild.members.cache.get(creatorId)?.displayName || 'Desconocido') : 'Desconocido'}</span>
    <span>🔐 Cerrado por: ${interaction.user.displayName}</span>
    <span>💬 Mensajes: ${allMessages.length}</span>
  </div>
</div>`;

    const colors = ['#5865f2', '#ed4245', '#57f287', '#fee75c', '#eb459e', '#00a8fc', '#979c9f'];
    let colorIdx = {};
    let colorCount = 0;

    for (const msg of allMessages) {
      const time = new Date(msg.createdTimestamp).toLocaleString('es-ES', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'medium' });

      if (!colorIdx[msg.author.id]) {
        colorIdx[msg.author.id] = colors[colorCount % colors.length];
        colorCount++;
      }

      const avatarColor = colorIdx[msg.author.id];
      const initials = msg.author.displayName.charAt(0).toUpperCase() || '?';
      const content = msg.content || null;
      const attachments = msg.attachments.map(a => `<div class="attachment"><a href="${a.url}" target="_blank">📎 ${a.name}</a></div>`).join('');

      html += `<div class="msg">
  <div class="avatar" style="background:${avatarColor}">${initials}</div>
  <div class="body">
    <span class="author">${escapeHtml(msg.author.displayName)}</span><span class="time">${time} UTC</span>
    <div class="content">${content ? escapeHtml(content) : '<span class="empty">(sin texto)</span>'}</div>
    ${attachments}
  </div>
</div>`;
    }

    html += `<div class="footer">Generado por Texas Police Department Bot — ${new Date().toLocaleString('es-ES', { timeZone: 'UTC' })} UTC</div></body></html>`;

    transcriptFile = new AttachmentBuilder(Buffer.from(html), { name: `${channel.name}-transcript.html` });
  } catch (e) {
    console.error('Error generando transcripción:', e);
  }

  // --- Send log ---
  const logChannelId = process.env.TICKET_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID;
  if (logChannelId) {
    const logChannel = interaction.guild.channels.cache.get(logChannelId);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🔒 Ticket Cerrado')
        .addFields(
          { name: 'Canal', value: `#${channel.name}`, inline: true },
          { name: 'Creado por', value: creatorId ? `<@${creatorId}>` : 'Desconocido', inline: true },
          { name: 'Cerrado por', value: interaction.user.tag, inline: true },
        )
        .setTimestamp();

      const files = transcriptFile ? [transcriptFile] : undefined;
      await logChannel.send({ embeds: [logEmbed], files }).catch(() => {});
    }
  }

  setTimeout(() => channel.delete().catch(() => {}), 3000);
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function silentReply(msg, content) {
  await msg.delete().catch(() => {});
  const sent = await msg.channel.send(content);
  setTimeout(() => sent.delete().catch(() => {}), 4000);
}

function hasTicketStaffRole(member, channel) {
  const topic = channel.topic;
  const sectionId = topic ? topic.split(' | ')[1]?.trim() : null;
  const { SECTIONS } = require('./commands/ticket');
  const sectionRoles = (sectionId && SECTIONS[sectionId]) ? SECTIONS[sectionId].roles : [];
  const GLOBAL_STAFF = ['Police Sergeant I', 'Police Sergeant II', 'Police Lieutenant', 'Police Captain', 'Police Commander'];
  const staffRoles = [...sectionRoles, ...GLOBAL_STAFF];
  if (sectionId !== 'cupula') staffRoles.push('Special Investigation Section');
  return member.roles.cache.some(r => staffRoles.includes(r.name));
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const prefix = message.content[0];
  const args = message.content.slice(1).trim().split(/\s+/);
  const cmd = args[0]?.toLowerCase();

  // --- Informative commands (-prefix) ---
  if (prefix === '-') {
    if (cmd === 'reportar' || cmd === 'report' || cmd === 'reporte') {
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('📋 Reportar un Oficial')
        .setDescription('Si deseas reportar a un oficial por cualquier falta o algo que haya hecho mal, puedes dirigirte al discord de [**Atención Faccionaria**](https://discord.gg/j9WetMuJTe)')
        .setImage('https://i.imgur.com/tp2rHG4.jpeg')
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
      return;
    }

    if (cmd === 'postulaciones' || cmd === 'postular' || cmd === 'aplicar') {
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('📋 Postulaciones')
        .setDescription(`Puedes ver el estatus de las postulaciones en el canal de <#1103779684862410772>, ahí verás información valiosa e importante respecto al Texas Police Department, ¡espero sigas con el mismo interés al querer unirte a nuestras filas, te esperamos!`)
        .setImage('https://i.imgur.com/I6KP3q7.jpeg')
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
      return;
    }

    // --- Mod commands (-prefix) ---
    if (cmd === 'mute') {
      const target = message.mentions.members.first();
      if (!target) return message.channel.send('❌ Debes mencionar a un usuario. Uso: `-mute @usuario minutos [razón]`').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      if (!hasModRole(message.member) && !hasSupervisorRole(message.member)) return message.channel.send('❌ No tienes permiso para usar este comando.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      if (!target.moderatable) return message.channel.send('❌ No puedo silenciar a ese usuario.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

      const minutes = parseInt(args[1]);
      if (isNaN(minutes) || minutes < 1) return message.channel.send('❌ Especifica una duración válida en minutos.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

      await message.delete().catch(() => {});
      const reason = args.slice(2).join(' ') || 'No especificada';
      await target.timeout(minutes * 60 * 1000, reason);

      const embed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle('🔇 Usuario Silenciado')
        .addFields(
          { name: 'Usuario', value: `${target.displayName} (${target.id})`, inline: true },
          { name: 'Duración', value: `${minutes} minuto(s)`, inline: true },
          { name: 'Moderador', value: message.member.displayName, inline: true },
          { name: 'Razón', value: reason, inline: false },
        )
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
      return;
    }

    if (cmd === 'kick' || cmd === 'ban') {
      const isBan = cmd === 'ban';
      const target = message.mentions.members.first();
      if (!target) return message.channel.send(`❌ Debes mencionar a un usuario. Uso: \`-${cmd} @usuario [razón]\``).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

      if (isBan) {
        if (!hasModRole(message.member)) return message.channel.send('❌ No tienes permiso para usar este comando.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      } else {
        if (!hasModRole(message.member) && !hasSupervisorRole(message.member)) return message.channel.send('❌ No tienes permiso para usar este comando.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      }

      if (isBan && !target.bannable) return message.channel.send('❌ No puedo banear a ese usuario.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      if (!isBan && !target.kickable) return message.channel.send('❌ No puedo expulsar a ese usuario.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

      await message.delete().catch(() => {});
      const reason = args.slice(2).join(' ') || 'No especificada';

      const confirmEmbed = new EmbedBuilder()
        .setColor(isBan ? 0xFF0000 : 0xFFA500)
        .setTitle(isBan ? '🔨 Confirmar Baneo' : '👢 Confirmar Expulsión')
        .setDescription(`**Usuario:** ${target.displayName} (${target.id})\n**Moderador:** ${message.member.displayName}\n**Razón:** ${reason}`)
        .setFooter({ text: '¿Estás seguro?' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_yes').setLabel('✅ Confirmar').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('confirm_no').setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary),
      );

      const confirmMsg = await message.channel.send({ embeds: [confirmEmbed], components: [row] });

      try {
        const response = await confirmMsg.awaitMessageComponent({
          filter: i => i.user.id === message.author.id,
          time: 30000,
        });

        if (response.customId === 'confirm_no') {
          await response.update({ embeds: [EmbedBuilder.from(confirmEmbed).setDescription('❌ Acción cancelada.').setFooter(null)], components: [] });
          return;
        }

        if (isBan) {
          await target.ban({ reason });

          const logEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🔨 Usuario Baneado')
            .addFields(
              { name: 'Usuario', value: `${target.displayName} (${target.id})`, inline: true },
              { name: 'Moderador', value: message.member.displayName, inline: true },
              { name: 'Razón', value: reason, inline: false },
            )
            .setTimestamp();

          const logChannelId = process.env.MOD_LOG_CHANNEL_ID;
          if (logChannelId) {
            const logChannel = message.guild.channels.cache.get(logChannelId);
            if (logChannel) logChannel.send({ embeds: [logEmbed] }).catch(() => {});
          }
        } else {
          await target.kick(reason);
        }

        const resultEmbed = new EmbedBuilder()
          .setColor(isBan ? 0xFF0000 : 0xFFA500)
          .setTitle(isBan ? '🔨 Usuario Baneado' : '👢 Usuario Expulsado')
          .addFields(
            { name: 'Usuario', value: `${target.displayName} (${target.id})`, inline: true },
            { name: 'Moderador', value: message.member.displayName, inline: true },
            { name: 'Razón', value: reason, inline: false },
          )
          .setTimestamp();

        await response.update({ embeds: [resultEmbed], components: [] });
      } catch {
        await confirmMsg.edit({ embeds: [EmbedBuilder.from(confirmEmbed).setDescription('⏰ Tiempo de espera agotado.').setFooter(null)], components: [] });
      }
      return;
    }

    if (cmd === 'unmute') {
      const target = message.mentions.members.first();
      if (!target) return message.channel.send('❌ Debes mencionar a un usuario. Uso: `-unmute @usuario`').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      if (!hasModRole(message.member) && !hasSupervisorRole(message.member)) return message.channel.send('❌ No tienes permiso para usar este comando.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      if (!target.moderatable) return message.channel.send('❌ No puedo quitar el silencio a ese usuario.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

      await message.delete().catch(() => {});
      await target.timeout(null);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🔊 Silencio Removido')
        .addFields(
          { name: 'Usuario', value: `${target.displayName} (${target.id})`, inline: true },
          { name: 'Moderador', value: message.member.displayName, inline: true },
        )
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
      return;
    }

    if (cmd === 'unban') {
      if (!hasModRole(message.member)) return message.channel.send('❌ No tienes permiso para usar este comando.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

      const userId = args[1]?.replace(/\D/g, '');
      if (!userId || userId.length < 10) return message.channel.send('❌ Debes proporcionar el ID del usuario. Uso: `-unban ID_usuario [razón]`').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

      await message.delete().catch(() => {});
      const reason = args.slice(2).join(' ') || 'No especificada';

      const confirmEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('⛔ Confirmar Desbaneo')
        .setDescription(`**ID:** ${userId}\n**Moderador:** ${message.member.displayName}\n**Razón:** ${reason}`)
        .setFooter({ text: '¿Estás seguro?' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('unban_yes').setLabel('✅ Confirmar').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('unban_no').setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary),
      );

      const confirmMsg = await message.channel.send({ embeds: [confirmEmbed], components: [row] });

      try {
        const response = await confirmMsg.awaitMessageComponent({
          filter: i => i.user.id === message.author.id,
          time: 30000,
        });

        if (response.customId === 'unban_no') {
          await response.update({ embeds: [EmbedBuilder.from(confirmEmbed).setDescription('❌ Acción cancelada.').setFooter(null)], components: [] });
          return;
        }

        const unbanned = await message.guild.members.unban(userId, reason);

        const logEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('⛔ Usuario Desbaneado')
          .addFields(
            { name: 'Usuario', value: unbanned ? `${unbanned.tag} (${userId})` : userId, inline: true },
            { name: 'Moderador', value: message.member.displayName, inline: true },
            { name: 'Razón', value: reason, inline: false },
          )
          .setTimestamp();

        const logChannelId = process.env.MOD_LOG_CHANNEL_ID;
        if (logChannelId) {
          const logChannel = message.guild.channels.cache.get(logChannelId);
          if (logChannel) logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }

        const resultEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('⛔ Usuario Desbaneado')
          .addFields(
            { name: 'ID', value: userId, inline: true },
            { name: 'Moderador', value: message.member.displayName, inline: true },
            { name: 'Razón', value: reason, inline: false },
          )
          .setTimestamp();

        await response.update({ embeds: [resultEmbed], components: [] });
      } catch {
        await confirmMsg.edit({ embeds: [EmbedBuilder.from(confirmEmbed).setDescription('⏰ Tiempo de espera agotado.').setFooter(null)], components: [] });
      }
      return;
    }

    return;
  }

  // --- Ticket commands ($-prefix, only in ticket channels) ---
  if (prefix !== '$') return;
  if (!message.channel.name?.startsWith('ticket-')) return;
  const channel = message.channel;
  const topic = channel.topic;
  const creatorId = topic ? topic.split(' | ')[0].trim() : null;
  const isCreator = creatorId === message.author.id;

  if (cmd === 'add') {
    if (!hasTicketStaffRole(message.member, channel)) {
      return silentReply(message, '❌ Solo el staff autorizado puede añadir usuarios.');
    }
    let target = message.mentions.members.first();
    if (!target) {
      const id = args[1]?.replace(/\D/g, '');
      if (id && id.length > 10) target = await message.guild.members.fetch(id).catch(() => null);
    }
    if (!target) {
      const name = args.slice(1).join(' ').toLowerCase();
      target = message.guild.members.cache.find(m =>
        m.displayName.toLowerCase() === name ||
        m.user.username.toLowerCase() === name
      ) || message.guild.members.cache.find(m =>
        m.displayName.toLowerCase().includes(name) ||
        m.user.username.toLowerCase().includes(name)
      );
    }
    if (!target && args[1]) {
      try {
        const fetched = await message.guild.members.fetch();
        const name = args.slice(1).join(' ').toLowerCase();
        target = fetched.find(m =>
          m.displayName.toLowerCase() === name ||
          m.user.username.toLowerCase() === name
        ) || fetched.find(m =>
          m.displayName.toLowerCase().includes(name) ||
          m.user.username.toLowerCase().includes(name)
        );
      } catch {}
    }
    if (!target) return silentReply(message, '❌ Usuario no encontrado. Usa: `$add @usuario`, `$add ID` o `$add nombre`');

    await channel.permissionOverwrites.edit(target.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    }).catch(() => channel.permissionOverwrites.create(target.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    }));
    await silentReply(message, `✅ ${target} ha sido añadido al ticket.`);
    return;
  }

  if (cmd === 'kick') {
    if (!hasTicketStaffRole(message.member, channel)) {
      return silentReply(message, '❌ Solo el staff autorizado puede expulsar usuarios.');
    }
    let target = message.mentions.members.first();
    if (!target) {
      const id = args[1]?.replace(/\D/g, '');
      if (id && id.length > 10) target = await message.guild.members.fetch(id).catch(() => null);
    }
    if (!target) {
      const name = args.slice(1).join(' ').toLowerCase();
      target = message.guild.members.cache.find(m =>
        m.displayName.toLowerCase() === name ||
        m.user.username.toLowerCase() === name
      ) || message.guild.members.cache.find(m =>
        m.displayName.toLowerCase().includes(name) ||
        m.user.username.toLowerCase().includes(name)
      );
    }
    if (!target && args[1]) {
      try {
        const fetched = await message.guild.members.fetch();
        const name = args.slice(1).join(' ').toLowerCase();
        target = fetched.find(m =>
          m.displayName.toLowerCase() === name ||
          m.user.username.toLowerCase() === name
        ) || fetched.find(m =>
          m.displayName.toLowerCase().includes(name) ||
          m.user.username.toLowerCase().includes(name)
        );
      } catch {}
    }
    if (!target) return silentReply(message, '❌ Usuario no encontrado. Usa: `$kick @usuario`, `$kick ID` o `$kick nombre`');

    if (target.id === message.guild.members.me.id) return silentReply(message, '❌ No puedes expulsar al bot.');
    if (hasTicketStaffRole(target, channel)) return silentReply(message, '❌ No puedes expulsar a esta persona.');

    await channel.permissionOverwrites.delete(target.id);
    await silentReply(message, `✅ ${target.user.tag} ha sido expulsado del ticket.`);
    return;
  }

  if (cmd === 'close') {
    await message.delete().catch(() => {});
    const fakeInteraction = {
      channel: message.channel,
      user: message.author,
      member: message.member,
      guild: message.guild,
      reply: (opts) => message.channel.send(typeof opts === 'string' ? opts : opts.content || ''),
    };
    const channel = message.channel;
    const topic = channel.topic;
    const creatorId = topic ? topic.split(' | ')[0].trim() : null;
    const sectionId = topic ? topic.split(' | ')[1]?.trim() : null;
    const isCreator = creatorId === message.author.id;
    const { SECTIONS } = require('./commands/ticket');
    const sectionRoles = (sectionId && SECTIONS[sectionId]) ? SECTIONS[sectionId].roles : [];
    const GLOBAL_STAFF = ['Police Sergeant I', 'Police Sergeant II', 'Police Lieutenant', 'Police Captain', 'Police Commander'];
    const closeStaffRoles2 = [...sectionRoles, ...GLOBAL_STAFF];
    if (sectionId !== 'cupula') closeStaffRoles2.push('Special Investigation Section');
    const isStaff = message.member.roles.cache.some(r => closeStaffRoles2.includes(r.name));
    if (!isCreator && !isStaff) return message.channel.send('❌ No tienes permiso para cerrar este ticket.').then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
    await handleTicketClose(fakeInteraction);
    return;
  }

  if (cmd === 'rename') {
    if (!hasTicketStaffRole(message.member, channel)) {
      return silentReply(message, '❌ Solo el staff autorizado puede renombrar el ticket.');
    }
    const newName = args.slice(1).join('-').replace(/[^a-z0-9-]/gi, '').toLowerCase();
    if (!newName) return silentReply(message, '❌ Uso: `$rename nombre-del-ticket`');
    await channel.setName(`ticket-${newName}`);
    await silentReply(message, `✅ Ticket renombrado a \`ticket-${newName}\``);
    return;
  }
});

process.on('unhandledRejection', error => {
  if (error?.code === 10062) return;
  console.error('Unhandled rejection:', error);
});

const token = process.env.TOKEN;
if (!token) {
  console.error('Error: TOKEN no definido. Crea un archivo .env con TOKEN=tu_token');
  process.exit(1);
}
client.login(token);
