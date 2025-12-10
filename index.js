// index.js – Kuupress Discord bot (ESM, pretty leaderboard + /user + paginated /rank)
import 'dotenv/config'
import {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js'

// ===== ALLOWED GUILDS (limit to 2 servers) =====
const ALLOWED_GUILD_IDS = [
    process.env.DISCORD_GUILD_ID_MAIN,
    process.env.DISCORD_GUILD_ID_SECOND,
].filter(Boolean)

if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN is not set in .env')
    process.exit(1)
}

if (!ALLOWED_GUILD_IDS.length) {
    console.warn('⚠️ No DISCORD_GUILD_ID_MAIN / DISCORD_GUILD_ID_SECOND configured – bot will accept commands from any guild.')
} else {
    console.log('✅ Allowed guilds:', ALLOWED_GUILD_IDS.join(', '))
}

// KUUPRESS_API_BASE like: https://kuupress-api.test or https://api.kuupress.com
const KUUPRESS_API_BASE = (process.env.KUUPRESS_API_BASE || '').replace(/\/+$/, '')
const KUUPRESS_LEADERBOARD_URL = 'https://kuupress.com/leaderboard'

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
            rank === 1 ? '🥇'
                : rank === 2 ? '🥈'
                    : rank === 3 ? '🥉'
                        : `#${rank ?? '?'}`

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

function buildLeaderboardEmbed(page, top) {
    const table = formatLeaderboardRows(top)

    const description =
        table + `\n🔗 **View full leaderboard:** ${KUUPRESS_LEADERBOARD_URL}`

    return new EmbedBuilder()
        .setTitle('🏆 Kuupress Leaderboard')
        .setURL(KUUPRESS_LEADERBOARD_URL) // clickable title
        .setDescription(description)
        .setColor(0xffd54f)
        .setFooter({ text: `Page ${page} • View the full leaderboard on Kuupress` }) // no total shown
        .setTimestamp()
}

function buildLeaderboardComponents(nextPage) {
    // One "Next" button that carries the target page
    const nextButton = new ButtonBuilder()
        .setCustomId(`rank_next_${nextPage}`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)

    return [new ActionRowBuilder().addComponents(nextButton)]
}

/* ================== COMMAND & BUTTON HANDLER ================== */

client.on(Events.InteractionCreate, async (interaction) => {
    // 🔒 Hard limit to specific servers if configured
    if (interaction.guildId && ALLOWED_GUILD_IDS.length && !ALLOWED_GUILD_IDS.includes(interaction.guildId)) {
        if (interaction.isRepliable()) {
            try {
                await interaction.reply({
                    content: '❌ Kuupress bot commands are only enabled in the official Kuupress servers.',
                    ephemeral: true,
                })
            } catch {
                // ignore reply errors
            }
        }
        return
    }

    // Slash commands
    if (interaction.isChatInputCommand()) {
        // /rank – beautified leaderboard (page 1)
        if (interaction.commandName === 'rank') {
            const page = 1
            await interaction.deferReply() // public

            try {
                const { data } = await fetchLeaderboard(page)
                const top = (data || []).slice(0, 10)

                if (!top.length) {
                    await interaction.editReply('No ranked users yet.')
                    return
                }

                const embed = buildLeaderboardEmbed(page, top)
                const components = buildLeaderboardComponents(page + 1)

                await interaction.editReply({
                    embeds: [embed],
                    components,
                })
            } catch (error) {
                console.error(error)
                await interaction.editReply('❌ Failed to load leaderboard from Kuupress API.')
            }

            return
        }

        // /user – show profile + stats
        if (interaction.commandName === 'user') {
            const username = interaction.options.getString('username')

            await interaction.deferReply() // public

            try {
                const u = await fetchUser(username)

                const totalXp = u.total_xp ?? u.current_exp ?? 0
                const rank = u.global_rank ?? u.rank ?? null

                const medal =
                    rank === 1 ? '🥇'
                        : rank === 2 ? '🥈'
                            : rank === 3 ? '🥉'
                                : rank ? `#${rank}` : 'Unranked'

                const lines = [
                    `**Username:** ${u.username}`,
                    `**Level:** Lv ${u.level}`,
                    `**XP:** ${totalXp.toLocaleString()}`,
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

        return
    }

    // Button interactions (Next for leaderboard)
    if (interaction.isButton()) {
        const { customId } = interaction

        if (customId.startsWith('rank_next_')) {
            const pageStr = customId.replace('rank_next_', '')
            const page = parseInt(pageStr, 10) || 1

            try {
                const { data } = await fetchLeaderboard(page)
                const top = (data || []).slice(0, 10)

                if (!top.length) {
                    // No more results – disable the button
                    const embed = buildLeaderboardEmbed(page - 1, [])
                    await interaction.update({
                        content: 'No more pages.',
                        components: [],
                    })
                    return
                }

                const embed = buildLeaderboardEmbed(page, top)
                const components = buildLeaderboardComponents(page + 1)

                await interaction.update({
                    embeds: [embed],
                    components,
                })
            } catch (err) {
                console.error(err)
                await interaction.update({
                    content: '❌ Failed to load next page.',
                    components: [],
                })
            }
        }
    }
})

client.login(process.env.DISCORD_TOKEN)
