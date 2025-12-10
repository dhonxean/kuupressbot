// deploy-commands.js
import 'dotenv/config'
import { REST, Routes, SlashCommandBuilder } from 'discord.js'

const commands = [
    new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Show the Kuupress leaderboard.')
        .toJSON(),
]

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN)

async function main() {
    try {
        console.log('Refreshing application (/) commands...')

        // 🔹 Guild command = instant in one server (good for dev)
        await rest.put(
            Routes.applicationGuildCommands(
                process.env.DISCORD_CLIENT_ID,
                process.env.DISCORD_GUILD_ID,
            ),
            { body: commands },
        )

        console.log('Successfully registered /rank command.')
    } catch (error) {
        console.error(error)
    }
}

main()
