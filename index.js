// index.js – Kuupress Discord bot (ESM, pretty leaderboard + /user + paginated /rank)
import 'dotenv/config'
import fetch from 'node-fetch' // ✅ Explicit fetch for all Node versions

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

// Mobile-friendly, single-line rows instead of wide monospace table
function formatLeaderboardRows(top) {
    return top
        .map((u) => {
            const rank = u.rank ?? null

            const medal =
                rank === 1 ? '🥇'
                    : rank === 2 ? '🥈'
                        : rank === 3 ? '🥉'
                            : rank ? `#${rank}` : '#?'

            const displayName = (u.name || u.username || 'Unknown').toString()

            // Trim long names so they don’t wrap too ugly on mobile
            let nameCol = displayName
            if (nameCol.length > 18) {
                nameCol = nameCol.slice(0, 17) + '…'
            }

            const level = u.level ?? 1
            const xp = (u.total_xp ?? 0).toLocaleString()

            // Example:
            // 🥇 **KuupressUser** — Lv 10 • 12,345 XP
            return `${medal} **${nameCol}** — Lv ${level} • ${xp} XP`
        })
        .join('\n')
}

function buildLeaderboardEmbed(page, top) {
    const body = formatLeaderboardRows(top)
    const description = [
        body,
        '',
        `🔗 [View full leaderboard](${KUUPRESS_LEADERBOARD_URL})`,
    ].join('\n')

    return new EmbedBuilder()
        .setTitle('🏆 Kuupress Leaderboard')
        .setURL(KUUPRESS_LEADERBOARD_URL)
        .setDescription(description)
        .setColor(0xffd54f)
        .setFooter({
            text: `Page ${page} • View the full leaderboard on Kuupress`,
        })
        .setTimestamp()
}

function buildLeaderboardComponents(currentPage, lastPage) {
    const buttons = []

    // Previous only if there's a previous page
    if (currentPage > 1) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`rank_page_${currentPage - 1}`)
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary),
        )
    }

    // Next only if there is a next page
    if (currentPage < lastPage) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`rank_page_${currentPage + 1}`)
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary),
        )
    }

    if (!buttons.length) return []
    return [new ActionRowBuilder().addComponents(buttons)]
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
            await interaction.deferReply()

            try {
                const { data, meta } = await fetchLeaderboard(page)
                const top = (data || []).slice(0, 10)

                if (!top.length) {
                    await interaction.editReply('No ranked users yet.')
                    return
                }

                const currentPage = meta?.current_page ?? page
                const lastPage = meta?.last_page ?? page

                const embed = buildLeaderboardEmbed(currentPage, top)
                const components = buildLeaderboardComponents(currentPage, lastPage)

                await interaction.editReply({
                    embeds: [embed],
                    components,
                })
            } catch (error) {
                console.error(error)
                await interaction.editReply('⚠️ Kuupress API is waking up — try again in a moment')
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

    // Button interactions (Previous / Next)
    if (interaction.isButton()) {
        const { customId } = interaction

        if (customId.startsWith('rank_page_')) {
            const pageStr = customId.replace('rank_page_', '')
            const page = parseInt(pageStr, 10) || 1

            try {
                const { data, meta } = await fetchLeaderboard(page)
                const top = (data || []).slice(0, 10)

                if (!top.length) {
                    await interaction.update({
                        content: 'No ranked users on this page.',
                        embeds: [],
                        components: [],
                    })
                    return
                }

                const currentPage = meta?.current_page ?? page
                const lastPage = meta?.last_page ?? page

                const embed = buildLeaderboardEmbed(currentPage, top)
                const components = buildLeaderboardComponents(currentPage, lastPage)

                await interaction.update({
                    embeds: [embed],
                    components,
                })
            } catch (err) {
                console.error(err)
                await interaction.update({
                    content: '⚠️ Kuupress API is waking up — try again in a moment',
                    embeds: [],
                    components: [],
                })
            }
        }
    }
})

client.login(process.env.DISCORD_TOKEN)
