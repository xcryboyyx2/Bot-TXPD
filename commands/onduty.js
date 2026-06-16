const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { readJSON, hasOfficerRole } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('onduty')
    .setDescription('Ver oficiales actualmente en servicio'),
  async execute(interaction) {
    if (!hasOfficerRole(interaction.member)) {
      return interaction.reply({ content: '❌ Solo los oficiales pueden usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const activePatrols = readJSON(path.join(__dirname, '..', 'data', 'patrols.json')) || {};
    const userIds = Object.keys(activePatrols);

    if (userIds.length === 0) {
      return interaction.reply({ content: '🚔 No hay oficiales en servicio en este momento.', flags: MessageFlags.Ephemeral });
    }

    const list = (await Promise.all(userIds.map(async id => {
      let member = interaction.guild.members.cache.get(id);
      if (!member) {
        try { member = await interaction.guild.members.fetch(id); } catch {}
      }
      const name = member ? member.displayName : id;
      return `**${name}** — En servicio 🟢`;
    }))).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('🚔 Oficiales en Servicio')
      .setDescription(list)
      .setFooter({ text: `Total: ${userIds.length} oficial(es)` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
