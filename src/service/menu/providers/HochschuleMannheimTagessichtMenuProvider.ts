import {
    matchesMenuTime,
    MenuItem,
    MenuItemFeature,
    MenuItemIngredient,
    MenuItemsProvider,
    MenuTime
} from "../MenuTypes.js";
import { performPostAndParseHtml } from "../../SiteFetcher.js";
import { JSDOM } from "jsdom";

export class HochschuleMannheimTagessichtMenuProvider extends MenuItemsProvider {

    getName(): string {
        return "Hochschule Mannheim";
    }

    getDisplayMenuLink(): string {
        return "https://www.stw-ma.de/Essen+_+Trinken/Speisepl%C3%A4ne/Hochschule+Mannheim.html";
    }

    getProviderThumbnail(): string {
        return "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQPpP_niFgiON6iSyRENQKGY2VdVsccUg2nI45u2N1L2Q&s";
    }

    async getMenuItemsForDate(date: MenuTime): Promise<MenuItem[]> {
        try {
            return performPostAndParseHtml(
                'https://www.stw-ma.de/Essen+_+Trinken/Speisepl%C3%A4ne/Hochschule+Mannheim.html',
                {
                    day: `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`,
                }, {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'de',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Upgrade-Insecure-Requests': '1',
                }
            ).then(dom => {
                const items = this.parseMenuItems(dom, date);
                return items.filter(item => matchesMenuTime(item.menuTime, date));
            })
        } catch (error) {
            console.error(error);
            throw new Error(`Could not load or parse the menu for the given date: ${date}`);
        }
    }

    private parseMenuItems(dom: JSDOM, queryDate: MenuTime): MenuItem[] {
        console.log(dom.window.document.querySelector('title')?.textContent);

        const menuItemFeatures = this.parseMenuItemFeatures(dom);

        const menuItems: MenuItem[] = [];

        const document = dom.window.document;
        const rows = document.querySelectorAll(".speiseplan-table tr");

        for (const row of rows) {
            const menuItem = new MenuItem(queryDate);
            menuItems.push(menuItem);

            const menuName = row.querySelector('.speiseplan-table-menu-headline strong')?.textContent?.trim() ?? '';
            const menuDescription = row.querySelector('.speiseplan-table-menu-content')?.textContent?.trim() ?? '';
            const menuPrice = row.querySelector('.speiseplan-table-col-last .price')?.textContent?.trim() ?? '';
            const menuUnit = row.querySelector('.speiseplan-table-col-last .customSelection')?.textContent?.trim() ?? '';

            menuItem.name = menuName;
            menuItem.price = menuPrice;
            menuItem.unit = menuUnit;

            if (["Salatbuffet", "Dessert"].includes(menuItem.name)) {
                menuItem.shouldFetchImages = false;
            }

            menuDescription.split(', ').map(component => {
                // Hackfleischbällchen (Gl,S) -> Hackfleischbällchen
                const name = component.replace(/\([^)]*\)/g, "").trim();
                // Hackfleischbällchen (Gl,S) -> ["Gl", "S"]
                const features = component.match(/\(([^)]*)\)/)?.[1].split(",") || [];

                const ingredient = new MenuItemIngredient(name);
                menuItem.ingredients.push(ingredient);

                features.forEach(feature => {
                    const featureObj = menuItemFeatures.find(f => f.shortId === feature.trim());
                    if (featureObj) {
                        ingredient.features.push(featureObj);
                    } else {
                        console.warn(`Feature not found: ${feature}`);
                    }
                });
            });
        }

        return menuItems;
    }

    private parseMenuItemFeatures(dom: JSDOM): MenuItemFeature[] {
        const document = dom.window.document;

        const features: MenuItemFeature[] = [];
        const featureContainerElements = document.querySelectorAll('.speiseplan-label-content');
        if (featureContainerElements.length === 0) {
            console.warn('No feature container elements found');
            return features;
        }

        // find the one with more nodes, as two are present and one is incomplete
        let featureContainerElement = Array.from(featureContainerElements).sort((a, b) => b.childNodes.length - a.childNodes.length)[0];

        if (featureContainerElement) {
            // iterate over all child nodes and check for either "speiseplan-category" or "speiseplan-label"
            let currentType = '';
            const childNodes = Array.from(featureContainerElement.childNodes);
            for (const child of childNodes) {
                if (child.nodeType === 1) { // Element node
                    const element = child as Element;
                    if (element.classList.contains('speiseplan-category')) {
                        // <b class="speiseplan-category"> element
                        currentType = element.textContent?.trim().replace(':', '') ?? 'Kennzeichen';
                    } else if (element.classList.contains('speiseplan-label')) {
                        const id = element.querySelector('sup b')?.textContent?.trim() ?? '';
                        const name = (element.childNodes[2]?.nodeValue?.trim() || element.childNodes[4]?.nodeValue?.trim()) ?? '';
                        if (id && name) {
                            features.push(new MenuItemFeature(id, name, currentType));
                        } else {
                            console.warn('Could not parse feature', id, name, currentType, 'from', element.outerHTML);
                        }
                    }
                }
            }
        }

        return features;
    }
}