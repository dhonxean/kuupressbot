import { REST, Routes, SlashCommandBuilder } from 'discord.js'
import dotenv from 'dotenv'

dotenv.config()

if (!process.env.CLIENT_ID || !process.env.GUILD_ID || !process.env.DISCORD_TOKEN) {
    console.error('❌ Missing CLIENT_ID, GUILD_ID or DISCORD_TOKEN in .env')
    console.error('CLIENT_ID:', process.env.CLIENT_ID)
    console.error('GUILD_ID:', process.env.GUILD_ID)
    process.exit(1)
}

const commands = [
    new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Show the Kuupress leaderboard'),

    new SlashCommandBuilder()
        .setName('user')
        .setDescription('View a Kuupress user profile')
        .addStringOption(option =>
            option
                .setName('username')
                .setDescription('Kuupress username')
                .setRequired(true),
        ),
].map(cmd => cmd.toJSON())

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN)

async function deploy() {
    try {
        console.log('Refreshing application (/) commands...')
        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID, // your bot's application ID
                process.env.GUILD_ID,  // the server ID
            ),
            { body: commands },
        )
        console.log('✅ Successfully registered slash commands.')
    } catch (error) {
        console.error(error)
    }
}

deploy()
