/**
 * Utility helpers for handling website-specific logic
 */

/**
 * Determines the content type from a URL
 * @param {string} url - The URL to analyze
 * @returns {string} - 'movie', 'series', or 'unknown'
 */
const getContentType = (url) => {
    if (url.includes('/movies/')) return 'movie';
    if (url.includes('/series/')) return 'series';
    return 'unknown';
};

/**
 * Extracts the ID from a URL
 * @param {string} url - The URL to extract from
 * @returns {string} - The extracted ID
 */
const extractIdFromUrl = (url) => {
    if (!url) return '';
    const parts = url.split('/').filter(Boolean);
    return parts[parts.length - 1];
};

/**
 * Extracts language options from text
 * @param {string} text - Text that might contain language info
 * @returns {Array} - Array of detected languages
 */
const extractLanguages = (text) => {
    const languages = [];
    const langPatterns = [
        { regex: /hindi|हिन्दी|हिंदी/i, name: 'Hindi' },
        { regex: /tamil|தமிழ்/i, name: 'Tamil' },
        { regex: /telugu|తెలుగు/i, name: 'Telugu' },
        { regex: /english|eng/i, name: 'English' },
        { regex: /japanese|jp|jpn/i, name: 'Japanese' }
    ];

    langPatterns.forEach(lang => {
        if (lang.regex.test(text)) {
            languages.push(lang.name);
        }
    });

    return languages.length ? languages : ['Unknown'];
};

/**
 * Detects quality from text
 * @param {string} text - Text that might contain quality info
 * @returns {string} - Detected quality or 'Unknown'
 */
const extractQuality = (text) => {
    const qualityMatch = text.match(/(\d{3,4}p)/i);
    return qualityMatch ? qualityMatch[1] : 'Unknown';
};

module.exports = {
    getContentType,
    extractIdFromUrl,
    extractLanguages,
    extractQuality
};
