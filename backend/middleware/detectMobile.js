/**
 * Middleware to detect if the request is from a mobile device
 * Checks the User-Agent header for common mobile device patterns
 */
const detectMobile = (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';

    // Common mobile device patterns in User-Agent
    const mobilePatterns = [
        /Android/i,
        /webOS/i,
        /iPhone/i,
        /iPad/i,
        /iPod/i,
        /BlackBerry/i,
        /Windows Phone/i,
        /Mobile/i,
        /IEMobile/i,
        /Opera Mini/i
    ];

    // Check if any mobile pattern matches
    req.isMobile = mobilePatterns.some(pattern => pattern.test(userAgent));

    next();
};

module.exports = detectMobile;
