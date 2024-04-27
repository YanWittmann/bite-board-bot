import { AttachmentBuilder, CommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { MenuItem, MenuItemFeature, MenuItemsProvider, MenuTime } from "../service/menu/MenuTypes.js";
import { ImageSearch } from "../service/ImageSearch.js";
import { Canvas, createCanvas, Image, loadImage } from 'canvas';
import * as fs from "node:fs";
import { getTranslation } from "../service/TranslationProvider.js";
import { AvailableMenuProviders, DiscordBotConfig } from "../index.js";
import { BotData } from "../service/BotData.js";

export function constructCommand() {
    return {
        data: new SlashCommandBuilder()
            .setName('menu')
            .setDescription(getTranslation('command.menu.description'))
            .addSubcommand(subcommand =>
                subcommand.setName(getTranslation('command.menu.options.today.name'))
                    .setDescription(getTranslation('command.menu.options.today.description')))
            .addSubcommand(subcommand =>
                subcommand.setName(getTranslation('command.menu.options.tomorrow.name'))
                    .setDescription(getTranslation('command.menu.options.tomorrow.description')))
            .addSubcommand(subcommand =>
                subcommand.setName(getTranslation('command.menu.options.overmorrow.name'))
                    .setDescription(getTranslation('command.menu.options.overmorrow.description')))
            .addSubcommand(subcommand =>
                subcommand.setName(getTranslation('command.menu.options.monday.name'))
                    .setDescription(getTranslation('command.menu.options.monday.description')))
            .addSubcommand(subcommand =>
                subcommand.setName(getTranslation('command.menu.options.tuesday.name'))
                    .setDescription(getTranslation('command.menu.options.tuesday.description')))
            .addSubcommand(subcommand =>
                subcommand.setName(getTranslation('command.menu.options.wednesday.name'))
                    .setDescription(getTranslation('command.menu.options.wednesday.description')))
            .addSubcommand(subcommand =>
                subcommand.setName(getTranslation('command.menu.options.thursday.name'))
                    .setDescription(getTranslation('command.menu.options.thursday.description')))
            .addSubcommand(subcommand =>
                subcommand.setName(getTranslation('command.menu.options.friday.name'))
                    .setDescription(getTranslation('command.menu.options.friday.description'))),

        execute: async function (interaction: CommandInteraction, menuProviders: AvailableMenuProviders, imageSearch: ImageSearch, botConfig: DiscordBotConfig, botData: BotData) {
            await interaction.deferReply();

            const user = interaction.user.tag;
            const menuProvider = botData.findUserPreferredMenuProvider(user, menuProviders);
            if (!menuProvider) {
                await interaction.followUp(getTranslation('command.menu.response.noMenuProvider'));
                return;
            }

            const commandData = parseCommand(interaction);
            console.log('Menu command executed by', user, menuProvider.getName(), 'fetching menu for', commandData);

            const { menuEmbed, menuItems } = await constructMenuEmbed(menuProvider, commandData);

            await interaction.followUp({ embeds: [menuEmbed] });

            const imageEmbed = await constructImageEmbed(imageSearch, menuItems);
            if (imageEmbed) {
                await interaction.followUp(imageEmbed)
                    .then(message => {
                        if (botConfig.deleteImagesAfter) {
                            setTimeout(() => {
                                message.delete();
                                console.log('Deleted combined image message after timeout', message.id);
                            }, botConfig.deleteImagesAfter);
                        }
                    });
            }
        }
    }
}

export async function constructImageEmbed(imageSearch: ImageSearch, menuItems: MenuItem[]) {
    const preferredImageDisplayMode = imageSearch.preferredImageDisplayMode();

    const irrelevantImageItems = ['Salatbuffet', 'Dessert'];
    const relevantItems = menuItems.filter(i => !irrelevantImageItems.includes(i.name ?? ''));

    const imageQueries: { query: string, item: any }[] = [];
    for (const item of relevantItems) {
        if (!item.shouldFetchImages) continue;

        const query = 'Mensa Gericht ' + item.ingredients
            .map(i => i.name)
            .filter(i => !["frische Kräuter", "Beilagensalat"].includes(i))
            .join(' ');
        imageQueries.push({ query, item });
    }

    if (preferredImageDisplayMode === 'separate') {
        try {
            for (const { query, item } of imageQueries) {
                await imageSearch.searchImages(query).then(images => {
                    if (images.length > 0) {
                        images = images
                            .filter(i => typeof i === 'string')
                            .filter(i => i.endsWith('.jpg') || i.endsWith('.png') || i.endsWith('.jpeg'))
                            .filter(i => i.startsWith('https://') || i.startsWith('http://'));
                        console.log(query, images)

                        const maxImages = 1;
                        images = images.slice(0, Math.min(images.length, maxImages));
                        const image = images[Math.floor(Math.random() * images.length)];
                        console.log('Fetched image for', query, images.length, image);

                        const imageEmbed = new EmbedBuilder()
                            .setTitle((item.name ?? 'Unknown Item') + ' ~ ' + (item.ingredients.length > 0 ? item.ingredients[0].name : ''))
                            .setImage(image)
                            .setColor('#0099ff')
                            .setTimestamp()
                            .setFooter({ text: getTranslation('command.menu.response.image.individual.footer') });

                        return { embeds: [imageEmbed] };
                    }
                });
            }
        } catch (error) {
            console.error('Failed to fetch images for menu items:', error);
        }
    } else if (preferredImageDisplayMode === 'combined') {
        try {
            const desiredHeight = 300;
            const combinedImage = await createCombinedImage(imageSearch, imageQueries.map(q => q.query), desiredHeight);
            await writeCanvasToFile(combinedImage, 'tmp-combined-mensa-image.png');

            const file = new AttachmentBuilder('tmp-combined-mensa-image.png');

            const imageEmbed = {
                title: getTranslation('command.menu.response.image.combined.title'),
                image: {
                    url: 'attachment://tmp-combined-mensa-image.png',
                },
            };

            return { embeds: [imageEmbed], files: [file] };
        } catch (error) {
            console.error('Failed to fetch combined image for menu items:', error);
        }
    }
}

export async function constructMenuEmbed(menuProvider: MenuItemsProvider, commandData: {
    title: string,
    targetDate: Date,
    menuTime: MenuTime
}) {
    const { title, targetDate, menuTime } = commandData;

    const menuItems = await menuProvider.getMenuItemsForDate(menuTime);

    const menuEmbed = new EmbedBuilder()
        .setTitle(`${title} - ${targetDate.toDateString()}`)
        .setDescription(getTranslation('command.menu.response.menu.description'))
        .setColor('#0099ff')
        .setTimestamp()
        .setFooter({ text: menuProvider.getName() })
        .setThumbnail(menuProvider.getProviderThumbnail());

    const allFeatures: Set<MenuItemFeature> = new Set();

    for (const item of menuItems) {
        let itemDescription = "";

        if (item.ingredients.length > 1) {
            itemDescription += item.ingredients.slice(1).map(i => i.name).join(', ');
        }

        if (itemDescription === '') itemDescription = getTranslation('command.menu.response.menu.noIngredientsDescription');

        const features: Set<MenuItemFeature> = new Set();
        for (const ingredient of item.ingredients) {
            for (const feature of ingredient.features) {
                features.add(feature);
                allFeatures.add(feature);
            }
        }
        if (features.size > 0) {
            itemDescription += "\n" + Array.from(features).map(f => f.shortId).join(', ');
        }

        let title = '';
        if (item.ingredients.length > 0) {
            title += `${item.ingredients[0].name}`;
        }
        title += " (" + (item.name ?? getTranslation('command.menu.response.menu.noMenuName')) + ")";
        if (item.price && item.unit) {
            title += ` - ${item.price}`;
            if (item.unit !== 'Portion') title += ` ${item.unit}`;
        }
        menuEmbed.addFields([
            { name: title, value: itemDescription, inline: false }
        ]);
    }

    if (allFeatures.size !== 0) {
        const ingredientsEmbedContent = {
            name: getTranslation('command.menu.response.menu.ingredients'),
            value: Array.from(allFeatures).map(f => f.shortId + ': ' + f.name).join(', '),
            inline: false
        };
        menuEmbed.addFields([ingredientsEmbedContent]);
    } else {
        console.log('No features found');
    }

    return { menuEmbed, menuItems };
}

function parseCommand(interaction: CommandInteraction): { title: string, targetDate: Date, menuTime: MenuTime } {
    let targetDate = new Date();
    // @ts-ignore
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === getTranslation('command.menu.options.today.name')) {
        targetDate = new Date();
    } else if (subcommand === getTranslation('command.menu.options.tomorrow.name')) {
        targetDate.setDate(targetDate.getDate() + 1);
    } else if (subcommand === getTranslation('command.menu.options.overmorrow.name')) {
        targetDate.setDate(targetDate.getDate() + 2);
    } else if (subcommand === getTranslation('command.menu.options.monday.name')) {
        targetDate.setDate(targetDate.getDate() + (1 + 7 - targetDate.getDay()) % 7);
    } else if (subcommand === getTranslation('command.menu.options.tuesday.name')) {
        targetDate.setDate(targetDate.getDate() + (2 + 7 - targetDate.getDay()) % 7);
    } else if (subcommand === getTranslation('command.menu.options.wednesday.name')) {
        targetDate.setDate(targetDate.getDate() + (3 + 7 - targetDate.getDay()) % 7);
    } else if (subcommand === getTranslation('command.menu.options.thursday.name')) {
        targetDate.setDate(targetDate.getDate() + (4 + 7 - targetDate.getDay()) % 7);
    } else if (subcommand === getTranslation('command.menu.options.friday.name')) {
        targetDate.setDate(targetDate.getDate() + (5 + 7 - targetDate.getDay()) % 7);
    }

    let title = 'Today\'s Menu';
    if (subcommand === getTranslation('command.menu.options.tomorrow.name')) {
        title = getTranslation('command.menu.options.tomorrow.description')
    } else if (subcommand === getTranslation('command.menu.options.overmorrow.name')) {
        title = getTranslation('command.menu.options.overmorrow.description')
    } else if (subcommand === getTranslation('command.menu.options.monday.name')) {
        title = getTranslation('command.menu.options.monday.description');
    } else if (subcommand === getTranslation('command.menu.options.tuesday.name')) {
        title = getTranslation('command.menu.options.tuesday.description');
    } else if (subcommand === getTranslation('command.menu.options.wednesday.name')) {
        title = getTranslation('command.menu.options.wednesday.description');
    } else if (subcommand === getTranslation('command.menu.options.thursday.name')) {
        title = getTranslation('command.menu.options.thursday.description');
    } else if (subcommand === getTranslation('command.menu.options.friday.name')) {
        title = getTranslation('command.menu.options.friday.description');
    }

    return {
        title,
        targetDate,
        menuTime: {
            year: targetDate.getFullYear(),
            month: targetDate.getMonth() + 1,
            day: targetDate.getDate(),
        },
    };
}


async function writeCanvasToFile(canvas: Canvas, filePath: string): Promise<void> {
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filePath, buffer);
}

async function createCombinedImage(imageSearch: ImageSearch, imageQueries: string[], desiredHeight: number): Promise<Canvas> {
    try {
        const imageUrls: string[] = [];

        for (const query of imageQueries) {
            const fetchedImages = await imageSearch.searchImages(query);
            const filteredImages = fetchedImages
                .filter((i: any) => typeof i === 'string')
                .filter((i: string) => i.startsWith('https://') || i.startsWith('http://'));

            if (filteredImages.length > 0) {
                const maxImages = 1;
                const selectedImages = filteredImages.slice(0, Math.min(filteredImages.length, maxImages));
                const imageUrl = selectedImages[Math.floor(Math.random() * selectedImages.length)];
                console.log('Fetching image for', query, selectedImages.length, imageUrl);
                imageUrls.push(imageUrl);
            } else {
                console.warn('No image found for query:', query, fetchedImages);
            }
        }

        if (imageUrls.length === 0) {
            console.warn('No images found for any query:', imageQueries);
            return createCanvas(1, 1);
        }

        const loadedImages: Image[] = await Promise.all(imageUrls.map(loadImage));

        const aspectRatios = loadedImages.map(img => img.width / img.height);
        const totalWidth = aspectRatios.reduce((sum, ratio) => sum + ratio * desiredHeight, 0);

        const canvas: Canvas = createCanvas(totalWidth, desiredHeight);
        const ctx = canvas.getContext('2d');

        let currentX = 0;
        for (const [index, img] of loadedImages.entries()) {
            const width = aspectRatios[index] * desiredHeight;
            ctx.drawImage(img, currentX, 0, width, desiredHeight);
            currentX += width;
        }

        return canvas;
    } catch (error) {
        console.error('Failed to create combined image:', error);
        throw error;
    }
}
