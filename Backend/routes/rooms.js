const express = require('express');
const router = express.Router();

const db = require('../config/db');
const auth = require('../middleware/auth');


// ============================================================
// GET ALL ROOMS
// ============================================================

router.get('/', auth, async (req, res) => {

    try {

        const [rooms] = await db.execute(`

            SELECT

                r.id,

                r.room_number,

                r.block,

                r.floor,

                r.room_type,

                r.capacity,

                r.available_slots,

                r.status,

                r.created_at,

                r.updated_at,

                (
                    SELECT COUNT(*)
                    FROM room_allocations ra
                    WHERE ra.room_id = r.id
                    AND ra.status = 'active'
                ) AS occupied_slots

            FROM rooms r

            ORDER BY
                r.block,
                r.floor,
                r.room_number

        `);


        res.json(rooms);


    } catch (error) {

        console.error(
            'Error fetching rooms:',
            error
        );


        res.status(500).json({

            error:
                'Failed to fetch rooms'

        });

    }

});


// ============================================================
// GET AVAILABLE ROOMS
// ============================================================

router.get('/available', auth, async (req, res) => {

    try {

        const [rooms] = await db.execute(`

            SELECT

                r.id,

                r.room_number,

                r.block,

                r.floor,

                r.room_type,

                r.capacity,

                r.available_slots,

                r.status

            FROM rooms r

            WHERE r.status = 'available'

            AND r.available_slots > 0

            ORDER BY
                r.block,
                r.floor,
                r.room_number

        `);


        res.json(rooms);


    } catch (error) {

        console.error(
            'Error fetching available rooms:',
            error
        );


        res.status(500).json({

            error:
                'Failed to fetch available rooms'

        });

    }

});


// ============================================================
// GET ROOM BY ID
// ============================================================

router.get('/:id', auth, async (req, res) => {

    try {

        const [rooms] = await db.execute(`

            SELECT

                r.id,

                r.room_number,

                r.block,

                r.floor,

                r.room_type,

                r.capacity,

                r.available_slots,

                r.status,

                r.created_at,

                r.updated_at

            FROM rooms r

            WHERE r.id = ?

            LIMIT 1

        `, [
            req.params.id
        ]);


        if (rooms.length === 0) {

            return res.status(404).json({

                error:
                    'Room not found'

            });

        }


        res.json(
            rooms[0]
        );


    } catch (error) {

        console.error(
            'Error fetching room:',
            error
        );


        res.status(500).json({

            error:
                'Failed to fetch room'

        });

    }

});


// ============================================================
// GET ROOM OCCUPANTS
// ============================================================

router.get(
    '/:id/students',
    auth,
    async (req, res) => {

        try {

            const [students] =
                await db.execute(`

                    SELECT

                        ra.id AS allocation_id,

                        ra.student_id,

                        ra.room_id,

                        ra.allocated_date,

                        ra.status,

                        s.roll_no,

                        s.student_dept,

                        s.year,

                        s.section,

                        u.id AS user_id,

                        u.name,

                        u.email,

                        u.phone

                    FROM room_allocations ra

                    JOIN students s
                        ON ra.student_id = s.id

                    JOIN users u
                        ON s.user_id = u.id

                    WHERE ra.room_id = ?

                    AND ra.status = 'active'

                    ORDER BY
                        u.name

                `, [
                    req.params.id
                ]);


            res.json(
                students
            );


        } catch (error) {

            console.error(
                'Error fetching room students:',
                error
            );


            res.status(500).json({

                error:
                    'Failed to fetch room students'

            });

        }

    }
);


// ============================================================
// CREATE ROOM
// ============================================================

router.post('/', auth, async (req, res) => {

    const {
        room_number,
        block,
        floor,
        room_type,
        capacity
    } = req.body;


    if (
        !room_number ||
        !block ||
        floor === undefined ||
        !room_type ||
        !capacity
    ) {

        return res.status(400).json({

            error:
                'room_number, block, floor, room_type and capacity are required'

        });

    }


    if (
        Number(capacity) <= 0
    ) {

        return res.status(400).json({

            error:
                'Capacity must be greater than zero'

        });

    }


    try {

        // Check duplicate room

        const [existing] =
            await db.execute(`

                SELECT id

                FROM rooms

                WHERE room_number = ?

                AND block = ?

                LIMIT 1

            `, [
                room_number,
                block
            ]);


        if (existing.length > 0) {

            return res.status(409).json({

                error:
                    'Room already exists in this block'

            });

        }


        await db.execute(`

            INSERT INTO rooms
            (
                room_number,
                block,
                floor,
                room_type,
                capacity,
                available_slots,
                status
            )

            VALUES (?, ?, ?, ?, ?, ?, 'available')

        `, [

            room_number,

            block,

            Number(floor),

            room_type,

            Number(capacity),

            Number(capacity)

        ]);


        res.status(201).json({

            message:
                'Room created successfully'

        });


    } catch (error) {

        console.error(
            'Error creating room:',
            error
        );


        res.status(500).json({

            error:
                'Failed to create room'

        });

    }

});


// ============================================================
// UPDATE ROOM
// ============================================================

router.put('/:id', auth, async (req, res) => {

    const {
        room_number,
        block,
        floor,
        room_type,
        capacity,
        status
    } = req.body;


    try {

        // Get current room

        const [currentRows] =
            await db.execute(`

                SELECT

                    id,

                    room_number,

                    block,

                    floor,

                    room_type,

                    capacity,

                    available_slots,

                    status

                FROM rooms

                WHERE id = ?

                LIMIT 1

            `, [
                req.params.id
            ]);


        if (currentRows.length === 0) {

            return res.status(404).json({

                error:
                    'Room not found'

            });

        }


        const current =
            currentRows[0];


        // Count active students

        const [occupiedRows] =
            await db.execute(`

                SELECT COUNT(*) AS occupied

                FROM room_allocations

                WHERE room_id = ?

                AND status = 'active'

            `, [
                req.params.id
            ]);


        const occupied =
            Number(
                occupiedRows[0].occupied
            );


        const newCapacity =
            capacity !== undefined
                ? Number(capacity)
                : Number(current.capacity);


        if (
            newCapacity < occupied
        ) {

            return res.status(400).json({

                error:
                    `Capacity cannot be less than current occupants (${occupied})`

            });

        }


        const newRoomNumber =
            room_number !== undefined
                ? room_number
                : current.room_number;


        const newBlock =
            block !== undefined
                ? block
                : current.block;


        // Check duplicate

        const [duplicate] =
            await db.execute(`

                SELECT id

                FROM rooms

                WHERE room_number = ?

                AND block = ?

                AND id <> ?

                LIMIT 1

            `, [

                newRoomNumber,

                newBlock,

                req.params.id

            ]);


        if (duplicate.length > 0) {

            return res.status(409).json({

                error:
                    'Another room with the same number already exists in this block'

            });

        }


        const newAvailableSlots =
            newCapacity - occupied;


        const newStatus =
            status !== undefined
                ? status
                : (
                    newAvailableSlots > 0
                        ? 'available'
                        : 'full'
                );


        await db.execute(`

            UPDATE rooms

            SET

                room_number = ?,

                block = ?,

                floor = ?,

                room_type = ?,

                capacity = ?,

                available_slots = ?,

                status = ?,

                updated_at = CURRENT_TIMESTAMP

            WHERE id = ?

        `, [

            newRoomNumber,

            newBlock,

            floor !== undefined
                ? Number(floor)
                : current.floor,

            room_type !== undefined
                ? room_type
                : current.room_type,

            newCapacity,

            newAvailableSlots,

            newStatus,

            req.params.id

        ]);


        res.json({

            message:
                'Room updated successfully'

        });


    } catch (error) {

        console.error(
            'Error updating room:',
            error
        );


        res.status(500).json({

            error:
                'Failed to update room'

        });

    }

});


// ============================================================
// DELETE ROOM
// ============================================================

router.delete('/:id', auth, async (req, res) => {

    try {

        // Check active allocations

        const [allocations] =
            await db.execute(`

                SELECT COUNT(*) AS count

                FROM room_allocations

                WHERE room_id = ?

                AND status = 'active'

            `, [
                req.params.id
            ]);


        if (
            Number(
                allocations[0].count
            ) > 0
        ) {

            return res.status(400).json({

                error:
                    'Cannot delete a room with active students'

            });

        }


        const [result] =
            await db.execute(`

                DELETE FROM rooms

                WHERE id = ?

            `, [
                req.params.id
            ]);


        if (
            result.affectedRows === 0
        ) {

            return res.status(404).json({

                error:
                    'Room not found'

            });

        }


        res.json({

            message:
                'Room deleted successfully'

        });


    } catch (error) {

        console.error(
            'Error deleting room:',
            error
        );


        res.status(500).json({

            error:
                'Failed to delete room'

        });

    }

});


// ============================================================
// ROOM ALLOCATION
// ============================================================

router.post(
    '/:id/allocate',
    auth,
    async (req, res) => {

        const {
            student_id
        } = req.body;


        // ----------------------------------------------------
        // Validate student ID
        // ----------------------------------------------------

        if (!student_id) {

            return res.status(400).json({

                error:
                    'student_id is required'

            });

        }


        try {

            // ------------------------------------------------
            // Check room
            // ------------------------------------------------

            const [roomRows] =
                await db.execute(`

                    SELECT

                        id,

                        room_number,

                        capacity,

                        available_slots,

                        status

                    FROM rooms

                    WHERE id = ?

                    LIMIT 1

                `, [
                    req.params.id
                ]);


            if (
                roomRows.length === 0
            ) {

                return res.status(404).json({

                    error:
                        'Room not found'

                });

            }


            const room =
                roomRows[0];


            // ------------------------------------------------
            // Check room availability
            // ------------------------------------------------

            if (
                Number(room.available_slots) <= 0 ||
                room.status !== 'available'
            ) {

                return res.status(400).json({

                    error:
                        'Room is full or unavailable'

                });

            }


            // ------------------------------------------------
            // Check student
            // ------------------------------------------------

            const [studentRows] =
                await db.execute(`

                    SELECT id

                    FROM students

                    WHERE id = ?

                    LIMIT 1

                `, [
                    student_id
                ]);


            if (
                studentRows.length === 0
            ) {

                return res.status(404).json({

                    error:
                        'Student not found'

                });

            }


            // ------------------------------------------------
            // Check existing active room
            // ------------------------------------------------

            const [existing] =
                await db.execute(`

                    SELECT id

                    FROM room_allocations

                    WHERE student_id = ?

                    AND status = 'active'

                    LIMIT 1

                `, [
                    student_id
                ]);


            if (
                existing.length > 0
            ) {

                return res.status(400).json({

                    error:
                        'Student already has an active room'

                });

            }


            // ------------------------------------------------
            // Create allocation
            // ------------------------------------------------

            await db.execute(`

                INSERT INTO room_allocations
                (
                    student_id,
                    room_id,
                    status
                )

                VALUES (?, ?, 'active')

            `, [

                student_id,

                req.params.id

            ]);


            // ------------------------------------------------
            // Decrease available slots
            // ------------------------------------------------

            const newAvailableSlots =
                Number(room.available_slots) - 1;


            const newStatus =
                newAvailableSlots <= 0
                    ? 'full'
                    : 'available';


            await db.execute(`

                UPDATE rooms

                SET

                    available_slots = ?,

                    status = ?,

                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?

            `, [

                newAvailableSlots,

                newStatus,

                req.params.id

            ]);


            // ------------------------------------------------
            // Success
            // ------------------------------------------------

            res.json({

                success: true,

                message:
                    'Room allocated successfully',

                room: {

                    id:
                        room.id,

                    room_number:
                        room.room_number,

                    available_slots:
                        newAvailableSlots,

                    status:
                        newStatus

                }

            });


        } catch (error) {

            console.error(
                '================================='
            );

            console.error(
                'ROOM ALLOCATION ERROR'
            );

            console.error(
                '================================='
            );

            console.error(
                'Message:',
                error.message
            );

            console.error(
                'Code:',
                error.code
            );

            console.error(
                'SQL State:',
                error.sqlState
            );

            console.error(
                'SQL Message:',
                error.sqlMessage
            );

            console.error(
                'Full Error:',
                error
            );

            console.error(
                '================================='
            );


            res.status(500).json({

                error:
                    error.sqlMessage ||
                    error.message ||
                    'Failed to allocate room',

                code:
                    error.code || null

            });

        }

    }
);


// ============================================================
// REMOVE ROOM ALLOCATION
// ============================================================

router.delete(
    '/:id/allocate/:studentId',
    auth,
    async (req, res) => {

        try {

            const [result] =
                await db.execute(`

                    UPDATE room_allocations

                    SET

                        status = 'vacated',

                        vacated_date =
                            CURRENT_TIMESTAMP

                    WHERE room_id = ?

                    AND student_id = ?

                    AND status = 'active'

                `, [

                    req.params.id,

                    req.params.studentId

                ]);


            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({

                    error:
                        'Active room allocation not found'

                });

            }


            // Restore available slot

            await db.execute(`

                UPDATE rooms

                SET

                    available_slots =
                        available_slots + 1,

                    status = 'available',

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = ?

            `, [
                req.params.id
            ]);


            res.json({

                message:
                    'Student removed from room successfully'

            });


        } catch (error) {

            console.error(
                'Error removing allocation:',
                error
            );


            res.status(500).json({

                error:
                    'Failed to remove student from room'

            });

        }

    }
);


// ============================================================
// ROOM STATISTICS
// ============================================================

router.get(
    '/:id/statistics',
    auth,
    async (req, res) => {

        try {

            const [rows] =
                await db.execute(`

                    SELECT

                        r.id,

                        r.room_number,

                        r.block,

                        r.floor,

                        r.room_type,

                        r.capacity,

                        r.available_slots,

                        r.status,

                        COUNT(
                            ra.id
                        ) AS occupied_slots,

                        (
                            r.capacity -
                            COUNT(ra.id)
                        ) AS free_slots

                    FROM rooms r

                    LEFT JOIN room_allocations ra

                        ON r.id =
                           ra.room_id

                        AND ra.status =
                            'active'

                    WHERE r.id = ?

                    GROUP BY

                        r.id,

                        r.room_number,

                        r.block,

                        r.floor,

                        r.room_type,

                        r.capacity,

                        r.available_slots,

                        r.status

                `, [
                    req.params.id
                ]);


            if (
                rows.length === 0
            ) {

                return res.status(404).json({

                    error:
                        'Room not found'

                });

            }


            res.json(
                rows[0]
            );


        } catch (error) {

            console.error(
                'Error fetching room statistics:',
                error
            );


            res.status(500).json({

                error:
                    'Failed to fetch room statistics'

            });

        }

    }
);


// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;