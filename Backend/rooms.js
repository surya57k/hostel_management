const express = require('express');
const router = express.Router();

// Mock data for rooms
const rooms = [
    { id: 1, name: "Room A", amenities: ["WiFi", "AC"], roommates: ["John", "Doe"] },
    { id: 2, name: "Room B", amenities: ["WiFi", "Heater"], roommates: ["Alice", "Bob"] },
];

// API to get room details
router.get('/rooms', (req, res) => {
    res.json(rooms);
});

module.exports = router;