import fs from 'fs';

const langDir = 'lang';
const languages: { [key: string]: any } = {};

export const setupLanguages = () => {
    const files = fs.readdirSync(langDir);
    for (const file of files) {
        if (file.endsWith('.json')) {
            const lang = file.replace('.json', '');
            languages[lang] = JSON.parse(fs.readFileSync(`${langDir}/${file}`, 'utf8'));
        }
    }
};

export const setLang = (lang: string) => {
    // @ts-ignore
    if (!languages[lang]) {
        throw new Error(`Language [${lang}] not supported, available languages: [${Object.keys(languages).join(', ')}]`);
    }
    currentLanguage = lang;
};

export const getLang = () => {
    return currentLanguage;
};

export const getTranslation = (key: string) => {
    const keys = key.split('.');
    // @ts-ignore
    let translation = languages[currentLanguage];

    for (const k of keys) {
        translation = translation[k];
        if (!translation) {
            return key;
        }
    }

    return translation;
};

// {0} {1} {2} {3} {4} {5} {6} {7} {8} {9}...
export const fillTranslation = (key: string, ...args: string[]) => {
    let translation = getTranslation(key);

    for (let i = 0; i < args.length; i++) {
        translation = translation.replace(`{${i}}`, args[i]);
    }

    return translation;
}

let currentLanguage = 'en';
