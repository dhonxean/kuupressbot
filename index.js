// index.js – Kuupress Discord bot (ESM, pretty leaderboard + /user)
import 'dotenv/config'
import {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    Events,
} from 'discord.js'

// Node 18+ has global fetch – no node-fetch needed
// KUUPRESS_API_BASE like: https://kuupress-api.test or https://api.kuupress.com
const KUUPRESS_API_BASE = (process.env.KUUPRESS_API_BASE || '').replace(/\/+$/, '')

if (!KUUPRESS_API_BASE) {
    console.warn('⚠️ KUUPRESS_API_BASE is not set in .env')
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
})

// v14: prefer Events.ClientReady (alias of "clientReady")
client.once(Events.ClientReady, (c) => {
    console.log(`Logged in as ${c.user.tag}`)
})

/* ================== API HELPERS ================== */

async function fetchJson(path) {
    if (!KUUPRESS_API_BASE) {
        throw new Error('KUUPRESS_API_BASE is not configured')
    }

    const url = `${KUUPRESS_API_BASE}${path}`

    const res = await fetch(url)
    if (!res.ok) {
        throw new Error(`API error ${res.status} ${res.statusText} for ${url}`)
    }

    return res.json()
}

async function fetchLeaderboard(page = 1) {
    const json = await fetchJson(`/api/public/leaderboard?page=${page}`)
    // Expecting: { data: [...], meta: {...} }
    return json
}

async function fetchUser(username) {
    const json = await fetchJson(`/api/public/profile/${encodeURIComponent(username)}`)
    return json.data // matches your PublicProfile
}

/* =============== LEADERBOARD FORMATTER =============== */

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

        const rankCol = medal.padEnd(4, ' ')

        // Example: "🥇   KuupressUser      Lv10  12,345 XP"
        return `${rankCol}  ${nameCol}  ${levelCol} ${xpCol}`
    })

    // Markdown code block for nice monospace scoreboard
    return '```md\n' + header + '\n' + lines.join('\n') + '\n```'
}

/* ================== COMMAND HANDLER ================== */

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return

    // /rank – beautified leaderboard
    if (interaction.commandName === 'rank') {
        await interaction.deferReply()

        try {
            const { data, meta } = await fetchLeaderboard(1)
            const top = (data || []).slice(0, 10)

            if (!top.length) {
                await interaction.editReply('No ranked users yet.')
                return
            }

            const table = formatLeaderboardRows(top)

            const embed = new EmbedBuilder()
                .setTitle('🏆 Kuupress Leaderboard')
                .setDescription(table)
                .setColor(0xffd54f)
                .setFooter({
                    text: meta
                        ? `Page ${meta.current_page} of ${meta.last_page} • Total ${meta.total} users`
                        : 'Global leaderboard',
                })
                .setTimestamp()

            await interaction.editReply({ embeds: [embed] })
        } catch (error) {
            console.error(error)
            await interaction.editReply('❌ Failed to load leaderboard from Kuupress API.')
        }

        return
    }

    // /user – show profile + stats
    if (interaction.commandName === 'user') {
        const username = interaction.options.getString('username')

        await interaction.deferReply()

        try {
            const u = await fetchUser(username)

            const totalXp = u.total_xp ?? u.current_exp ?? 0
            const rank = u.global_rank ?? u.rank ?? null

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

            const avatarUrl = u.avatar || u.avatar_url || null

            const embed = new EmbedBuilder()
                .setTitle(`👤 ${u.name || u.username}`)
                .setDescription(lines.join('\n'))
                .setColor(0xffd54f)
                .setTimestamp()

            if (avatarUrl) {
                embed.setThumbnail(avatarUrl)
            }

            await interaction.editReply({ embeds: [embed] })
        } catch (e) {
            console.error(e)
            await interaction.editReply(`❌ User **${username}** not found or profile is unavailable.`)
        }

        return
    }
})

client.login(process.env.DISCORD_TOKEN)
