export class ApplicationStateLogger {
    public ApplicationStateLogger() {
    }

    private readonly Reset = "\x1b[0m"
    private readonly Bright = "\x1b[1m"
    private readonly Dim = "\x1b[2m"
    private readonly Underscore = "\x1b[4m"
    private readonly Blink = "\x1b[5m"
    private readonly Reverse = "\x1b[7m"
    private readonly Hidden = "\x1b[8m"

    private readonly FgBlack = "\x1b[30m"
    private readonly FgRed = "\x1b[31m"
    private readonly FgGreen = "\x1b[32m"
    private readonly FgYellow = "\x1b[33m"
    private readonly FgBlue = "\x1b[34m"
    private readonly FgMagenta = "\x1b[35m"
    private readonly FgCyan = "\x1b[36m"
    private readonly FgWhite = "\x1b[37m"
    private readonly FgGray = "\x1b[90m"

    private readonly FgBrightBlack = "\x1b[90m"
    private readonly FgBrightRed = "\x1b[91m"
    private readonly FgBrightGreen = "\x1b[92m"
    private readonly FgBrightYellow = "\x1b[93m"
    private readonly FgBrightBlue = "\x1b[94m"
    private readonly FgBrightMagenta = "\x1b[95m"
    private readonly FgBrightCyan = "\x1b[96m"
    private readonly FgBrightWhite = "\x1b[97m"

    private readonly BgBlack = "\x1b[40m"
    private readonly BgRed = "\x1b[41m"
    private readonly BgGreen = "\x1b[42m"
    private readonly BgYellow = "\x1b[43m"
    private readonly BgBlue = "\x1b[44m"
    private readonly BgMagenta = "\x1b[45m"
    private readonly BgCyan = "\x1b[46m"
    private readonly BgWhite = "\x1b[47m"
    private readonly BgGray = "\x1b[100m"

    public applicationIntroduction() {
        /*
  ____   _  _            ____                           _    ____          _
 | __ ) (_)| |_   ___   | __ )   ___    __ _  _ __   __| |  | __ )   ___  | |_
 |  _ \ | || __| / _ \==|  _ \  / _ \  / _` || '__| / _` |==|  _ \  / _ \ | __|
 | |_) || || |_ |  __/==| |_) || (_) || (_| || |   | (_| |==| |_) || (_) || |_
 |____/ |_| \__| \___|  |____/  \___/  \__,_||_|    \__,_|  |____/  \___/  \__|
         */

        const segments = [
            [
                '  ____   _  _         ',
                ' | __ ) (_)| |_   ___ ',
                ' |  _ \\ | || __| / _ \\',
                ' | |_) || || |_ |  __/',
                ' |____/ |_| \\__| \\___|',
            ],
            [
                '  ',
                '  ',
                '==',
                '==',
                '  ',
            ],
            [
                ' ____                           _ ',
                '| __ )   ___    __ _  _ __   __| |',
                '|  _ \\  / _ \\  / _` || \'__| / _` |',
                '| |_) || (_) || (_| || |   | (_| |',
                '|____/  \\___/  \\__,_||_|    \\__,_|',
            ],
            [
                '  ',
                '  ',
                '==',
                '==',
                '  ',
            ],
            [
                ' ____          _',
                '| __ )   ___  | |_',
                '|  _ \\  / _ \\ | __|',
                '| |_) || (_) || |_',
                '|____/  \\___/  \\__|',
            ]
        ]
        const segmentColors = [
            this.FgBrightCyan,
            this.FgBrightWhite,
            this.FgBrightCyan,
            this.FgBrightWhite,
            this.FgCyan,
        ];

        for (let i = 0; i < segments[0].length; i++) {
            let line = '';
            for (let j = 0; j < segments.length; j++) {
                line += segmentColors[j] + segments[j][i];
            }
            console.log(line);
        }

        console.log(this.Reset);
        console.log(`  Version: ${process.env.npm_package_version}`);
        console.log();
        console.log('Setting up application...');
    }

    public logSetupStep(step:
                            'parseLang' | 'parseConfig' | 'parseDataFile' | 'registerMenuProviders' |
                            'createImageSearcher' | 'setLanguage' | 'setupCommandInteractions' |
                            'constructCommands' | 'registerCommandsForBotAtDiscord',
                        additionalInfo: string[] = []) {
        let msg = '';
        if (step === 'parseLang') {
            msg = 'Loading language translation files';
        } else if (step === 'parseConfig') {
            msg = 'Loading configuration from ' + additionalInfo[0];
        } else if (step === 'parseDataFile') {
            msg = 'Loading bot data file from ' + additionalInfo[0];
        } else if (step === 'registerMenuProviders') {
            msg = 'Registering menu providers';
        } else if (step === 'createImageSearcher') {
            msg = 'Creating image searcher for service ' + additionalInfo[0];
        } else if (step === 'setLanguage') {
            msg = 'Setting language to ' + additionalInfo[0];
        } else if (step === 'setupCommandInteractions') {
            msg = 'Setting up command listener';
        } else if (step === 'constructCommands') {
            msg = 'Constructing command instances';
        } else if (step === 'registerCommandsForBotAtDiscord') {
            msg = 'Registering bot commands at Discord via REST API';
        }
        console.log(' - ' + this.FgBrightCyan + msg + this.Reset);
    }

    public logSetupComplete(botTag: string) {
        console.log();
        console.log(this.FgBrightGreen + 'Setup complete, Discord bot is ready!\nLogged in as', this.FgGreen + botTag + this.Reset);
        console.log();
    }

    public logExitCode(exitCode: number) {
        if (exitCode === 0) {
            console.log(this.FgBrightGreen + 'Exiting with code ' + exitCode + this.Reset);
        } else {
            console.log(this.FgBrightRed + ' --> A fatal error occurred and the application will now exit with ' + this.Underscore + this.FgMagenta + 'code ' + exitCode + this.Reset);
        }
        console.log()
    }

    public exitWithError(error: string, exitCode: number, errorObject: any | null = null) {
        error = error.replace(/\[(.*?)]/g, this.FgRed + '$1' + this.Reset + this.FgBrightRed);
        console.log();
        console.log(this.FgBrightRed + ' --> A fatal error occurred and the application will now exit with ' + this.Underscore + this.FgMagenta + 'code ' + exitCode + this.Reset);
        console.log(this.FgBrightRed + '     ' + error + this.Reset);

        if (errorObject) {
            console.log();
            console.log(errorObject);
        }

        process.exit(exitCode);
    }
}