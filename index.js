// index.js (beautified leaderboard)
require('dotenv').config()
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js')
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args))

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
})

// Fix deprecation: use clientReady instead of ready
client.once('clientReady', (c) => {
    console.log(`Logged in as ${c.user.tag}`)
})


async function fetchUser(username) {
    const base = process.env.KUUPRESS_API_BASE
    if (!base) throw new Error('KUUPRESS_API_BASE is not set')

    const url = `${base.replace(/\/+$/, '')}/api/public/profile/${encodeURIComponent(
        username,
    )}`

    const res = await fetch(url)

    if (!res.ok) {
        throw new Error(`User profile not found: ${res.status} ${res.statusText}`)
    }

    const json = await res.json()
    return json.data // matches your PublicProfile
}

async function fetchLeaderboard(page = 1) {
    const base = process.env.KUUPRESS_API_BASE
    if (!base) {
        throw new Error('KUUPRESS_API_BASE is not set')
    }

    const url = `${base.replace(/\/+$/, '')}/api/public/leaderboard?page=${page}`

    const res = await fetch(url)
    if (!res.ok) {
        throw new Error(`Leaderboard API error: ${res.status} ${res.statusText}`)
    }

    return res.json() // { data, meta }
}

/**
 * Format leaderboard rows into a pretty monospace table
 */
function formatLeaderboardRows(top) {
    const header =
        'Rank  Player              Lv   XP\n' +
        '----  -----------------  ---  ------------'

    const lines = top.map((u) => {
        const rank = u.rank ?? null

        const medal =
            rank === 1 ? '🥇' :
                rank === 2 ? '🥈' :
                    rank === 3 ? '🥉' :
                        `#${rank ?? '?'}`

        const displayName = (u.name || u.username || 'Unknown').toString()

        // Trim and pad name to fixed width for alignment
        let nameCol = displayName
        if (nameCol.length > 17) {
            nameCol = nameCol.slice(0, 16) + '…'
        }
        nameCol = nameCol.padEnd(17, ' ')

        const levelCol = `Lv${u.level ?? 1}`.padEnd(4, ' ')
        const xpCol = `${(u.total_xp ?? 0).toLocaleString()} XP`

        // Example: "🥇   KuupressUser      Lv10  12,345 XP"
        const rankCol = medal.padEnd(4, ' ')

        return `${rankCol}  ${nameCol}  ${levelCol} ${xpCol}`
    })

    // Wrap in a Markdown code block for a “terminal scoreboard” look
    return '```md\n' + header + '\n' + lines.join('\n') + '\n```'
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return

    // existing /rank handler above...

    if (interaction.commandName === 'user') {
        const username = interaction.options.getString('username')

        await interaction.deferReply() // public

        try {
            const u = await fetchUser(username)

            const totalXp = u.total_xp ?? u.current_exp ?? 0
            const rank = u.global_rank ?? null

            const medal =
                rank === 1 ? '🥇' :
                    rank === 2 ? '🥈' :
                        rank === 3 ? '🥉' :
                            rank ? `#${rank}` : 'Unranked'

            const lines = [
                `**Username:** ${u.username}`,
                `**Name:** ${u.name || '—'}`,
                `**Level:** Lv ${u.level}`,
                `**XP:** ${totalXp.toLocaleString()}`,
                `**Rank:** ${medal}`,
                '',
                `📖 **Chapters read:** ${u.stats?.chapters_read?.toLocaleString?.() ?? 0}`,
                `📚 **Novels followed:** ${u.stats?.novels_followed?.toLocaleString?.() ?? 0}`,
            ]

            const profileUrl = `https://kuupress.com/u/${u.username}`

            lines.push('', `🔗 [View on Kuupress](${profileUrl})`)

            const embed = new EmbedBuilder()
                .setTitle(`👤 ${u.name || u.username}`)
                .setDescription(lines.join('\n'))
                .setColor(0xffd54f)
                .setThumbnail(u.avatar || null)
                .setTimestamp()

            await interaction.editReply({ embeds: [embed] })
        } catch (e) {
            console.error(e)
            await interaction.editReply(`❌ User **${username}** not found or profile is unavailable.`)
        }
    }
})


client.login(process.env.DISCORD_TOKEN)
