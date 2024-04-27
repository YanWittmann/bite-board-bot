import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { fillTranslation, getTranslation } from "../service/TranslationProvider.js";
import { AvailableMenuProviders, DiscordBotConfig } from "../index.js";
import { BotData } from "../service/BotData.js";

export function constructCommand(availableMenuProviders: AvailableMenuProviders) {
    const providerChoices = Object.keys(availableMenuProviders).map(providerName => {
        return { name: providerName, value: providerName };
    }) as any;

    return {
        data: new SlashCommandBuilder()
            .setName('settingsmenu')
            .setDescription(getTranslation('command.settingsmenu.baseDescription'))
            .addSubcommand(subcommand =>
                subcommand.setName(getTranslation('command.settingsmenu.options.setprovider.name'))
                    .setDescription(getTranslation('command.settingsmenu.options.setprovider.description'))
                    .addStringOption(option =>
                        option.setName('provider')
                            .setDescription(getTranslation('command.settingsmenu.options.setprovider.description'))
                            .setRequired(true)
                            .addChoices(...providerChoices)
                    ))
            .addSubcommand(subcommand =>
                subcommand.setName(getTranslation('command.settingsmenu.options.listproviders.name'))
                    .setDescription(getTranslation('command.settingsmenu.options.listproviders.description')))
            .addSubcommand(subcommand =>
                subcommand.setName(getTranslation('command.settingsmenu.options.periodicMenu.name'))
                    .setDescription(getTranslation('command.settingsmenu.options.periodicMenu.description'))
                    .addStringOption(option =>
                        option.setName('time')
                            .setDescription(getTranslation('command.settingsmenu.options.periodicMenu.time.description'))
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('provider')
                            .setDescription(getTranslation('command.settingsmenu.options.periodicMenu.provider.description'))
                            .setRequired(true)
                            .addChoices(...providerChoices))
                    .addNumberOption(option =>
                        option.setName('add')
                            .setDescription(getTranslation('command.settingsmenu.options.periodicMenu.addTime.description'))
                            .setRequired(true))
            ),

        execute: async function (interaction: CommandInteraction, menuProviders: AvailableMenuProviders, botConfig: DiscordBotConfig, botData: BotData) {
            await interaction.deferReply();

            // @ts-ignore
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === getTranslation('command.settingsmenu.options.setprovider.name')) {
                setProvider(interaction, menuProviders, botConfig, botData);
            } else if (subcommand === getTranslation('command.settingsmenu.options.listproviders.name')) {
                listProviders(interaction, menuProviders);
            } else if (subcommand === getTranslation('command.settingsmenu.options.periodicMenu.name')) {
                schedulePeriodicMenu(interaction, menuProviders, botData);
            } else {
                interaction.followUp(getTranslation('command.settingsmenu.response.unknownSubcommand.description'));
            }
        }
    }
}

function schedulePeriodicMenu(interaction: CommandInteraction, menuProviders: AvailableMenuProviders, botData: BotData) {
    const user = interaction.user.tag;
    if (!botData.isUserRole(user, 'admin')) {
        interaction.followUp(fillTranslation('command.settingsmenu.response.periodicMenu.noPermission'));
        console.error(`User ${user} tried to set periodic menu, but has no permission`);
        return;
    }

    const channelId = interaction.channelId;
    // @ts-ignore
    const time = interaction.options.getString('time');
    // @ts-ignore
    const provider = interaction.options.getString('provider');
    const providerNames = Object.keys(menuProviders);
    // @ts-ignore
    const addTime = interaction.options.getNumber('add');

    if (!providerNames.includes(provider)) {
        interaction.followUp(fillTranslation('command.settingsmenu.response.periodicMenu.providerNotAvailable', provider));
        console.error(`User ${user} tried to set periodic menu with provider ${provider}, but it is not available`);
        return;
    }
    const foundProvider = menuProviders[provider];

    // validate time
    const timeParts = time.split(':');
    const isValidFormat = timeParts.length === 3
        && parseInt(timeParts[0]) <= 23 && parseInt(timeParts[1]) <= 59 && parseInt(timeParts[2]) <= 59
        && parseInt(timeParts[0]) >= 0 && parseInt(timeParts[1]) >= 0 && parseInt(timeParts[2]) >= 0;
    if (!isValidFormat) {
        interaction.followUp(fillTranslation('command.settingsmenu.response.periodicMenu.invalidTime', time));
        console.error(`User ${user} tried to set periodic menu with invalid time ${time}`);
        return;
    }

    botData.setPeriodicMenuChannel(channelId, time, provider, addTime);
    console.log(`User ${user} set periodic menu for channel ${channelId} to ${time} with provider ${provider}`)
    interaction.followUp(fillTranslation('command.settingsmenu.response.periodicMenu.success', time, foundProvider.toMdString(), addTime));
}

function setProvider(interaction: CommandInteraction, menuProviders: AvailableMenuProviders, botConfig: DiscordBotConfig, botData: BotData) {
    const user = interaction.user.tag;
    // @ts-ignore
    const provider = interaction.options.getString('provider');
    const providerNames = Object.keys(menuProviders);

    if (!providerNames.includes(provider)) {
        interaction.followUp(fillTranslation('command.settingsmenu.response.setprovider.providerNotAvailable', provider));
        console.error(`User ${user} tried to set provider to ${provider}, but it is not available`);
        return;
    }

    botData.setUserPreferredMenuProvider(user, provider);
    interaction.followUp(fillTranslation('command.settingsmenu.response.setprovider.success', provider));
    console.log(`User ${user} set provider to ${provider}`);
}

function listProviders(interaction: CommandInteraction, menuProviders: AvailableMenuProviders) {
    const providerNames = Object.keys(menuProviders);

    if (providerNames.length === 0) {
        interaction.followUp(getTranslation('command.settingsmenu.response.listproviders.noProviders'));
        return;
    }

    // construct a message like this:
    // Available menu providers:
    // - provider1 (url1)
    // - provider2 (url2)

    const providerList = providerNames.map(providerName => {
        const provider = menuProviders[providerName];
        return `- ${provider.toMdString()}`;
    }).join('\n');

    interaction.followUp(getTranslation('command.settingsmenu.response.listproviders.success') + '\n' + providerList);
}
