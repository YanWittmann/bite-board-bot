# Bite Board-Bot

```
 ____   _  _            ____                           _    ____          _
| __ ) (_)| |_   ___   | __ )   ___    __ _  _ __   __| |  | __ )   ___  | |_
|  _ \ | || __| / _ \==|  _ \  / _ \  / _` || '__| / _` |==|  _ \  / _ \ | __|
| |_) || || |_ |  __/==| |_) || (_) || (_| || |   | (_| |==| |_) || (_) || |_
|____/ |_| \__| \___|  |____/  \___/  \__,_||_|    \__,_|  |____/  \___/  \__|
```

A Discord bot that allows for creating custom Menu Providers that can then fetch the menu for a specific day from a
specific canteen or other food location.

<img alt="Example Menu output" height="600" src="img/discord-bot-example-output-1.png"/>

<!-- TOC -->

* [Installation](#installation)
* [Setup](#setup)
    * [Configuration](#configuration)
    * [Inviting the bot to your server](#inviting-the-bot-to-your-server)
* [Usage](#usage)
    * [User commands](#user-commands)
    * [Scheduled Fetching](#scheduled-fetching)
* [Creating a Menu Provider](#creating-a-menu-provider)

<!-- TOC -->

## Installation

Note that using version 22.0.0 of Node.js does not yet work, since the `canvas` package does not support it, which is
needed to generate the preview images for the menu items.

```batch
git clone https://github.com/YanWittmann/bite-board-bot
cd bite-board-bot
npm install
npm run build
# make sure to configure the bot before running it
npm run start
```

## Setup

### Configuration

Before being able to run the bot for the first time, you need to configure the bot.
For this, copy the [bite-board-config-template.json](bite-board-config-template.json) file into a new file called
[bite-board-config.json](bite-board-config.json) and configure the values inside according to the following
instructions.

If you need to change the path to the configuration file, you can do so by setting a `BITE_BOARD_CONFIG_PATH`
environment variable in your process.

#### token / clientId

The token is the bot token you get from the [Discord Developer Portal](https://discord.com/developers/applications).
For this, you will need to create a new application and a bot user for it.
There are plenty of tutorials on how to do this on the internet already.

- The `clientId` is the client ID of the bot, which you can find under the **OAuth2** tab of your bot in the portal.
- The `token` is the token of the bot, which you can find under the **Bot** tab of your bot in the portal.

#### dataStoragePath

Is a path to a JSON file that will contain data the bot needs to store, such as user settings and periodic tasks.
This file will be created if it does not exist yet.
The default is a file `bot-data.json` in the root directory of the bot.

#### mensaMenuImagePreviewService

This can be either `none`, `googleApi` or `googleImages`.
Depending on the value, the bot will use a different service to fetch images for the menu embeds or not fetch any images
at all.

- `none`: No images will be fetched.
- `googleApi`: The Google Image API will be used to fetch images, see parameters below. Up to 100 images can be fetched
  per day for free, after that you will need to pay for the service.
- `googleImages`: Google Images will be used to fetch images. This is free and the image quality is better than the API
  (in my opinion), although the resolution is (much) lower.

#### googleImageApiKey / googleImageApiApplicationId

The Google Image API key and application ID are used to fetch images for the menu embeds.
You can get them from the [Google Cloud Console](https://console.cloud.google.com/).
Configure `googleApi` for `mensaMenuImagePreviewService` to use the Google Image API.

> Honestly, this is not worth it. The images from the API are just so much worse that the ones from the Google Images
> search. I recommend just using the Google Images search.

#### language

The language the bot should use for the menu embeds. Currently, `en` and `de` are supported.
If you need to add your own language, you can do so by adding a new JSON file to the [lang](lang) directory.
The [TranslationProvider.ts](src/service/TranslationProvider.ts) class will automatically pick up the new language file
under the name of the file.

#### deleteImagesAfter

The time in milliseconds after which the bot should delete the images it fetched for the menu embeds.
The default is _86400000 ms_, which is _24 hours_.
Note that the bot needs to be running continuously for this to work, since timeouts are used internally for this.

### Inviting the bot to your server

To invite the bot to your server, you need to create an invitation link.
You can do that on the **OAuth2** tab of your bot in the
[Discord Developer Portal](https://discord.com/developers/applications) as well.
Make sure to allow the following permissions (at least):

![Invite the bot to your server](img/discord-bot-invitation.png)

## Usage

This bot can fetch menus in two modes: triggered by a user command and scheduled periodic fetching.

### User commands

The bot provides a `/menu` command that allows users to retrieve the menu for specific days or meals from supported menu
providers.
Use it, followed by a subcommand specifying the date for which you want to see the menu.
Depending on your language, use the appropriate subcommands.

```
/menu today     | /menu heute
/menu tomorrow  | /menu morgen
/menu monday    | /menu montag
/menu tuesday   | /menu dienstag
/menu wednesday | /menu mittwoch
/menu thursday  | /menu donnerstag
/menu friday    | /menu freitag
```

If configured, the bot will fetch images for relevant menu items and display them alongside the menu.
You may want to specify your preferred provider for the menu by using the `/settingsmenu provider` command.

### Scheduled Fetching

In addition to user-triggered commands, the bot also supports scheduled periodic fetching of menus from configured
providers.
This feature allows the bot to automatically post menu information at regular intervals, removing the need to manually
request it each day.

To create a scheduled fetch, your user needs to have the `periodic` role.
For security reasons, roles can only be changed by editing the `bot-data.json` file directly.
In the `users` object, add a new key with your Discord tag (not `id#number` format or the `userId`) and set the
`roles` array to include `periodic`.

Then, run the following command in the Discord channel where you want the menu to be posted.
Note that the `time` parameter is in UTC, meaning you will have to calculate based on your timezone.
You can also use the `/settingsmenu time` command to get the current UTC time as reference.
In order to be able to post the menu for the next day(s), you can set an `add` time in minutes that will add the given
amount of minutes to the current time before determining the day for which to fetch the menu.

```
/settingsmenu schedule time:14:00:00 provider:Hochschule Mannheim add:900
```

Your JSON bot data could look like this afterward:

```json
{
  "users": {
    "username-here": {
      "roles": [
        "periodic"
      ]
    }
  },
  "sendDailyMenuInto": {
    "channel-id-here": {
      "time": "14:00:00",
      "provider": "Hochschule Mannheim",
      "addTime": 900
    }
  }
}
```

## Creating a Menu Provider

To create a new menu provider, you need to create a new class that extends the
[MenuItemsProvider](src/service/menu/MenuTypes.ts) class.
See the
[HochschuleMannheimTagessichtMenuProvider](src/service/menu/providers/HochschuleMannheimTagessichtMenuProvider.ts)
for an example.

In there, you will need to implement a `async getMenuItemsForDate(date: MenuTime): Promise<MenuItem[]>` method that
returns the menu items for a given date.
After finishing it, you need to register your provider in the [index.ts](src/index.ts) file by passing an instance into
the [BiteBoardBot](src/BiteBoardBot.ts) constructor.
