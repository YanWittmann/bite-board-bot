import { RequestInfo, RequestInit } from "node-fetch";

const fetch = (url: RequestInfo, init?: RequestInit) =>  import("node-fetch").then(({ default: fetch }) => fetch(url, init));

export abstract class ImageSearch {
    public abstract searchImages(query: string): Promise<string[]>;

    public async fetchImageByUrl(url: string): Promise<Blob> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        return response.blob();
    }

    public abstract preferredImageDisplayMode(): "separate" | "combined";
}


export class GoogleImagePageSearch extends ImageSearch {

    constructor() {
        super();
    }

    public async searchImages(query: string): Promise<string[]> {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://www.google.com/search?tbm=isch&q=${encodedQuery}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:25.0) Gecko/20100101 Firefox/25.0',
                    'Referer': 'http://www.google.com',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const html = await response.text();
            const imgUrls: string[] = [];

            const imgRegex = /<img[^>]+src="?([^"\s]+)"?\s*\/>/g;
            let match;
            while ((match = imgRegex.exec(html))) {
                imgUrls.push(match[1]);
            }

            return imgUrls;
        } catch (error) {
            console.error('Error fetching image URLs:', error);
            return [];
        }
    }

    preferredImageDisplayMode(): "separate" | "combined" {
        return "combined";
    }
}

export class GoogleImageApiSearch extends ImageSearch {
    private readonly apiKey: string;
    private readonly applicationId: string;

    constructor(apiKey: string, applicationId: string) {
        super();
        this.apiKey = apiKey;
        this.applicationId = applicationId;
    }

    public async searchImages(query: string): Promise<string[]> {
        // https://www.googleapis.com/customsearch/v1?key=&cx=&q=
        // https://developers.google.com/custom-search/v1/using_rest
        // https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list
        // https://programmablesearchengine.google.com/controlpanel/all
        const url = `https://www.googleapis.com/customsearch/v1?key=${this.apiKey}&cx=${this.applicationId}&q=${encodeURIComponent(query)}&searchType=image&imgType=photo`;
        const response = await fetch(url);
        const json = await response.json() as any;
        try {
            const attempt1 = json.items
                .map((item: any) => {
                    const pagemap = item.pagemap || {};
                    const cse_image = pagemap.cse_image || [];
                    if (cse_image.length > 0 && cse_image[0].src) {
                        return cse_image[0].src;
                    }
                    return '';
                }).filter((url: string) => url !== '' && url !== undefined);

            const attempt2 = json.items
                .map((item: any) => {
                    return item.link;
                }).filter((url: string) => url !== '' && url !== undefined);

            if (attempt1.length > 0) return attempt1;
            if (attempt2.length > 0) return attempt2;
        } catch (e) {
            console.error('Failed to parse image search response', e);
            console.log('Image search response:', json)
            return [];
        }

        return [];
    }

    preferredImageDisplayMode(): "separate" | "combined" {
        return "separate";
    }
}

export class DummyImageSearch extends ImageSearch {
    public async searchImages(query: string): Promise<string[]> {
        return [
            'http://s7d2.scene7.com/is/image/Caterpillar/CM20131112-34116-31362',
            'https://s7d2.scene7.com/is/image/Caterpillar/CM20240119-3c729-9887a',
            'http://s7d2.scene7.com/is/image/Caterpillar/CM20131112-34116-31362',
            'https://www.catphones.com/wp-content/uploads/2023/04/IMG-1.png',
            'https://s7d4.scene7.com/is/image/WolverineWorldWide/logo-persistent_Cat?fmt=png-alpha&hei=300&wid=300',
            'https://cdn.britannica.com/34/235834-050-C5843610/two-different-breeds-of-cats-side-by-side-outdoors-in-the-garden.jpg',
            'https://www.ohchr.org/sites/default/files/2021-07/Honduras-55300969-EPA.jpg',
            'https://scontent-atl3-2.cdninstagram.com/v/t51.2885-19/68763591_384685372220491_3522731321480708096_n.jpg?stp=dst-jpg_s100x100&_nc_cat=111&ccb=1-7&_nc_sid=3fd06f&_nc_ohc=FgldT7Fr9KkAb45FgES&_nc_ht=scontent-atl3-2.cdninstagram.com&oh=00_AfCm3wltmmYQ8GimWNFtFkHlx0HdWQNXKD6Vfk2eajz7mw&oe=661373EA',
            'https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=100044470298052'
        ];
    }

    preferredImageDisplayMode(): "separate" | "combined" {
        return "separate";
    }
}

export function createImageSearchFromJson(json: any): ImageSearch {
    if (json.mensaMenuImagePreviewService === 'googlePage') {
        return new GoogleImagePageSearch();
    } else if (json.mensaMenuImagePreviewService === 'googleApi') {
        if (json.googleImageApiKey && json.googleImageApiApplicationId) {
            return new GoogleImageApiSearch(json.googleImageApiKey, json.googleImageApiApplicationId);
        } else {
            console.warn('No valid Google API image search configuration found, using dummy image search. Required fields: googleImageApiKey, googleImageApiApplicationId');
            return new DummyImageSearch();
        }
    } else if (json.mensaMenuImagePreviewService !== 'none') {
        console.warn('No valid image search configuration found, using dummy image search');
    }
    return new DummyImageSearch();
}
