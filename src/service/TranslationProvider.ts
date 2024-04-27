import en from '../lang/en.json' assert { type: 'json' };
import de from '../lang/de.json' assert { type: 'json' };

const languages = {
    en: en,
    de: de,
};

export const setLang = (lang: string) => {
    // @ts-ignore
    if (!languages[lang]) {
        throw new Error(`Language ${lang} not supported, available languages: ${Object.keys(languages).join(', ')}`);
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
