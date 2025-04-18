const jwt = require('jsonwebtoken');

const JWT_SECRET = "your_secret_key"; // Ensure this matches the secret key in server.js

const auth = (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check for either userId/role or id/role format
        if ((!decoded.userId && !decoded.id) || !decoded.role) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Add user data to request
        req.user = {
            id: decoded.userId || decoded.id,
            role: decoded.role
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ error: 'Please authenticate.' });
    }
};

module.exports = auth;
