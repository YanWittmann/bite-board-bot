import { AvailableMenuProviders } from "../../BiteBoardBot.js";

export interface MenuTime {
    year: number;
    month: number;
    day: number;
}

export function matchesMenuTime(a: MenuTime, b: MenuTime): boolean {
    return a.year === b.year && a.month === b.month && a.day === b.day;
}

export class MenuItemFeature {
    shortId: string;
    name: string;
    type: string;

    constructor(id: string, name: string, type: string) {
        this.shortId = id;
        this.name = name;
        this.type = type;
    }
}

export class MenuItemIngredient {
    name: string;
    features: MenuItemFeature[] = [];

    constructor(name: string) {
        this.name = name;
    }
}

export class MenuItem {
    name: string | undefined;
    menuTime: MenuTime;
    ingredients: MenuItemIngredient[] = [];
    ingredientsString: string | undefined;
    price: string | undefined;
    unit: string | undefined;
    shouldFetchImages: boolean = true;

    constructor(menuTime: MenuTime) {
        this.menuTime = menuTime;
    }
}

export abstract class MenuItemsProvider {
    abstract getName(): string;

    abstract getDisplayMenuLink(): string;

    abstract getProviderThumbnail(): string;

    abstract getMenuItemsForDate(date: MenuTime): Promise<MenuItem[]>;

    public register(registeredProviders: AvailableMenuProviders) {
        console.log(`Registering provider: ${this.getName()} as ${this.constructor.name} (${this.getDisplayMenuLink()})`);
        registeredProviders[this.getName()] = this;
    }

    toMdString(): string {
        return '[' + this.getName() + '](<' + this.getDisplayMenuLink() + '>)'
    }
}
