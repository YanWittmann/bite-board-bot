import fs from 'fs';
import { MenuItemsProvider } from "./menu/MenuTypes.js";
import { AvailableMenuProviders } from "../BiteBoardBot.js";

export interface BotUserData {
    roles: string[];
    preferredMenuProvider: string;
}

export interface BotSendPeriodicMenuInto {
    time: string;
    provider: string;
    addTime: number;
}

export interface BotDataInterface {
    users: {
        [userId: string]: BotUserData;
    },
    sendDailyMenuInto: {
        [channelId: string]: BotSendPeriodicMenuInto;
    }
}

export class BotData {
    private path: string;
    private botData: BotDataInterface;

    constructor(path: string) {
        if (!path) {
            throw new Error('No path provided for BotData, set the [dataStoragePath] config value to a valid path');
        }
        this.path = path;
        this.botData = this.readData();
        this.writeData();
    }

    public findUserPreferredMenuProvider(userId: string, menuProviders: AvailableMenuProviders): MenuItemsProvider | undefined {
        const preferredMenuProvider = this.findOrCreateUser(userId).preferredMenuProvider;
        if (preferredMenuProvider) {
            if (menuProviders[preferredMenuProvider]) {
                return menuProviders[preferredMenuProvider];
            }
        }
        if (Object.keys(menuProviders).length > 0) {
            const alternateProvider = Object.values(menuProviders)[0];
            console.error(`The preferred menu provider for user ${userId} is not available: ${preferredMenuProvider}, falling back to ${alternateProvider.getName()}`);
            return alternateProvider;
        } else {
            console.error(`No menu providers available to fall back to, please register at least one provider.`);
            return undefined;
        }
    }

    public setUserPreferredMenuProvider(userId: string, provider: string) {
        const userData = this.findOrCreateUser(userId);
        userData.preferredMenuProvider = provider;
        this.writeData();
    }

    public isUserRole(userId: string, role: string): boolean {
        return this.findOrCreateUser(userId).roles.includes(role);
    }

    protected findOrCreateUser(userId: string): BotUserData {
        if (!this.botData.users[userId]) {
            this.botData.users[userId] = {
                roles: [],
                preferredMenuProvider: ''
            };
        }
        return this.botData.users[userId];
    }

    public getAllPeriodicMenuChannels(): { [channelId: string]: BotSendPeriodicMenuInto } {
        return this.botData.sendDailyMenuInto;
    }

    public setPeriodicMenuChannel(channelId: string, time: string, provider: string, addTime: number) {
        this.botData.sendDailyMenuInto[channelId] = {
            time: time,
            provider: provider,
            addTime: addTime
        };
        this.writeData();
    }

    public writeData() {
        try {
            fs.writeFileSync(this.path, JSON.stringify(this.botData, null, 0), 'utf8');
        } catch (error) {
            console.error(error);
            throw new Error(`Could not write the bot data file: ${this.path}`);
        }
    }

    private readData(): BotDataInterface {
        if (!fs.existsSync(this.path)) {
            return {
                users: {},
                sendDailyMenuInto: {}
            } as BotDataInterface;
        }
        let data;
        try {
            data = fs.readFileSync(this.path, 'utf8');
        } catch (error) {
            console.error(error);
            throw new Error(`Could not read the bot data file: ${this.path}`);
        }
        if (data) {
            try {
                return JSON.parse(data) as BotDataInterface;
            } catch (error) {
                console.error(error);
                throw new Error(`Could not parse the bot data file: ${this.path}`);
            }
        } else {
            return {
                users: {},
                sendDailyMenuInto: {}
            } as BotDataInterface;
        }
    }
}
