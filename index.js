const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const axios = require('axios');

const app = express();
app.get('/', (req, res) => res.send('Gemini 3 / 2.5 Flash Bot is Online!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// The newest 2026 models from OpenRouter
const AI_MODELS = [
  { name: 'Gemini 3 Flash (Latest)', id: 'google/gemini-3-flash-preview:free' },
  { name: 'Gemini 2.5 Flash', id: 'google/gemini-2.5-flash:free' },
  { name: 'Claude 3.5 Sonnet', id: 'anthropic/claude-3.5-sonnet:free' }
];

let currentModelIndex = 0;

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith('.')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // --- .models ---
  if (command === 'models') {
    const list = AI_MODELS.map((m, i) => `${i === currentModelIndex ? '✅' : `[${i+1}]`} **${m.name}**`).join('\n');
    return message.reply({ 
        embeds: [new EmbedBuilder().setTitle("Select AI Model").setDescription(list).setColor('#0099ff')] 
    });
  }

  // --- .change ---
  if (command === 'change') {
    const choice = parseInt(args[0]) - 1;
    if (AI_MODELS[choice]) {
      currentModelIndex = choice;
      return message.reply(`🚀 Now using: **${AI_MODELS[currentModelIndex].name}**`);
    }
    return message.reply("Invalid number! Use `.models` to see the list.");
  }

  // --- .msg ---
  if (command === 'msg') {
    const prompt = args.join(' ');
    if (!prompt) return message.reply("Ask something!");

    try {
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: AI_MODELS[currentModelIndex].id,
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
          "Content-Type": "application/json"
        }
      });

      const reply = response.data.choices[0].message.content;
      message.reply(`**[${AI_MODELS[currentModelIndex].name}]**: ${reply.substring(0, 1900)}`);
    } catch (err) {
      message.reply("⚠️ Model is currently unavailable. Try switching with `.change`!");
    }
  }

  // --- .pgen (2026 Stable Image Gen) ---
  if (command === 'pgen') {
    const prompt = args.join(' ');
    if (!prompt) return message.reply("What should I draw?");

    const seed = Math.floor(Math.random() * 1e9);
    // Using the Flux model for highest 2026 quality
    const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true&t=${Date.now()}`;

    const embed = new EmbedBuilder()
      .setTitle("🎨 Image Result")
      .setImage(imageUrl)
      .setColor('#00ff00')
      .setURL(imageUrl)
      .setFooter({ text: 'Model: Flux-Art • Tap title if blank' });

    message.reply({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
