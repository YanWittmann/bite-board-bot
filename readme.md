## Bite Board-Bot

A Discord bot that allows for creating custom Menu Providers that can then fetch the menu for a specific day from a
specific canteen or other food location.

### Installation

```batch
git clone https://github.com/YanWittmann/bite-board-bot
cd bite-board-bot
npm install
npm run build
npm run start
```

### Configuration

Inside the [discord-bot-config.json](src/discord-bot-config.json) file, you need to configure the following values:

#### token / clientId

The token is the bot token you get from the [Discord Developer Portal](https://discord.com/developers/applications).
The clientId is the client ID of the bot.

#### dataStoragePath

Is a path to a JSON file that will contain data the bot needs to store, such as user settings and periodic tasks.

#### googleImageApiKey / googleImageApiApplicationId

The Google Image API key and application ID are used to fetch images for the menu embeds.
You can get them from the [Google Cloud Console](https://console.cloud.google.com/).
Configure `googleApi` for `mensaMenuImagePreviewService` to use the Google Image API.

> Honestly, this is not worth it. The images from the API are just so much worse that the ones from the Google Images
> search. I recommend just using the Google Images search.

#### mensaMenuImagePreviewService

This can be either `none`, `googleApi` or `googleImages`.
Depending on the value, the bot will use a different service to fetch images for the menu embeds or not fetch any images
at all.

#### language

The language the bot should use for the menu embeds. Currently, `en` and `de` are supported.
If you need to add your own language, you can do so by adding a new JSON file to the [lang](src/lang) directory and
adding a new value to the map in [TranslationProvider.ts](src/service/TranslationProvider.ts).

#### deleteImagesAfter

The time in milliseconds after which the bot should delete the images it fetched for the menu embeds.
The default is 1800000 ms, which is 30 minutes.

### Usage

TODO.
