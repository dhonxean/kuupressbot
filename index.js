import 'dotenv/config'
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js'
import fetch from 'node-fetch'

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
})

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`)
})

async function fetchLeaderboard(page = 1) {
    const base = process.env.KUUPRESS_API_BASE
    if (!base) throw new Error('KUUPRESS_API_BASE is not set')

    const url = `${base.replace(/\/+$/, '')}/api/public/leaderboard?page=${page}`
    const res = await fetch(url)

    if (!res.ok) {
        throw new Error(`Leaderboard API error: ${res.status} ${res.statusText}`)
    }

    return res.json()
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return
    if (interaction.commandName !== 'rank') return

    await interaction.deferReply({ ephemeral: true })

    try {
        const { data, meta } = await fetchLeaderboard(1)
        const top = (data || []).slice(0, 10)

        if (!top.length) {
            await interaction.editReply('No leaderboard data yet. 📉')
            return
        }

        const lines = top.map((u) => {
            const rank = u.rank ?? null
            const medal =
                rank === 1 ? '🥇' :
                    rank === 2 ? '🥈' :
                        rank === 3 ? '🥉' :
                            `#${rank ?? '?'}`

            const displayName = u.name || u.username || 'Unknown'
            const level = u.level ?? 1
            const xp = (u.total_xp ?? 0).toLocaleString()

            return `${medal} **${displayName}** (Lv ${level}) — ${xp} XP`
        })

        const embed = new EmbedBuilder()
            .setTitle('🏆 Kuupress Leaderboard')
            .setDescription(lines.join('\n'))
            .setFooter({
                text: `Page ${meta?.current_page ?? 1} of ${meta?.last_page ?? 1}`,
            })
            .setTimestamp()

        await interaction.editReply({ embeds: [embed] })
    } catch (err) {
        console.error(err)
        await interaction.editReply('Failed to fetch leaderboard from Kuupress. 😢')
    }
})

client.login(process.env.DISCORD_TOKEN)
