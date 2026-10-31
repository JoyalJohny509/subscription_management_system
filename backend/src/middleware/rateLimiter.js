const rateLimit = require('express-rate-limit');

const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,                    // max 5 requests per IP
    statusCode: 429,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many attempts. Please try again later.'
        });
    },
    standardHeaders: true,  // Return rate limit info in RateLimit-* headers
    legacyHeaders: false     // Disable X-RateLimit-* headers
});

module.exports = { authRateLimiter };
