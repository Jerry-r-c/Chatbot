const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const express = require('express');
const axios = require('axios');

// 1. Keep-Alive Server for Render
const app = express();
app.get('/', (req, res) => res.send('Llama-3 & Pgen Bot is Live!'));
app.listen(process.env.PORT || 3000);

// 2. Discord Bot Setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const PREFIX = '.';

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // --- Llama-3 AI Chat (.msg) ---
  if (command === 'msg') {
    const prompt = args.join(' ');
    if (!prompt) return message.reply("Ask Llama-3 something!");

    try {
      // Free Llama-3-8B Inference
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct',
        { inputs: prompt },
        { headers: { "Content-Type": "application/json" } }
      );

      let botReply = response.data[0].generated_text || "I'm thinking...";
      
      // Clean up output (HuggingFace often includes the prompt in the reply)
      const cleanReply = botReply.replace(prompt, "").trim();
      
      if (cleanReply.length > 2000) {
        message.reply(cleanReply.substring(0, 1900) + "...");
      } else {
        message.reply(cleanReply || "I'm not sure how to answer that.");
      }
    } catch (err) {
      console.error(err);
      message.reply("Llama-3 is a bit busy. Try again in a few seconds!");
    }
  }

  // --- Image Generation (.pgen) ---
  if (command === 'pgen') {
    const prompt = args.join(' ');
    if (!prompt) return message.reply("Describe what you want to see!");

    try {
      const waiting = await message.reply("🎨 Generating your image... please wait.");
      
      // Use a random seed to ensure a unique image every time
      const seed = Math.floor(Math.random() * 99999);
      const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}`;
      
      const attachment = new AttachmentBuilder(imageUrl, { name: 'ai_image.png' });
      await message.reply({ files: [attachment] });
      waiting.delete();
    } catch (err) {
      console.error(err);
      message.reply("Failed to generate that image.");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
