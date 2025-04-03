const express = require('express');
const { AnimeWorldScraper } = require('./scraper');
const router = express.Router();

// Initialize the scraper
const scraper = new AnimeWorldScraper();

// Default cache configuration
const DEFAULT_CACHE_CONFIG = {
    duration: 3600, // 1 hour in seconds
};

// Error handler middleware
const errorHandler = (err, req, res, next) => {
    console.error(err);
    res.status(500).json({
        success: false,
        error: err.message
    });
};

// Search anime
router.get('/search', async (req, res, next) => {
    try {
        const { query, page = 1 } = req.query;
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter is required'
            });
        }

        const results = await scraper.search(query, page, {
            key: `search:${query}:${page}`,
            ...DEFAULT_CACHE_CONFIG
        });
        res.json(results);
    } catch (error) {
        next(error);
    }
});

// Get anime info
router.get('/info/:contentType/:animeId', async (req, res, next) => {
    try {
        const { contentType, animeId } = req.params;
        const fullId = contentType === 'movie' ? `movie-${animeId}` : animeId;
        
        const info = await scraper.getAnimeInfo(fullId, {
            key: `info:${fullId}`,
            ...DEFAULT_CACHE_CONFIG
        });
        res.json({
            success: true,
            data: info
        });
    } catch (error) {
        next(error);
    }
});

// Get episodes list
router.get('/episodes/:contentType/:animeId', async (req, res, next) => {
    try {
        const { contentType, animeId } = req.params;
        const page = req.query.page || 1;
        
        const episodes = await scraper.getEpisodes(contentType, animeId, page, {
            key: `episodes:${contentType}:${animeId}:${page}`,
            ...DEFAULT_CACHE_CONFIG
        });
        res.json({
            success: true,
            data: episodes
        });
    } catch (error) {
        next(error);
    }
});

// Get episode servers
router.get('/servers/:contentType/:episodeId', async (req, res, next) => {
    try {
        const { contentType, episodeId } = req.params;
        
        const servers = await scraper.getEpisodeServers(contentType, episodeId, {
            key: `servers:${contentType}:${episodeId}`,
            ...DEFAULT_CACHE_CONFIG
        });
        res.json({
            success: true,
            data: servers
        });
    } catch (error) {
        next(error);
    }
});

// Get video sources
router.get('/sources/:contentType/:episodeId/:serverId', async (req, res, next) => {
    try {
        const { contentType, episodeId, serverId } = req.params;
        console.log(`Sources request received - contentType: ${contentType}, episodeId: ${episodeId}, serverId: ${serverId}`);
        
        if (!contentType || !episodeId || !serverId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                message: 'Content type, episode ID, and server ID are all required'
            });
        }
        
        const sources = await scraper.getEpisodeSources(
            contentType,
            episodeId,
            serverId,
            {
                key: `sources:${contentType}:${episodeId}:${serverId}`,
                ...DEFAULT_CACHE_CONFIG
            }
        );
        
        // Check for error flag in sources response
        if (sources.length > 0 && sources[0].isError) {
            return res.status(500).json({
                success: false,
                error: sources[0].error || 'Unknown error occurred',
                message: 'Failed to fetch episode sources'
            });
        }
        
        // Check if we actually got valid sources
        if (sources.length === 0 || !sources[0].url) {
            return res.status(404).json({
                success: false,
                error: 'No sources found',
                message: 'Could not find any valid media sources for this episode and server'
            });
        }
        
        res.json({
            success: true,
            data: sources
        });
    } catch (error) {
        console.error('Error in sources endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Unknown server error',
            message: 'An error occurred while fetching episode sources'
        });
    }
});

// Get AnimeWorld ID by title - using search instead
router.get('/id/:title', async (req, res, next) => {
    try {
        const { title } = req.params;
        // Use search to find the anime
        const searchResults = await scraper.search(title, 1, {
            key: `search:${title}`,
            ...DEFAULT_CACHE_CONFIG
        });
        
        if (searchResults.success && searchResults.data.results.length > 0) {
            // Return the first search result
            const firstResult = searchResults.data.results[0];
            res.json({
                success: true,
                data: {
                    id: firstResult.id,
                    title: firstResult.title,
                    type: firstResult.type,
                    url: firstResult.url
                }
            });
        } else {
            res.json({
                success: false,
                error: 'No results found for title'
            });
        }
    } catch (error) {
        next(error);
    }
});

// Get available languages
router.get('/languages/:contentType/:animeId', async (req, res, next) => {
    try {
        const { contentType, animeId } = req.params;
        const fullId = contentType === 'movie' ? `movie-${animeId}` : animeId;
        
        // Get anime info to extract languages
        const info = await scraper.getAnimeInfo(fullId, {
            key: `info:${fullId}`,
            ...DEFAULT_CACHE_CONFIG
        });
        
        // Also get episodes to extract languages from episode titles
        const episodes = await scraper.getEpisodes(contentType, animeId, 1, {
            key: `episodes:${contentType}:${animeId}:1`,
            ...DEFAULT_CACHE_CONFIG
        });
        
        // Combine languages from info and episodes
        const allLanguages = new Set(info.languages || []);
        
        if (episodes && episodes.episodes) {
            episodes.episodes.forEach(episode => {
                (episode.languages || []).forEach(lang => allLanguages.add(lang));
            });
        }
        
        res.json({
            success: true,
            data: {
                languages: Array.from(allLanguages)
            }
        });
    } catch (error) {
        next(error);
    }
});

// Apply error handler
router.use(errorHandler);

module.exports = router;