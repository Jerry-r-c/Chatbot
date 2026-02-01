const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const axios = require('axios');

const app = express();
app.get('/', (req, res) => res.send('AI Bot is Live!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// Your Model Options
const AI_MODELS = [
  { name: 'Mistral', path: 'mistralai/Mistral-7B-Instruct-v0.2' },
  { name: 'Gemma', path: 'google/gemma-1.1-7b-it' },
  { name: 'Zephyr', path: 'HuggingFaceH4/zephyr-7b-beta' }
];

let currentModelIndex = 0; // Default is Mistral

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith('.')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // --- .models Command ---
  if (command === 'models') {
    const list = AI_MODELS.map((m, i) => `${i === currentModelIndex ? '✅' : `[${i+1}]`} **${m.name}**`).join('\n');
    const embed = new EmbedBuilder()
      .setTitle("🤖 Model Selection")
      .setDescription(`Current: **${AI_MODELS[currentModelIndex].name}**\n\n${list}\n\nType \`.change [number]\` to switch!`)
      .setColor('#5865F2');
    return message.reply({ embeds: [embed] });
  }

  // --- .change Command ---
  if (command === 'change') {
    const choice = parseInt(args[0]) - 1;
    if (AI_MODELS[choice]) {
      currentModelIndex = choice;
      return message.reply(`✅ Switched to **${AI_MODELS[currentModelIndex].name}**`);
    }
    return message.reply("Invalid number! Use `.models` to see the list.");
  }

  // --- .msg Command ---
  if (command === 'msg') {
    const prompt = args.join(' ');
    if (!prompt) return message.reply("Ask something!");

    try {
      const res = await axios.post(
        `https://api-inference.huggingface.co/models/${AI_MODELS[currentModelIndex].path}`,
        { inputs: prompt },
        { headers: { "Content-Type": "application/json" }, timeout: 10000 }
      );
      const reply = res.data[0].generated_text.replace(prompt, "").trim();
      message.reply(`**[${AI_MODELS[currentModelIndex].name}]**: ${reply || "I have no words..."}`);
    } catch (err) {
      message.reply(`❌ **${AI_MODELS[currentModelIndex].name}** is busy! Use \`.change\` to try another.`);
    }
  }

  // --- .pgen Command (Direct Link Fix) ---
  if (command === 'pgen') {
    const prompt = args.join(' ');
    if (!prompt) return message.reply("Describe the image!");

    const seed = Math.floor(Math.random() * 100000);
    // Pollinations with 'flux' model for high quality
    const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;

    const embed = new EmbedBuilder()
      .setTitle("🎨 Image Result")
      .setDescription(`**Prompt:** ${prompt}`)
      .setImage(imageUrl) // This makes it show up in Discord!
      .setColor('#00ff00')
      .setFooter({ text: 'Generated via Flux/Pollinations' });

    message.reply({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
