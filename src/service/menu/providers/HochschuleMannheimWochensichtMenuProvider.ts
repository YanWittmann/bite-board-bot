import {
    matchesMenuTime,
    MenuItem,
    MenuItemFeature,
    MenuItemIngredient,
    MenuItemsProvider,
    MenuTime
} from "../MenuTypes.js";
import { JSDOM } from "jsdom";
import { performGetAndParseHtml } from "../../SiteFetcher.js";

export class HochschuleMannheimWochensichtMenuProvider extends MenuItemsProvider {

    getName(): string {
        return "Hochschule Mannheim (Wochenansicht)";
    }

    getDisplayMenuLink(): string {
        return "https://www.stw-ma.de/Essen+_+Trinken/Speisepl%C3%A4ne/Hochschule+Mannheim.html";
    }

    public getProviderThumbnail(): string {
        return "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQPpP_niFgiON6iSyRENQKGY2VdVsccUg2nI45u2N1L2Q&s";
    }

    async getMenuItemsForDate(date: MenuTime): Promise<MenuItem[]> {
        try {
            return performGetAndParseHtml(this.constructURL(date)).then((dom: JSDOM) => {
                const items = this.parseMenuItems(dom, date);
                return items.filter(item => matchesMenuTime(item.menuTime, date));
            });
        } catch (error) {
            console.error(error);
            throw new Error(`Could not load or parse the menu for the given date: ${date}`);
        }
    }

    private constructURL(date: MenuTime): string {
        const formattedDate = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
        return `https://www.stw-ma.de/Essen+_+Trinken/Speisepl%C3%A4ne/Hochschule+Mannheim-date-${encodeURIComponent(formattedDate)}-view-week.html`;
    }

    private parseMenuItemFeatures(dom: JSDOM): MenuItemFeature[] {
        const features: MenuItemFeature[] = [];
        const document = dom.window.document;
        const legend = document.querySelector('#legend');

        if (!legend) return features;

        let currentType = '';
        Array.from(legend.children).forEach(child => {
            if (child.nodeType === 1) { // Element node
                const element = child as Element;
                if (element.tagName === 'B' && element.classList.contains('t')) {
                    // <b class="t"> element
                    currentType = element.textContent?.trim().replace(':', '') ?? '';
                } else if (element.tagName === 'SPAN') {
                    const id = element.querySelector('sup b')?.textContent?.trim() ?? '';
                    const name = element.childNodes[2]?.nodeValue?.trim() ?? '';
                    if (id && name) {
                        features.push(new MenuItemFeature(id, name, currentType));
                    }
                }
            }
        });

        return features;
    }

    private parseMenuItems(dom: JSDOM, queryDate: MenuTime): MenuItem[] {
        console.log(dom.window.document.querySelector('title')?.textContent);

        const menuItemFeatures = this.parseMenuItemFeatures(dom);

        const menuItems: MenuItem[] = [];

        const document = dom.window.document;
        const rows = document.querySelectorAll("#previewTable tr");

        const menuNames: string[] = Array.from(rows[0].querySelectorAll("th:not(.first)")).map(th => th.textContent?.trim() ?? "");

        const menuRows = document.querySelectorAll("#previewTable tr.active1");
        const priceRows = document.querySelectorAll("#previewTable tr.active2");

        let currentIndex = 0;
        while (currentIndex < menuRows.length) {
            const menuRow = menuRows[currentIndex];
            const priceRow = priceRows[currentIndex];

            if (!menuRow || !priceRow) break;

            const dateCell = menuRow.querySelector("td.first");
            if (!dateCell) {
                console.warn("Date cell not found for menu item");
                currentIndex += 1;
                continue;
            }

            const weekdayText = dateCell.textContent?.trim() || '';
            const menuDate = this.calculateMenuDate(weekdayText, queryDate);

            const prices = priceRow.querySelectorAll("div > span.label.label-default");

            const menuDescriptions = menuRow.querySelectorAll("td:not(.first)");
            menuDescriptions.forEach((desc, index) => {
                const menuItem = new MenuItem(menuDate);

                // find the menu name for the current index
                menuItem.name = menuNames[index];
                if (["Salatbuffet", "Dessert"].includes(menuItem.name)) {
                    menuItem.shouldFetchImages = false;
                }

                // Hackfleischbällchen (Gl,S), Gemüse-Arrabbiata-Soße (1,3,9,Sw,Sl,Vga), Langkornreis (Vga), frische Kräuter (Vga), Beilagensalat (Vga)
                const descriptionText = desc.textContent?.trim();
                menuItem.ingredientsString = descriptionText;

                const components = descriptionText?.split(", ") || [];
                components.forEach(component => {
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

                // prices are split into 2 elements per menu item
                // <span class="label label-default">3,00 €</span>
                // <span class="label labelNoBgr label-default">Portion</span>
                const priceCell = prices[index * 2];
                if (!priceCell) {
                    console.warn("Price cell not found for menu item", descriptionText);
                    return;
                }
                menuItem.price = priceCell.textContent?.trim() || "";
                const unitCell = prices[index * 2 + 1];
                if (!unitCell) {
                    console.warn("Unit cell not found for menu item", descriptionText);
                    return;
                }
                menuItem.unit = unitCell.textContent?.trim() || "";

                menuItems.push(menuItem);

                // console.log(`Menu Item ${index}: ${menuItem.description}, ${menuItem.price} ${menuItem.unit}, ${menuItem.ingredients.map(i => i.name + " (" + i.features.map(f => f.name).join(", ") + ")").join(", ")}`);
            });

            currentIndex += 1;
        }

        return menuItems;
    }

    private calculateMenuDate(weekdayText: string, queryDate: MenuTime): MenuTime {
        const weekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
        const queryDateObj = new Date(queryDate.year, queryDate.month - 1, queryDate.day);
        const queryWeekday = queryDateObj.getDay();

        const menuWeekdayIndex = weekdays.indexOf(weekdayText);
        if (menuWeekdayIndex === -1) return queryDate; // queryDate if weekdayText is not valid

        const dayDifference = menuWeekdayIndex - queryWeekday;
        queryDateObj.setDate(queryDateObj.getDate() + dayDifference);

        return {
            year: queryDateObj.getFullYear(),
            month: queryDateObj.getMonth() + 1,
            day: queryDateObj.getDate()
        };
    }
}