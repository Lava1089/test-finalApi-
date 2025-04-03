"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SatoruScraper = exports.AnimeWorldScraper = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio_1 = require("cheerio");
const cache_1 = require("./config/cache");
const node_fetch_1 = __importDefault(require("node-fetch"));
const website_helpers_1 = require("./utils/website-helpers");

class AnimeWorldScraper {
    baseUrl;
    headers;
    constructor(baseUrl = 'https://anime-world.co') {
        this.baseUrl = baseUrl;
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };
    }

    async createBrowser() {
        throw new Error('Method not implemented.');
    }

    async getAnimeInfo(animeId, cacheConfig) {
        return cache_1.cache.getOrSet(async () => {
            try {
                console.log(`Getting info for anime: ${animeId}`);
                
                // Determine if it's a movie or series from the ID
                const contentType = animeId.includes('movie') ? 'movie' : 'series';
                const path = contentType === 'movie' ? 'movie' : 'series';
                
                // Construct the URL
                const url = `${this.baseUrl}/${path}/${animeId.replace('movie-', '')}`;
                console.log(`Info URL: ${url}`);
                
                const response = await axios_1.default.get(url, {
                    headers: this.headers,
                    timeout: 10000
                });
                
                console.log(`Info response status: ${response.status}`);
                const $ = (0, cheerio_1.load)(response.data);
                
                // Debug HTML structure
                console.log(`Page title: ${$('title').text()}`);
                
                // Try multiple selectors for title
                const title = $('h1, .entry-title, .title, .post-title').first().text().trim() || 
                              $('meta[property="og:title"]').attr('content') ||
                              $('title').text().trim();
                              
                console.log(`Found title: ${title}`);
                
                // Try multiple selectors for image
                const image = $('.poster img, .thumbnail img, .featured-image img').attr('src') ||
                              $('meta[property="og:image"]').attr('content') ||
                              $('.wp-post-image').attr('src') || '';
                              
                console.log(`Found image: ${image}`);
                
                // Try multiple selectors for description
                const description = $('.description, .synopsis, .plot, .entry-content > p, [class*="content"] > p').first().text().trim() ||
                                    $('meta[property="og:description"]').attr('content') || '';
                                    
                console.log(`Found description length: ${description.length} chars`);
                
                // Extract genres - try multiple selectors
                const genres = $('.genres a, .tags a, .categories a, .genre').map((_, el) => $(el).text().trim()).get();
                console.log(`Found genres: ${genres.join(', ')}`);
                
                // Try to extract other metadata
                const releaseDate = $('.released, .year, .date, time, [class*="year"]').first().text().trim() ||
                                    $('.meta').text().match(/(\d{4})/)?.[1] || 'Unknown';
                                    
                console.log(`Found release date: ${releaseDate}`);
                
                // Extract languages from title and description
                const titleText = title + ' ' + description;
                const languages = website_helpers_1.extractLanguages(titleText);
                console.log(`Detected languages: ${languages.join(', ')}`);
                
                return {
                    id: animeId,
                    title,
                    image,
                    description,
                    genres,
                    status: 'Unknown', // Status is often not directly provided
                    type: contentType === 'movie' ? 'Movie' : 'Series',
                    rating: 'N/A',
                    releaseDate,
                    languages,
                    url: url
                };
            } catch (error) {
                console.error('Error getting anime info:', error);
                throw error;
            }
        }, cacheConfig.key, cacheConfig.duration);
    }

    async getEpisodes(contentType, animeId, page, cacheConfig) {
        return cache_1.cache.getOrSet(async () => {
            try {
                console.log(`Getting episodes for ${contentType}/${animeId}`);
                
                // For consistency, use the right path format
                const path = contentType === 'movie' ? 'movie' : 'series';
                
                // Construct URL
                const url = `${this.baseUrl}/${path}/${animeId}`;
                console.log(`Episodes URL: ${url}`);
                
                // Get the anime page
                const response = await axios_1.default.get(url, { 
                    headers: this.headers,
                    timeout: 10000
                });
                
                console.log(`Episodes response status: ${response.status}`);
                const $ = (0, cheerio_1.load)(response.data);
                
                // Debug HTML structure
                console.log(`Page title: ${$('title').text()}`);
                
                const episodes = [];
                
                // Try various episode selectors that might be used on anime-world.co
                const episodeSelectors = [
                    '.episodes-list li', '.episodes li', '.episodios li',
                    '.ep-item', '.episode-item', '.episode', '[class*="episode"]',
                    '.season-list li', '.seasons li', '.temporadas li',
                    '.chapters li', '.capitulos li'
                ];
                
                // Join all selectors
                const combinedSelector = episodeSelectors.join(', ');
                console.log(`Looking for episodes using selectors: ${combinedSelector}`);
                console.log(`Found ${$(combinedSelector).length} potential episode elements`);
                
                // If we find episode elements with the combined selector
                $(combinedSelector).each((i, el) => {
                    try {
                        const $el = $(el);
                        
                        // Try to find the episode number
                        let episodeNumber = $el.find('.number, .num, .ep-num').text().trim() || 
                                           $el.text().match(/(?:Episode|Ep|E)\s*(\d+)/i)?.[1] || 
                                           (i + 1).toString();
                        
                        // Try to find the episode title
                        let episodeTitle = $el.find('.title, .name').text().trim() || 
                                          $el.attr('title') ||
                                          `Episode ${episodeNumber}`;
                        
                        // Try to find the episode link
                        const episodeLink = $el.find('a').attr('href') || $el.attr('data-href') || '';
                        let episodeId = '';
                        
                        // If we have a link, extract the ID
                        if (episodeLink) {
                            episodeId = website_helpers_1.extractIdFromUrl(episodeLink);
                        } else {
                            // If no link but we have some identifier
                            episodeId = $el.attr('id') || $el.attr('data-id') || `${animeId}-${i+1}`;
                        }
                        
                        // Extract language info if available
                        const episodeText = $el.text();
                        const languages = website_helpers_1.extractLanguages(episodeText);
                        
                        if (episodeId) {
                            episodes.push({
                                id: episodeId,
                                number: parseInt(episodeNumber.toString().replace(/\D/g, ''), 10) || (i + 1),
                                title: episodeTitle || `Episode ${episodeNumber}`,
                                languages: languages.length ? languages : ['Unknown'],
                                url: episodeLink || url
                            });
                            console.log(`Found episode: ${episodeTitle}, ID: ${episodeId}`);
                        }
                    } catch (episodeError) {
                        console.error('Error processing episode item:', episodeError);
                    }
                });
                
                // If no episodes found with the normal selectors, check for seasons/tabs
                if (episodes.length === 0) {
                    console.log('No episodes found with primary selectors, checking for seasons/tabs...');
                    
                    // Look for season tabs or dropdown
                    $('.seasons, .temporadas, .tabs, select[id*="season"]').each((i, seasonElement) => {
                        const $season = $(seasonElement);
                        const seasonNum = i + 1;
                        const seasonTitle = $season.find('.season-title, .title').text().trim() || `Season ${seasonNum}`;
                        
                        episodes.push({
                            id: `javascript:void(0)`,
                            number: i + 1,
                            title: seasonTitle,
                            languages: ['Unknown'],
                            url: `javascript:void(0)`
                        });
                        
                        console.log(`Found season: ${seasonTitle}`);
                    });
                }
                
                // If still no episodes, look for any links that might be episodes
                if (episodes.length === 0) {
                    console.log('No episodes found with season selectors, looking for any relevant links...');
                    
                    // As a fallback, check for links that might be episodes
                    $('a').each((i, el) => {
                        const $el = $(el);
                        const href = $el.attr('href') || '';
                        
                        // If link contains episode patterns
                        if (href && (href.includes('/episode/') || href.includes('/watch/') || 
                                   href.match(/[sS]\d+[eE]\d+/) || href.includes(`/${animeId}/`))) {
                            
                            const title = $el.text().trim() || $el.attr('title') || `Episode ${i+1}`;
                            
                            // Avoid duplicates
                            if (!episodes.some(e => e.url === href)) {
                                episodes.push({
                                    id: website_helpers_1.extractIdFromUrl(href),
                                    number: i + 1,
                                    title: title,
                                    languages: ['Unknown'],
                                    url: href
                                });
                                console.log(`Found episode using links method: ${title}`);
                            }
                        }
                    });
                }
                
                // If we STILL don't have episodes, at least return the anime itself as an episode
                if (episodes.length === 0) {
                    console.log('No episodes found with any method, using anime itself as episode');
                    
                    // Just return the anime itself as an episode (especially for movies)
                    episodes.push({
                        id: animeId,
                        number: 1,
                        title: $('h1, .entry-title, .title').first().text().trim() || 'Full Movie/Series',
                        languages: website_helpers_1.extractLanguages($('body').text()),
                        url: url
                    });
                }
                
                console.log(`Total episodes found: ${episodes.length} (before filtering)`);

                // Filter out invalid episodes
                const validEpisodes = episodes.filter(episode => {
                    // Remove any javascript:void(0) links
                    if (episode.url === 'javascript:void(0)' || episode.id === 'javascript:void(0)') {
                        return false;
                    }
                    
                    // Make sure the episode URL contains the animeId to avoid cross-contamination
                    if (!episode.url.includes(animeId) && !episode.id.includes(animeId)) {
                        return false;
                    }
                    
                    return true;
                });
                
                console.log(`Valid episodes after filtering: ${validEpisodes.length}`);
                
                // Sort by episode number
                validEpisodes.sort((a, b) => a.number - b.number);
                
                // Remove duplicates
                const uniqueEpisodes = [];
                const seenIds = new Set();
                for (const episode of validEpisodes) {
                    if (!seenIds.has(episode.id)) {
                        uniqueEpisodes.push(episode);
                        seenIds.add(episode.id);
                    }
                }
                
                console.log(`Unique episodes after deduplication: ${uniqueEpisodes.length}`);
                
                return {
                    episodes: uniqueEpisodes,
                    totalEpisodes: uniqueEpisodes.length
                };
            } catch (error) {
                console.error('Error getting episodes:', error);
                throw error;
            }
        }, cacheConfig.key, cacheConfig.duration);
    }

    async getEpisodeServers(contentType, episodeId, cacheConfig) {
        return cache_1.cache.getOrSet(async () => {
            try {
                console.log(`Getting servers for episode: ${episodeId}`);
                
                // Determine path format and construct URL
                let url;
                if (episodeId.includes('episode/')) {
                    // Direct episode URL
                    url = `${this.baseUrl}/${episodeId}`;
                } else if (contentType === 'movie') {
                    url = `${this.baseUrl}/movie/${episodeId}`;
                } else {
                    url = `${this.baseUrl}/episode/${episodeId}`;
                }
                
                console.log(`Servers URL: ${url}`);
                
                // Get the episode page
                const response = await axios_1.default.get(url, { 
                    headers: this.headers,
                    timeout: 10000
                });
                
                console.log(`Servers response status: ${response.status}`);
                const $ = (0, cheerio_1.load)(response.data);
                
                // Debug HTML structure
                console.log(`Page title: ${$('title').text()}`);
                
                const servers = [];
                
                // Try various selectors that might be used for servers
                const serverSelectors = [
                    '.server-item', '.servers-list .server', '.player-options .option',
                    '[class*="server"]', '[class*="player"]', '[class*="option"]', '[data-server]',
                    'a[href*="player"]', 'a[href*="watch"]', '[class*="play-button"]'
                ];
                
                // Join all selectors
                const combinedSelector = serverSelectors.join(', ');
                console.log(`Looking for servers using selectors: ${combinedSelector}`);
                console.log(`Found ${$(combinedSelector).length} potential server elements`);
                
                // If we find server elements with the combined selector
                $(combinedSelector).each((i, el) => {
                    try {
                        const $el = $(el);
                        
                        // Try to get server ID
                        const id = $el.attr('data-id') || $el.attr('data-server') || $el.attr('data-option') || 
                                  $el.attr('id') || `server-${i}`;
                                  
                        // Try to get server name  
                        let name = $el.text().trim() || $el.attr('title') || `Server ${i+1}`;
                        
                        // Clean HTML content and excessive whitespace from name
                        name = name.replace(/<[^>]*>/g, '')
                                  .replace(/\s+/g, ' ')
                                  .replace(/\n/g, ' ')
                                  .trim();
                        
                        // If name is too long or empty after cleaning, use a generic name
                        if (name.length > 50 || name.length === 0) {
                            name = `Server ${i+1}`;
                        }
                        
                        // Try to get direct URL if available
                        const url = $el.attr('data-src') || $el.attr('href') || '';
                        
                        // Extract language info
                        const language = website_helpers_1.extractLanguages(name)[0] || 'Unknown';
                        
                        servers.push({
                            id,
                            name,
                            language,
                            url: url || `${this.baseUrl}/ajax/server?id=${id}`
                        });
                        
                        console.log(`Found server: ${name}, ID: ${id}`);
                    } catch (serverError) {
                        console.error('Error processing server item:', serverError);
                    }
                });
                
                // If no servers found, try to find iframes or embed URLs
                if (servers.length === 0) {
                    console.log('No servers found with primary selectors, looking for iframes or embeds...');
                    
                    $('iframe').each((i, el) => {
                        const $el = $(el);
                        const src = $el.attr('src') || '';
                        
                        if (src && src.includes('http')) {
                            servers.push({
                                id: `iframe-${i}`,
                                name: `Embed ${i+1}`,
                                language: 'Unknown',
                                url: src
                            });
                            console.log(`Found iframe embed: ${src}`);
                        }
                    });
                    
                    // Look for script tags that might contain player data
                    $('script').each((i, el) => {
                        const script = $(el).html() || '';
                        const sourceMatch = script.match(/source\s*:\s*["']([^"']+)["']/i);
                        const m3u8Match = script.match(/['"](https?:\/\/[^"']+\.m3u8[^"']*)['"]/) ||
                                          script.match(/['"](https?:\/\/[^"']+\.mp4[^"']*)['"]/);
                        
                        if (sourceMatch && sourceMatch[1]) {
                            servers.push({
                                id: `script-${i}`,
                                name: `Source ${i+1}`,
                                language: 'Unknown',
                                url: sourceMatch[1]
                            });
                            console.log(`Found source in script: ${sourceMatch[1]}`);
                        } else if (m3u8Match && m3u8Match[1]) {
                            servers.push({
                                id: `script-${i}`,
                                name: `HLS ${i+1}`,
                                language: 'Unknown',
                                url: m3u8Match[1]
                            });
                            console.log(`Found HLS/MP4 URL in script: ${m3u8Match[1]}`);
                        }
                    });
                }
                
                // If still no servers found, provide a default entry
                if (servers.length === 0) {
                    console.log('No servers found, adding a default entry');
                    servers.push({
                        id: episodeId,
                        name: 'Default Server',
                        language: 'Unknown',
                        url: url
                    });
                }
                
                console.log(`Total servers found: ${servers.length}`);
                return servers;
            } catch (error) {
                console.error('Error getting episode servers:', error);
                throw error;
            }
        }, cacheConfig.key, cacheConfig.duration);
    }

    async getEpisodeSources(contentType, episodeId, serverId, cacheConfig) {
        return cache_1.cache.getOrSet(async () => {
            try {
                console.log(`Getting sources for episode: ${episodeId}, server: ${serverId}, contentType: ${contentType}`);
                
                if (!contentType || !episodeId || !serverId) {
                    console.error('Missing parameters:', { contentType, episodeId, serverId });
                    throw new Error('Missing required parameters: contentType, episodeId, or serverId');
                }
                
                // Try to get servers first to find the matching server URL
                console.log('Fetching available servers...');
                let servers = [];
                try {
                    servers = await this.getEpisodeServers(contentType, episodeId, {
                        key: `${contentType}-${episodeId}-servers`,
                        duration: 60 * 60 // 1 hour cache
                    });
                    console.log(`Found ${servers.length} servers for episode ${episodeId}`);
                    console.log('Server IDs:', servers.map(s => s.id).join(', '));
                } catch (serverError) {
                    console.error('Error getting episode servers:', serverError);
                    // Create a fallback server if we couldn't get servers
                    servers = [{
                        id: serverId,
                        name: 'Default Server',
                        language: 'Unknown',
                        url: `${this.baseUrl}/${contentType === 'movie' ? 'movie' : 'episode'}/${episodeId}`
                    }];
                    console.log('Created fallback server due to error');
                }
                
                // Find the requested server
                // Try exact match first
                let server = servers.find(s => s.id === serverId);
                
                // If not found by exact ID, try partial match
                if (!server && servers.length > 0) {
                    server = servers.find(s => s.id.includes(serverId) || (serverId.includes(s.id) && s.id.length > 3));
                }
                
                // If still not found, use the first server
                if (!server && servers.length > 0) {
                    console.log(`Server ${serverId} not found, using first available server`);
                    server = servers[0];
                } else if (!server) {
                    console.error(`No servers available for ${episodeId}`);
                    throw new Error(`No servers available for episode ${episodeId}`);
                }
                
                console.log(`Using server: ${server.id} with URL: ${server.url}`);
                
                // Check if the URL is already a direct streaming URL
                if (server.url.includes('.m3u8') || server.url.includes('.mp4')) {
                    console.log(`Found direct media URL: ${server.url}`);
                    return [{
                        url: server.url,
                        quality: 'auto',
                        isM3U8: server.url.includes('.m3u8')
                    }];
                }
                
                // If it's an embed URL, return it as is
                if (server.url.includes('http') && !server.url.includes(this.baseUrl)) {
                    console.log(`Found external embed URL: ${server.url}`);
                    return [{
                        url: server.url,
                        quality: 'auto',
                        isEmbed: true
                    }];
                }
                
                // If it's an internal API URL, try to fetch the streaming URL
                if (server.url.includes('/ajax/server')) {
                    try {
                        console.log(`Requesting ajax URL: ${server.url}`);
                        const response = await axios_1.default.get(server.url, {
                            headers: {
                                ...this.headers,
                                'Referer': `${this.baseUrl}/${contentType === 'movie' ? 'movie' : 'episode'}/${episodeId}`,
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            timeout: 10000
                        });
                        
                        console.log('Ajax response received:', response.status);
                        
                        if (response.data && response.data.url) {
                            console.log(`Got streaming URL from ajax: ${response.data.url}`);
                            return [{
                                url: response.data.url,
                                quality: 'auto',
                                isEmbed: !response.data.url.includes('.m3u8') && !response.data.url.includes('.mp4')
                            }];
                        } else {
                            console.log('Ajax response did not contain URL:', response.data);
                        }
                    } catch (ajaxError) {
                        console.error('Error fetching from ajax endpoint:', ajaxError.message);
                    }
                }
                
                // If all else fails, try to fetch the page and look for embedded videos
                try {
                    const episodePage = `${this.baseUrl}/${contentType === 'movie' ? 'movie' : 'episode'}/${episodeId}`;
                    console.log(`Fetching episode page to look for embedded videos: ${episodePage}`);
                    
                    const pageResponse = await (0, node_fetch_1.default)(episodePage, {
                        headers: this.headers,
                        timeout: 10000
                    });
                    
                    if (!pageResponse.ok) {
                        console.error(`Failed to fetch page: ${pageResponse.status} ${pageResponse.statusText}`);
                        throw new Error(`HTTP error: ${pageResponse.status}`);
                    }
                    
                    const html = await pageResponse.text();
                    console.log(`Page content length: ${html.length} characters`);
                    
                    // Try to find HLS stream in the page
                    const m3u8Match = html.match(/(?:"|')([^"']*?\.m3u8[^"']*?)(?:"|')/i);
                    if (m3u8Match && m3u8Match[1]) {
                        console.log(`Found m3u8 URL in page: ${m3u8Match[1]}`);
                        return [{
                            url: m3u8Match[1],
                            quality: 'auto',
                            isM3U8: true
                        }];
                    }
                    
                    // Try to find mp4 sources
                    const mp4Match = html.match(/(?:"|')(https?:\/\/[^"']*?\.mp4[^"']*?)(?:"|')/i);
                    if (mp4Match && mp4Match[1]) {
                        console.log(`Found mp4 URL in page: ${mp4Match[1]}`);
                        return [{
                            url: mp4Match[1],
                            quality: 'auto',
                            isM3U8: false
                        }];
                    }
                    
                    // Try to find iframe sources
                    const iframeMatch = html.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
                    if (iframeMatch && iframeMatch[1]) {
                        console.log(`Found iframe URL in page: ${iframeMatch[1]}`);
                        return [{
                            url: iframeMatch[1],
                            quality: 'auto',
                            isEmbed: true
                        }];
                    }
                    
                    console.log('No media sources found in page content');
                } catch (fetchError) {
                    console.error('Error fetching page for sources:', fetchError.message);
                }
                
                // Last resort - just return the server URL or episode URL as an embed
                console.log('Using fallback: returning server URL as embed');
                return [{
                    url: server.url || `${this.baseUrl}/${contentType === 'movie' ? 'movie' : 'episode'}/${episodeId}`,
                    quality: 'auto',
                    isEmbed: true
                }];
            } catch (error) {
                console.error('Error getting episode sources:', error);
                // Instead of throwing error, return a meaningful error message in the response
                return [{
                    url: '',
                    quality: 'error',
                    isError: true,
                    error: error.message
                }];
            }
        }, cacheConfig.key, cacheConfig.duration);
    }

    async search(query, page = 1, cacheConfig) {
        return cache_1.cache.getOrSet(async () => {
            try {
                console.log(`Searching for: ${query} on page ${page}`);
                // anime-world.co search URL format
                const url = `${this.baseUrl}/?s=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ''}`;
                console.log(`Search URL: ${url}`);
                
                const response = await axios_1.default.get(url, { 
                    headers: this.headers,
                    timeout: 10000 // Adding timeout to avoid hanging requests
                });
                
                console.log(`Search response status: ${response.status}`);
                const $ = (0, cheerio_1.load)(response.data);
                const results = [];
                
                // Debug the HTML structure
                console.log(`Page title: ${$('title').text()}`);
                console.log(`Search result elements: ${$('.item, article, .post, div[class*="result"]').length}`);
                
                // Try multiple different selectors that might match anime-world.co's structure
                $('article, .post, .item, div[class*="result"], .card, .show-card, .movie-card').each((i, el) => {
                    try {
                        const $el = $(el);
                        
                        // Try multiple selectors for title
                        const title = $el.find('h2, h3, .title, .name, .post-title, .entry-title').first().text().trim() ||
                                      $el.attr('title') || $el.attr('data-title') || '';
                        
                        // Try multiple selectors for image
                        const image = $el.find('img').attr('src') || 
                                      $el.find('img').attr('data-src') || 
                                      $el.find('.poster, .thumbnail, .image').attr('style')?.match(/url\(['"]?(.*?)['"]?\)/)?.[1] || 
                                      '';
                        
                        // Get link
                        const link = $el.find('a').attr('href') || $el.attr('data-href') || '';
                        
                        // Extract ID from URL
                        const id = website_helpers_1.extractIdFromUrl(link);
                        
                        // Determine content type
                        const type = link.includes('/movie') ? 'movie' : 'series';
                        
                        // Try to find year
                        const year = $el.find('.year, .date, time, .meta').text().match(/(\d{4})/)?.[1] || '';
                        
                        if (title && link) {
                            results.push({
                                id,
                                title,
                                image,
                                type,
                                languages: ['Unknown'], // We'll determine languages later
                                year,
                                url: link
                            });
                            console.log(`Found result: ${title}, ID: ${id}`);
                        }
                    } catch (itemError) {
                        console.error('Error processing search result item:', itemError);
                    }
                });
                
                // If no results found with main selectors, try alternative selectors
                if (results.length === 0) {
                    console.log('No results found with primary selectors, trying alternatives...');
                    $('a').each((i, el) => {
                        const $el = $(el);
                        const href = $el.attr('href') || '';
                        
                        // If the link looks like it might be an anime page
                        if (href && (href.includes('/series/') || href.includes('/movie/') || 
                                    href.includes('/anime/') || href.includes('/shows/'))) {
                            const title = $el.text().trim() || $el.attr('title') || '';
                            if (title && !results.some(r => r.url === href)) { // Avoid duplicates
                                results.push({
                                    id: website_helpers_1.extractIdFromUrl(href),
                                    title,
                                    image: $el.find('img').attr('src') || '',
                                    type: href.includes('/movie') ? 'movie' : 'series',
                                    languages: ['Unknown'],
                                    url: href
                                });
                                console.log(`Found result using alternative method: ${title}`);
                            }
                        }
                    });
                }
                
                // Look for pagination
                const hasNextPage = $('.pagination, .nav-links, .page-numbers').find('a:contains("Next"), .next, .nextpostslink').length > 0;
                
                console.log(`Total results found: ${results.length}`);
                return {
                    success: true,
                    data: {
                        results,
                        currentPage: page,
                        hasNextPage,
                        totalResults: results.length
                    }
                };
            } catch (error) {
                console.error('Error searching anime:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }, cacheConfig.key, cacheConfig.duration);
    }
}
exports.AnimeWorldScraper = AnimeWorldScraper;

class SatoruScraper {
    // Keeping the original SatoruScraper class for compatibility
    baseUrl;
    headers;
    constructor(baseUrl = 'https://satoru.one') {
        this.baseUrl = baseUrl;
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };
    }
    
    async getAnimeInfo(animeId, cacheConfig) {
        // Delegating to anime-world.co implementation
        const animeWorldScraper = new AnimeWorldScraper();
        return animeWorldScraper.getAnimeInfo(animeId, cacheConfig);
    }
    
    async getEpisodes(contentType, animeId, page, cacheConfig) {
        // Delegating to anime-world.co implementation
        const animeWorldScraper = new AnimeWorldScraper();
        return animeWorldScraper.getEpisodes(contentType, animeId, page, cacheConfig);
    }
    
    async getEpisodeServers(contentType, episodeId, cacheConfig) {
        // Delegating to anime-world.co implementation
        const animeWorldScraper = new AnimeWorldScraper();
        return animeWorldScraper.getEpisodeServers(contentType, episodeId, cacheConfig);
    }
    
    async getEpisodeSources(contentType, episodeId, serverId, cacheConfig) {
        // Delegating to anime-world.co implementation
        const animeWorldScraper = new AnimeWorldScraper();
        return animeWorldScraper.getEpisodeSources(contentType, episodeId, serverId, cacheConfig);
    }
    
    async search(query, page = 1, cacheConfig) {
        // Delegating to anime-world.co implementation
        const animeWorldScraper = new AnimeWorldScraper();
        return animeWorldScraper.search(query, page, cacheConfig);
    }
}
exports.SatoruScraper = SatoruScraper;