import { Client, CommandInteraction, Events, GatewayIntentBits, REST, Routes, TextChannel } from 'discord.js';
import discordBotConfigJson from './discord-bot-config.json' assert { type: 'json' };
import { BotData } from './service/BotData.js';
import { createImageSearchFromJson, ImageSearch } from './service/ImageSearch.js';
import { MenuItemsProvider } from "./service/menu/MenuTypes.js";
import {
    HochschuleMannheimTagessichtMenuProvider
} from "./service/menu/providers/HochschuleMannheimTagessichtMenuProvider.js";
import { fillTranslation, getTranslation, setLang } from "./service/TranslationProvider.js";
import * as ping from './commands/ping.js';
import * as menu from './commands/menu.js';
import { constructImageEmbed } from './commands/menu.js';
import * as settingsmenu from './commands/settingsmenu.js';
import {
    HochschuleMannheimWochensichtMenuProvider
} from "./service/menu/providers/HochschuleMannheimWochensichtMenuProvider.js";

export interface DiscordBotConfig {
    token: string;
    clientId: string;
    dataStoragePath: string;
    mensaMenuImagePreviewService: "none" | "googleApi" | "googlePage";
    googleImageApiKey: string;
    googleImageApiApplicationId: string;
    language: string;
    deleteImagesAfter: number | undefined;
}

export interface AvailableMenuProviders {
    [providerName: string]: MenuItemsProvider;
}

const availableMenuProviders: AvailableMenuProviders = {};
new HochschuleMannheimTagessichtMenuProvider().register(availableMenuProviders);
new HochschuleMannheimWochensichtMenuProvider().register(availableMenuProviders);

const discordBotConfig: DiscordBotConfig = discordBotConfigJson as unknown as DiscordBotConfig;
const botData: BotData = new BotData(discordBotConfig.dataStoragePath);

const imageSearch: ImageSearch = createImageSearchFromJson(discordBotConfig);

setLang(discordBotConfig.language);

setupDiscordClient();

function setupDiscordClient() {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });

    client.once(Events.ClientReady, (readyClient) => {
        console.log(`Ready! Logged in as ${readyClient.user.tag}`);

        // send into channel
        // const channel = client.channels.cache.get('1087412251750838274');
        // if (channel) {
        //     (channel as TextChannel).send('Hello from the bot!')
        //         .then(() => console.log('Message sent'));
        // }
    });

    const pingCommand = ping.constructCommand();
    const menuCommand = menu.constructCommand();
    const menuSettingsCommand = settingsmenu.constructCommand(availableMenuProviders);

    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isCommand()) return;

        const { commandName } = interaction;

        try {
            const commandInteraction = interaction as CommandInteraction;
            if (commandName === 'ping') {
                await pingCommand.execute(commandInteraction);
            } else if (commandName === 'menu') {
                await menuCommand.execute(commandInteraction, availableMenuProviders, imageSearch, discordBotConfig, botData);
            } else if (commandName === 'settingsmenu') {
                await menuSettingsCommand.execute(commandInteraction, availableMenuProviders, discordBotConfig, botData);
            }
        } catch (error) {
            console.error(error);
            try {
                await interaction.reply({
                    content: getTranslation('command.generic.errorExecutingCommand'),
                    ephemeral: true
                });
            } catch (error) {
                await interaction.followUp({
                    content: getTranslation('command.generic.errorExecutingCommand'),
                    ephemeral: true
                });
            }
        }
    });

    client.login(discordBotConfig.token);

    const rest = new REST({ version: '9' }).setToken(discordBotConfig.token);

    (async () => {
        const commands = [
            pingCommand.data.toJSON(),
            menuCommand.data.toJSON(),
            menuSettingsCommand.data.toJSON(),
        ];
        try {
            console.log(`Started refreshing ${commands.length} application (/) commands.`);

            const data = await rest.put(
                Routes.applicationCommands(discordBotConfig.clientId),
                { body: commands },
            );

            console.log(`Successfully reloaded application (/) commands.`);
        } catch (error) {
            console.error(error);
        }
    })();

    const periodicMenuCheckTimeInterval = 1000 * 10;
    setInterval(checkForPeriodicMenuPosting, periodicMenuCheckTimeInterval);

    // setTimeout(checkForPeriodicMenuPosting, 1000 * 5); // test

    function checkUTCTime(time: string, periodicMenuCheckTimeInterval: number): boolean {
        const [hours, minutes, seconds] = time.split(':'); // HH:MM:SS

        let nowUTC = new Date();

        let timeHours = parseInt(hours);
        let timeMinutes = parseInt(minutes);
        let timeSeconds = parseInt(seconds);

        let timeUTC = new Date(); // Create a date in UTC
        timeUTC.setUTCHours(timeHours);
        timeUTC.setUTCMinutes(timeMinutes);
        timeUTC.setUTCSeconds(timeSeconds);

        let diff = nowUTC.getTime() - timeUTC.getTime();
        // console.log('Time diff', diff, 'for', time, 'and now', nowUTC.toISOString());
        return diff >= 0 && diff < periodicMenuCheckTimeInterval;
    }

    function checkForPeriodicMenuPosting() {
        const channelsData = botData.getAllPeriodicMenuChannels();
        for (let channelId in channelsData) {
            // time is a UTC HH:MM:SS
            // then, check if that time was reached in the last periodicMenuCheckTimeInterval seconds
            const time = channelsData[channelId].time;
            if (!checkUTCTime(time, periodicMenuCheckTimeInterval)) {
                continue;
            }

            const provider = availableMenuProviders[channelsData[channelId].provider];
            if (!provider) {
                console.error(`Provider for channel ${channelId} is not available: ${channelsData[channelId].provider}`);
                continue;
            }

            const addTime = channelsData[channelId].addTime; // add time in minutes to find the day to fetch the menu for
            const queryTime = new Date();
            queryTime.setUTCMinutes(queryTime.getUTCMinutes() + addTime);
            console.log('Query time', queryTime.toISOString(), '=', new Date().toISOString(), '+', addTime, 'minutes');
            const menuTime = {
                year: queryTime.getUTCFullYear(),
                month: queryTime.getUTCMonth() + 1,
                day: queryTime.getUTCDate()
            };

            console.log(`Posting menu for channel ${channelId} with provider ${provider.getName()}`);
            menu.constructMenuEmbed(provider, {
                menuTime,
                targetDate: queryTime,
                title: 'Menu',
            }).then(menuEmbed => {
                const channel = client.channels.cache.get(channelId);
                if (!channel) {
                    console.error(`Channel ${channelId} not found to post the periodic menu into`);
                    return;
                }
                if (menuEmbed.menuItems.length === 0) {
                    (channel as TextChannel).send(fillTranslation('command.settingsmenu.response.periodicMenu.noMenuForToday', provider.toMdString(), queryTime.toDateString()));
                    console.log('No periodic menu found for channel', channel.id, queryTime.toDateString());
                    return;
                }
                (channel as TextChannel).send({ embeds: [menuEmbed.menuEmbed] });

                const menuItems = menuEmbed.menuItems;

                constructImageEmbed(imageSearch, menuItems).then(imageEmbed => {
                    if (imageEmbed) {
                        (channel as TextChannel).send(imageEmbed)
                            .then(message => {
                                if (discordBotConfig.deleteImagesAfter) {
                                    setTimeout(() => {
                                        message.delete();
                                        console.log('Deleted combined image message after timeout', message.id);
                                    }, discordBotConfig.deleteImagesAfter);
                                }
                            });
                    }
                });
            });
        }
    }
}