const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

// --- 1. SETTINGS ---
const OWNER_ID = '971750822511775824'; // <--- CHANGE THIS TO YOUR ID
const PORT = process.env.PORT || 3000;

// Render Keep-Alive
const app = express();
app.get('/', (req, res) => res.send('Flash Bot 2026 is Online! 🔋'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// --- 2. DATABASE SETUP ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas! ✅'))
  .catch(err => console.error('MongoDB Error:', err));

const userSchema = new mongoose.Schema({
  userId: String,
  credits: { type: Number, default: 0 },
  selectedModel: { type: String, default: 'gemini-2.0-flash' },
  history: { type: Array, default: [] } 
});
const User = mongoose.model('User', userSchema);

// --- 3. AI CONFIG ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODELS = {
  'gemini-2.5-flash': { name: 'Free', premium: false, id: 'gemini-2.5-flash' },
  'gemini-1.5-pro': { name: 'Premium, premium: true, id: 'gemini-1.5-pro' }
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith('.')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  let userData = await User.findOne({ userId: message.author.id });
  if (!userData) userData = await User.create({ userId: message.author.id });

  // --- COMMAND: .help ---
  if (command === 'help') {
    const embed = new EmbedBuilder()
      .setTitle("Bot commands")
      .addFields(
        { name: '.msg <text>', value: 'Chat with AI' },
        { name: '.pgen <prompt>', value: 'Generate Images (2 Credits)' },
        { name: '.models', value: 'Check model list' },
        { name: '.change <num>', value: 'Switch models' },
        { name: '.bal', value: 'Check your credits' },
        { name: '.resetmemory', value: 'Wipe your AI chat history' }
      )
      .setColor('#00FFCC');
    return message.reply({ embeds: [embed] });
  }

  // --- COMMAND: .give (Owner Only) ---
  if (command === 'give') {
    if (message.author.id !== OWNER_ID) return message.reply("❌ Only the Owner can give credits.");
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount)) return message.reply("Use: `.give @user 10`.");

    let targetData = await User.findOne({ userId: target.id });
    if (!targetData) targetData = await User.create({ userId: target.id });
    
    targetData.credits += amount;
    await targetData.save();
    return message.reply(`✅ Gave **${amount}** credits to ${target.username}.`);
  }

  // --- COMMAND: .bal ---
  if (command === 'bal') return message.reply(`💰 Balance: **${userData.credits}** credits.`);

  // --- COMMAND: .models & .change ---
  if (command === 'models') {
    const list = Object.entries(MODELS).map(([id, m], i) => 
      `${userData.selectedModel === id ? '✅' : `[${i+1}]`} **${m.name}** ${m.premium ? '💎 (1 Cred)' : '🆓'}`
    ).join('\n');
    return message.reply({ embeds: [new EmbedBuilder().setTitle("Models").setDescription(list).setColor('#4285F4')] });
  }

  if (command === 'change') {
    const index = parseInt(args[0]) - 1;
    const keys = Object.keys(MODELS);
    const selectedKey = keys[index];

    if (!selectedKey) return message.reply("❌ Use `.models` to see numbers.");
    if (MODELS[selectedKey].premium && userData.credits < 1) return message.reply("❌ You need credits for Premium!");

    userData.selectedModel = selectedKey;
    await userData.save();
    return message.reply(`🔄 Model set to **${MODELS[selectedKey].name}**.`);
  }

  // --- COMMAND: .resetmemory ---
  if (command === 'resetmemory') {
    userData.history = [];
    await userData.save();
    return message.reply("🧹 **Memory Wiped!** I've forgotten our previous chats.");
  }

  // --- COMMAND: .msg ---
  if (command === 'msg') {
    const prompt = args.join(' ');
    if (!prompt) return message.reply("Type something!");

    const modelInfo = MODELS[userData.selectedModel];
    if (modelInfo.premium && userData.credits < 1) {
      return message.reply("❌ You do not have credits! Use `.change 1` for free mode.");
    }

    await message.channel.sendTyping();
    try {
      const model = genAI.getGenerativeModel({ model: modelInfo.id });
      const chat = model.startChat({ history: userData.history.slice(-10) }); 
      const result = await chat.sendMessage(prompt);
      const text = (await result.response).text();

      userData.history.push({ role: 'user', parts: [{ text: prompt }] });
      userData.history.push({ role: 'model', parts: [{ text: text }] });
      if (modelInfo.premium) userData.credits -= 1;
      
      await userData.save();
      message.reply(`**[${modelInfo.name}]**: ${text.substring(0, 1900)}`);
    } catch (err) {
      message.reply("⚠️ AI error. Check credits or safety filters.");
    }
  }

  // --- COMMAND: .pgen (Imagen 3) ---
  if (command === 'pgen') {
    const prompt = args.join(' ');
    if (!prompt) return message.reply("What to draw?");
    if (userData.credits < 2) return message.reply("❌ Needs **1 credits**.");

    await message.channel.sendTyping();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${process.env.GEMINI_API_KEY}`;
      const res = await axios.post(url, {
        instances: [{ prompt: prompt }],
        parameters: { aspectRatio: "1:1" }
      });

      const buffer = Buffer.from(res.data.predictions[0].bytesBase64Encoded, 'base64');
      const file = new AttachmentBuilder(buffer, { name: 'image.png' });

      userData.credits -= 1;
      await userData.save();
      message.reply({ content: `🎨 **Imagen 3 Output**`, files: [file] });
    } catch (err) {
      message.reply("⚠️ Image failed.");
    }
  }
});

client.on('ready', () => console.log(`${client.user.tag} Ready!`));
client.login(process.env.DISCORD_TOKEN);
