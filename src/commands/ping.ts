import { CommandInteraction, SlashCommandBuilder } from "discord.js";

export function constructCommand() {
    return {
        data: new SlashCommandBuilder()
            .setName('ping')
            .setDescription('Replies with Pong!'),

        execute: async function (interaction: CommandInteraction) {
            console.log('Ping command executed', typeof interaction, Object.keys(interaction));
            await interaction.reply('Pong! You are ' + interaction.user.tag);
        }
    }
}

