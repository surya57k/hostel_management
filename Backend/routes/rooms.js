const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Get all available rooms
router.get('/available', auth, async (req, res) => {
    try {
        const [rooms] = await db.execute(`
            SELECT r.*, 
                   (r.capacity - r.available_slots) as occupied_slots,
                   COUNT(DISTINCT ra.student_id) as current_occupants
            FROM rooms r
            LEFT JOIN room_allocations ra ON r.room_id = ra.room_id AND ra.status = 'active'
            WHERE r.available_slots > 0
            GROUP BY r.room_id
        `);
        res.json(rooms);
    } catch (error) {
        console.error('Error fetching available rooms:', error);
        res.status(500).json({ error: 'Failed to fetch available rooms' });
    }
});

// Get room details by ID
router.get('/:roomId', auth, async (req, res) => {
    try {
        const [room] = await db.execute(`
            SELECT r.*, 
                   GROUP_CONCAT(DISTINCT u.name) as occupant_names
            FROM rooms r
            LEFT JOIN room_allocations ra ON r.room_id = ra.room_id AND ra.status = 'active'
            LEFT JOIN students s ON ra.student_id = s.id
            LEFT JOIN users u ON s.user_id = u.id
            WHERE r.room_id = ?
            GROUP BY r.room_id`,
            [req.params.roomId]
        );

        if (room.length === 0) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.json(room[0]);
    } catch (error) {
        console.error('Error fetching room details:', error);
        res.status(500).json({ error: 'Failed to fetch room details' });
    }
});

// Allocate room to student (for teachers/admin)
router.post('/allocate', auth, async (req, res) => {
    const { student_id, room_id } = req.body;
    
    try {
        // Verify if user is a teacher
        const [teacherCheck] = await db.execute(
            'SELECT id FROM teachers WHERE user_id = ?',
            [req.user.id]
        );

        if (teacherCheck.length === 0) {
            return res.status(403).json({ error: 'Only teachers can allocate rooms' });
        }

        // Check if room has available slots
        const [roomCheck] = await db.execute(
            'SELECT available_slots FROM rooms WHERE room_id = ?',
            [room_id]
        );

        if (roomCheck.length === 0 || roomCheck[0].available_slots <= 0) {
            return res.status(400).json({ error: 'Room is not available' });
        }

        // Check if student already has an active room allocation
        const [existingAllocation] = await db.execute(
            'SELECT * FROM room_allocations WHERE student_id = ? AND status = "active"',
            [student_id]
        );

        if (existingAllocation.length > 0) {
            return res.status(400).json({ error: 'Student already has an active room allocation' });
        }

        // Start transaction
        await db.beginTransaction();

        // Create room allocation
        await db.execute(
            'INSERT INTO room_allocations (room_id, student_id) VALUES (?, ?)',
            [room_id, student_id]
        );

        // Update available slots
        await db.execute(
            'UPDATE rooms SET available_slots = available_slots - 1 WHERE room_id = ?',
            [room_id]
        );

        await db.commit();

        res.json({ message: 'Room allocated successfully' });
    } catch (error) {
        await db.rollback();
        console.error('Error allocating room:', error);
        res.status(500).json({ error: 'Failed to allocate room' });
    }
});

// Deallocate room
router.post('/deallocate', auth, async (req, res) => {
    const { allocation_id } = req.body;
    
    try {
        // Verify if user is a teacher
        const [teacherCheck] = await db.execute(
            'SELECT id FROM teachers WHERE user_id = ?',
            [req.user.id]
        );

        if (teacherCheck.length === 0) {
            return res.status(403).json({ error: 'Only teachers can deallocate rooms' });
        }

        // Start transaction
        await db.beginTransaction();

        // Get room_id from allocation
        const [allocation] = await db.execute(
            'SELECT room_id FROM room_allocations WHERE allocation_id = ? AND status = "active"',
            [allocation_id]
        );

        if (allocation.length === 0) {
            return res.status(404).json({ error: 'Active allocation not found' });
        }

        // Update allocation status
        await db.execute(
            'UPDATE room_allocations SET status = "inactive" WHERE allocation_id = ?',
            [allocation_id]
        );

        // Update available slots
        await db.execute(
            'UPDATE rooms SET available_slots = available_slots + 1 WHERE room_id = ?',
            [allocation[0].room_id]
        );

        await db.commit();

        res.json({ message: 'Room deallocated successfully' });
    } catch (error) {
        await db.rollback();
        console.error('Error deallocating room:', error);
        res.status(500).json({ error: 'Failed to deallocate room' });
    }
});

module.exports = router;