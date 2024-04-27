import axios from 'axios';
import { JSDOM } from 'jsdom';

export async function performGetAndParseHtml(url: string): Promise<JSDOM> {
    try {
        const response = await axios.get(url);
        const html = response.data;
        return new JSDOM(html);
    } catch (error) {
        console.error(error);
        throw new Error(`Could not load or parse the URL: ${url}`);
    }
}

export async function performPostAndParseHtml(url: string, data: any, headers: any = {}): Promise<JSDOM> {
    try {
        const defaultHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
            ...headers
        };

        const response = await axios.post(url, data, { headers: defaultHeaders });
        const html = response.data;

        return new JSDOM(html);
    } catch (error) {
        console.error(error);
        throw new Error(`Could not load or parse the URL: ${url}`);
    }
}
