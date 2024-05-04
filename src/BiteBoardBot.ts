import { ApplicationStateLogger } from "./service/ApplicationStateLogger.js";
import { fillTranslation, getTranslation, setLang, setupLanguages } from "./service/TranslationProvider.js";
import fs from "fs";
import { BotData } from "./service/BotData.js";
import { MenuItemsProvider } from "./service/menu/MenuTypes.js";
import { createImageSearchFromJson, ImageSearch } from "./service/ImageSearch.js";
import { Client, CommandInteraction, Events, GatewayIntentBits, REST, Routes, TextChannel } from "discord.js";
import * as menu from "./commands/menu.js";
import { constructImageEmbed } from "./commands/menu.js";
import * as settingsmenu from "./commands/settingsmenu.js";

export class BiteBoardBot {
    private static readonly PERIODIC_MENU_CHECK_TIME_INTERVAL = 1000 * 10;

    private readonly appStateLogger: ApplicationStateLogger = new ApplicationStateLogger();
    private readonly discordBotConfig: DiscordBotConfig = {} as DiscordBotConfig;
    private readonly botData: BotData = {} as BotData;
    private readonly availableMenuProviders: AvailableMenuProviders = {};
    private readonly imageSearch: ImageSearch;

    private readonly discordBotClient: Client;
    private readonly botCommands: any;

    constructor(menuProviders: MenuItemsProvider[]) {
        process.on('exit', code => {
            this.appStateLogger.logExitCode(code);
        });

        try {
            this.appStateLogger.applicationIntroduction();

            // config and data
            this.discordBotConfig = this.parseBotConfig();
            this.loadLanguageFiles();
            this.setDefaultLanguage();
            this.botData = this.parseBotData();
            this.registerMenuProviders(menuProviders);
            this.imageSearch = this.createImageSearcher();

            // discord bot
            this.botCommands = this.constructCommands();
            this.discordBotClient = new Client({ intents: [GatewayIntentBits.Guilds] });
            this.discordBotClient.once(Events.ClientReady, (readyClient) => {
                this.appStateLogger.logSetupComplete(readyClient.user.tag);
            });
            this.setupCommandInteractions();
            this.discordBotClient.login(this.discordBotConfig.token);
            this.registerCommandsForBotAtDiscord();

            // periodic menu posting
            setInterval(() => {
                try {
                    this.checkForPeriodicMenuPosting();
                } catch (error) {
                    console.error('Error while checking for periodic menu posting', error);
                }
            }, BiteBoardBot.PERIODIC_MENU_CHECK_TIME_INTERVAL);

        } catch (error) {
            if (error instanceof Error) {
                this.appStateLogger.exitWithError(error.message, 1, error);
            }
            throw error;
        }
    }

    // START: INITIALIZATION LOGIC

    private loadLanguageFiles() {
        this.appStateLogger.logSetupStep('parseLang');
        try {
            setupLanguages();
        } catch (error) {
            if (error instanceof Error) {
                this.appStateLogger.exitWithError(error.message, 1, error);
            }
        }
    }

    private setDefaultLanguage() {
        this.appStateLogger.logSetupStep('setLanguage', [this.discordBotConfig.language]);
        setLang(this.discordBotConfig.language);
    }

    private parseBotConfig(): DiscordBotConfig {
        const configFilePath = process.env.BITE_BOARD_CONFIG_PATH || 'bite-board-config.json';

        this.appStateLogger.logSetupStep('parseConfig', [configFilePath]);
        if (!fs.existsSync(configFilePath)) {
            this.appStateLogger.exitWithError('[' + configFilePath + '] not found, copy [bite-board-config-template.json] and fill in the values according to documentation.', 1);
        }
        const discordBotConfigJson = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
        return discordBotConfigJson as unknown as DiscordBotConfig;
    }

    private parseBotData(): BotData {
        this.appStateLogger.logSetupStep('parseDataFile', [this.discordBotConfig.dataStoragePath]);
        return new BotData(this.discordBotConfig.dataStoragePath);
    }

    private registerMenuProviders(menuProviders: MenuItemsProvider[]) {
        this.appStateLogger.logSetupStep('registerMenuProviders');
        for (const menuProvider of menuProviders) {
            menuProvider.register(this.availableMenuProviders);
        }
    }

    private createImageSearcher() {
        this.appStateLogger.logSetupStep('createImageSearcher', [this.discordBotConfig.mensaMenuImagePreviewService]);
        return createImageSearchFromJson(this.discordBotConfig);
    }

    // END: INITIALIZATION LOGIC

    // START: BOT INITIALIZATION

    private setupCommandInteractions() {
        this.appStateLogger.logSetupStep('setupCommandInteractions');

        this.discordBotClient.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isCommand()) return;

            const { commandName } = interaction;

            try {
                const commandInteraction = interaction as CommandInteraction;
                if (commandName === this.botCommands.menuCommand.data.name) {
                    await this.botCommands.menuCommand.execute(commandInteraction, this.availableMenuProviders, this.imageSearch, this.discordBotConfig, this.botData);
                } else if (commandName === this.botCommands.menuSettingsCommand.data.name) {
                    await this.botCommands.menuSettingsCommand.execute(commandInteraction, this.availableMenuProviders, this.discordBotConfig, this.botData);
                }
            } catch (error) {
                console.error('Error while running command', error);
                try {
                    await interaction.reply({
                        content: getTranslation('command.generic.errorExecutingCommand'),
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('Error sending error message', error);
                }
            }
        });
    }

    private constructCommands() {
        this.appStateLogger.logSetupStep('constructCommands');
        return {
            menuCommand: menu.constructCommand(),
            menuSettingsCommand: settingsmenu.constructCommand(this.availableMenuProviders),
        }
    }

    private registerCommandsForBotAtDiscord() {
        this.appStateLogger.logSetupStep('registerCommandsForBotAtDiscord');

        const rest = new REST({ version: '9' }).setToken(this.discordBotConfig.token);

        (async () => {
            const commands = Object.values(this.botCommands).map(command => (command as any).data.toJSON());
            try {
                console.log(`Started refreshing ${commands.length} application (/) commands.`);

                const data = await rest.put(
                    Routes.applicationCommands(this.discordBotConfig.clientId),
                    { body: commands },
                );

                console.log(`Successfully reloaded application (/) commands.`);
            } catch (error) {
                console.error(error);
            }
        })();

        /*setTimeout(() => {
            let deleteCommandId = 'someChannelIdNumber';
            rest.delete(Routes.applicationCommand(this.discordBotConfig.clientId, deleteCommandId))
                .then(() => console.log('Deleted command with id', deleteCommandId))
                .catch(console.error);
        }, 1000);*/
    }

    private checkForPeriodicMenuPosting() {
        const channelsData = this.botData.getAllPeriodicMenuChannels();

        for (let channelId in channelsData) {
            // time is a UTC HH:MM:SS
            // then, check if that time was reached in the last periodicMenuCheckTimeInterval seconds
            const time = channelsData[channelId].time;
            if (!this.checkUTCTime(time, BiteBoardBot.PERIODIC_MENU_CHECK_TIME_INTERVAL)) {
                continue;
            }

            const provider = this.availableMenuProviders[channelsData[channelId].provider];
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
                const channel = this.discordBotClient.channels.cache.get(channelId);
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

                constructImageEmbed(this.imageSearch, menuItems).then(imageEmbed => {
                    if (imageEmbed) {
                        (channel as TextChannel).send(imageEmbed)
                            .then(message => {
                                if (this.discordBotConfig.deleteImagesAfter) {
                                    setTimeout(() => {
                                        message.delete();
                                        console.log('Deleted combined image message after timeout', message.id);
                                    }, this.discordBotConfig.deleteImagesAfter);
                                }
                            });
                    }
                });
            });
        }
    }

    // END: BOT INITIALIZATION

    // START: UTILITY FUNCTIONS

    private checkUTCTime(time: string, periodicMenuCheckTimeInterval: number): boolean {
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

    // END: UTILITY FUNCTIONS
}

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
