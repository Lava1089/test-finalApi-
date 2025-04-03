const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const apiDocs = require('./api-docs.json');
const apiRoutes = require('./api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Satoru Anime API is running'
    });
});

// API Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(apiDocs));

// API routes
app.use('/api', apiRoutes);

// Error handling for 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not Found'
    });
});

// Only listen to port if not running on Vercel
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

// Export for Vercel
module.exports = app; 