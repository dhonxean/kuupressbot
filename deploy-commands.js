import 'dotenv/config'
import { REST, Routes, SlashCommandBuilder } from 'discord.js'

const { SlashCommandBuilder } = require('discord.js')

const commands = [
    new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Show the Kuupress leaderboard.'),

    new SlashCommandBuilder()
        .setName('user')
        .setDescription('View Kuupress user profile and rank.')
        .addStringOption(option =>
            option
                .setName('username')
                .setDescription('Kuupress username')
                .setRequired(true)
        ),
].map(cmd => cmd.toJSON())


main()
