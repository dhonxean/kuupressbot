import { REST, Routes, SlashCommandBuilder } from 'discord.js'
import dotenv from 'dotenv'

dotenv.config()

const {
    DISCORD_CLIENT_ID,
    DISCORD_TOKEN,
    DISCORD_GUILD_ID_MAIN,
    DISCORD_GUILD_ID_SECOND,
} = process.env

if (!DISCORD_CLIENT_ID || !DISCORD_TOKEN) {
    console.error('❌ Missing DISCORD_CLIENT_ID or DISCORD_TOKEN in .env')
    process.exit(1)
}

const guildIds = [DISCORD_GUILD_ID_MAIN, DISCORD_GUILD_ID_SECOND].filter(Boolean)

if (guildIds.length === 0) {
    console.error('❌ No guild IDs set (DISCORD_GUILD_ID_MAIN / DISCORD_GUILD_ID_SECOND).')
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

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN)

async function deploy() {
    try {
        console.log('Refreshing application (/) commands for guilds:', guildIds.join(', '))

        for (const gid of guildIds) {
            console.log(`→ Updating commands for guild ${gid}...`)
            await rest.put(
                Routes.applicationGuildCommands(DISCORD_CLIENT_ID, gid),
                { body: commands },
            )
        }

        console.log('✅ Successfully registered slash commands for all configured guilds.')
    } catch (error) {
        console.error('❌ Error registering commands:', error)
    }
}

deploy()
