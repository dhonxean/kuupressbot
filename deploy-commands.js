import { REST, Routes, SlashCommandBuilder } from 'discord.js'
import dotenv from 'dotenv'

dotenv.config()

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
