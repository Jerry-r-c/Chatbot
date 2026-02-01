const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const puter = require('@heyputer/puter.js');
const express = require('express');

// 1. Setup Express (Needed for Render to stay alive)
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('AI Bot is running 24/7!');
});

app.listen(port, () => {
  console.log(`Web server is listening on port ${port}`);
});

// 2. Setup Discord Bot
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

  // .msg Command (AI Chat)
  if (command === 'msg') {
    const prompt = args.join(' ');
    if (!prompt) return message.reply("Please provide a message!");

    try {
      const response = await puter.ai.chat(prompt, {
        model: 'gemini-3-flash-preview'
      });
      message.reply(response.toString());
    } catch (err) {
      console.error(err);
      message.reply("Error talking to AI.");
    }
  }

  // .pgen Command (Photo Gen)
  if (command === 'pgen') {
    const prompt = args.join(' ');
    if (!prompt) return message.reply("Describe the photo you want!");

    const waitingMsg = await message.channel.send("🎨 Generating your image... please wait.");

    try {
      // Puter returns the image data
      const imageResponse = await puter.ai.txt2img(prompt, { 
        model: "gemini-3-pro-image-preview" 
      });

      // Send the image to Discord
      const attachment = new AttachmentBuilder(imageResponse, { name: 'generated.png' });
      await message.reply({ files: [attachment] });
      waitingMsg.delete();
    } catch (err) {
      console.error(err);
      message.reply("Failed to generate image.");
    }
  }
});

// Log in using the Environment Variable from Render
client.login(process.env.DISCORD_TOKEN);
