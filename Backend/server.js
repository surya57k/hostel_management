const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const db = require("./config/db");

const app = express();


// ============================================================
// ROUTES
// ============================================================

const studentRoutes = require("./routes/student");
const teacherRoutes = require("./routes/teacher");
const roomRoutes = require("./routes/rooms");
const authRoutes = require("./routes/auth");


// ============================================================
// CORS
// ============================================================

app.use(
    cors({
        origin: [
            "http://127.0.0.1:5500",
            "http://localhost:5500",
            "null"
        ],

        credentials: true,

        methods: [
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "OPTIONS"
        ],

        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Accept"
        ]
    })
);


// ============================================================
// PRE-FLIGHT
// ============================================================

app.options("*", cors());


// ============================================================
// JSON BODY PARSER
// ============================================================

app.use(express.json());


// ============================================================
// JWT SECRET
// ============================================================

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "your_secret_key";


// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

const authenticateToken = (
    req,
    res,
    next
) => {

    const authHeader =
        req.headers["authorization"];


    const token =
        authHeader &&
        authHeader.split(" ")[1];


    if (!token) {

        return res.status(401).json({

            error:
                "Access denied"

        });

    }


    try {

        const verified =
            jwt.verify(
                token,
                JWT_SECRET
            );


        req.user =
            verified;


        next();


    } catch (error) {

        return res.status(403).json({

            error:
                "Invalid token"

        });

    }

};


// ============================================================
// CHECK EMAIL
// ============================================================

app.get(
    "/check-email/:email",
    async (req, res) => {

        try {

            const [users] =
                await db.execute(
                    `
                    SELECT
                        COUNT(*) AS count

                    FROM users

                    WHERE email = ?
                    `,
                    [
                        req.params.email
                    ]
                );


            res.json({

                exists:
                    users[0].count > 0

            });


        } catch (error) {

            console.error(
                "Check email error:",
                error
            );


            res.status(500).json({

                error:
                    "Failed to check email"

            });

        }

    }
);


// ============================================================
// GENERAL ROOMS
// ============================================================

app.get(
    "/rooms",
    authenticateToken,
    async (req, res) => {

        try {

            const [rooms] =
                await db.execute(`

                    SELECT *

                    FROM rooms

                    WHERE available_slots > 0

                `);


            res.json(
                rooms
            );


        } catch (error) {

            console.error(
                "Room fetch error:",
                error
            );


            res.status(500).json({

                error:
                    "Failed to fetch rooms"

            });

        }

    }
);


// ============================================================
// ASSIGN ROOM
// ============================================================

app.post(
    "/assign-room",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                studentId,
                roomId
            } = req.body;


            // Only teachers can assign rooms

            if (
                req.user.role !==
                "teacher"
            ) {

                return res.status(403).json({

                    error:
                        "Only teachers can assign rooms"

                });

            }


            // Check room

            const [rooms] =
                await db.execute(`

                    SELECT

                        id,

                        available_slots,

                        status

                    FROM rooms

                    WHERE id = ?

                    LIMIT 1

                `, [
                    roomId
                ]);


            if (
                rooms.length === 0
            ) {

                return res.status(404).json({

                    error:
                        "Room not found"

                });

            }


            if (
                Number(
                    rooms[0].available_slots
                ) <= 0
            ) {

                return res.status(400).json({

                    error:
                        "Room is full"

                });

            }


            // Check existing allocation

            const [existing] =
                await db.execute(`

                    SELECT id

                    FROM room_allocations

                    WHERE student_id = ?

                    AND status = 'active'

                    LIMIT 1

                `, [
                    studentId
                ]);


            if (
                existing.length > 0
            ) {

                return res.status(400).json({

                    error:
                        "Student already has an active room"

                });

            }


            // Allocate

            await db.execute(`

                INSERT INTO room_allocations
                (
                    student_id,
                    room_id,
                    status
                )

                VALUES (?, ?, 'active')

            `, [
                studentId,
                roomId
            ]);


            // Update room

            const newSlots =
                Number(
                    rooms[0].available_slots
                ) - 1;


            const newStatus =
                newSlots <= 0
                    ? "full"
                    : "available";


            await db.execute(`

                UPDATE rooms

                SET

                    available_slots = ?,

                    status = ?,

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = ?

            `, [

                newSlots,

                newStatus,

                roomId

            ]);


            res.json({

                success: true,

                message:
                    "Room assigned successfully!"

            });


        } catch (error) {

            console.error(
                "Assign room error:",
                error
            );


            res.status(500).json({

                error:
                    error.message ||
                    "Failed to assign room"

            });

        }

    }
);


// ============================================================
// FEE STATUS
// ============================================================

app.get(
    "/fee-status/:userId",
    authenticateToken,
    async (req, res) => {

        try {

            if (
                req.user.role ===
                "student" &&

                req.user.id !==
                parseInt(
                    req.params.userId
                )
            ) {

                return res.status(403).json({

                    error:
                        "Access denied"

                });

            }


            const [fees] =
                await db.execute(`

                    SELECT *

                    FROM hostel_fees

                    WHERE user_id = ?

                `, [
                    req.params.userId
                ]);


            res.json(
                fees.length > 0
                    ? fees
                    : {
                        message:
                            "No fee record found"
                    }
            );


        } catch (error) {

            console.error(
                "Fee status error:",
                error
            );


            res.status(500).json({

                error:
                    "Failed to fetch fee status"

            });

        }

    }
);


// ============================================================
// PROFILE
// ============================================================

app.get(
    "/profile",
    authenticateToken,
    async (req, res) => {

        try {

            const [users] =
                await db.execute(`

                    SELECT

                        id,

                        name,

                        email,

                        role,

                        phone

                    FROM users

                    WHERE id = ?

                `, [
                    req.user.id
                ]);


            if (
                users.length === 0
            ) {

                return res.status(404).json({

                    error:
                        "User not found"

                });

            }


            let additionalDetails = {};


            if (
                req.user.role ===
                "student"
            ) {

                const [details] =
                    await db.execute(`

                        SELECT

                            student_dept,

                            roll_no,

                            year,

                            section

                        FROM students

                        WHERE user_id = ?

                    `, [
                        req.user.id
                    ]);


                additionalDetails =
                    details[0] || {};

            }


            res.json({

                ...users[0],

                ...additionalDetails

            });


        } catch (error) {

            console.error(
                "Profile error:",
                error
            );


            res.status(500).json({

                error:
                    "Failed to fetch profile"

            });

        }

    }
);


// ============================================================
// ⭐ DIRECT STUDENT ROOM DETAILS
// ============================================================
// This route is intentionally in server.js.
// It guarantees that:
//
// GET /api/student/allocated-room
//
// works even if there is a problem loading the student router.
// ============================================================

app.get(
    "/api/student/allocated-room",
    authenticateToken,
    async (req, res) => {

        try {

            console.log(
                "Allocated room request for user:",
                req.user.id
            );


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

                        ra.allocated_date,

                        ra.status AS allocation_status

                    FROM students s

                    JOIN room_allocations ra
                        ON s.id =
                           ra.student_id

                    JOIN rooms r
                        ON ra.room_id =
                           r.id

                    WHERE s.user_id = ?

                    AND ra.status =
                        'active'

                    LIMIT 1

                `, [
                    req.user.id
                ]);


            console.log(
                "Allocated room result:",
                rows
            );


            if (
                rows.length === 0
            ) {

                return res.status(404).json({

                    error:
                        "No room allocated"

                });

            }


            const room =
                rows[0];


            // ------------------------------------------------
            // Get roommates
            // ------------------------------------------------

            const [roommates] =
                await db.execute(`

                    SELECT

                        u.name,

                        s.roll_no,

                        s.student_dept

                    FROM room_allocations ra

                    JOIN students s
                        ON ra.student_id =
                           s.id

                    JOIN users u
                        ON s.user_id =
                           u.id

                    WHERE ra.room_id = ?

                    AND ra.status =
                        'active'

                    AND ra.student_id != (

                        SELECT id

                        FROM students

                        WHERE user_id = ?

                        LIMIT 1

                    )

                    ORDER BY
                        u.name

                `, [

                    room.id,

                    req.user.id

                ]);


            room.roommates =
                roommates;


            res.json(
                room
            );


        } catch (error) {

            console.error(
                "Allocated room error:",
                error
            );


            res.status(500).json({

                error:
                    error.sqlMessage ||
                    error.message ||
                    "Failed to fetch allocated room"

            });

        }

    }
);


// ============================================================
// ⭐ ROOM DETAILS ALIAS
// ============================================================
// This also handles:
//
// GET /api/student/room-details
//
// So even if an old frontend function still calls
// /student/room-details, it will work.
// ============================================================

app.get(
    "/api/student/room-details",
    authenticateToken,
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

                        ra.allocated_date

                    FROM students s

                    JOIN room_allocations ra
                        ON s.id =
                           ra.student_id

                    JOIN rooms r
                        ON ra.room_id =
                           r.id

                    WHERE s.user_id = ?

                    AND ra.status =
                        'active'

                    LIMIT 1

                `, [
                    req.user.id
                ]);


            if (
                rows.length === 0
            ) {

                return res.status(404).json({

                    error:
                        "No room allocated"

                });

            }


            const room =
                rows[0];


            const [roommates] =
                await db.execute(`

                    SELECT

                        u.name,

                        s.roll_no,

                        s.student_dept AS department

                    FROM room_allocations ra

                    JOIN students s
                        ON ra.student_id =
                           s.id

                    JOIN users u
                        ON s.user_id =
                           u.id

                    WHERE ra.room_id = ?

                    AND ra.status =
                        'active'

                    AND ra.student_id != (

                        SELECT id

                        FROM students

                        WHERE user_id = ?

                        LIMIT 1

                    )

                    ORDER BY
                        u.name

                `, [

                    room.id,

                    req.user.id

                ]);


            room.roommates =
                roommates;


            res.json(
                room
            );


        } catch (error) {

            console.error(
                "Room details error:",
                error
            );


            res.status(500).json({

                error:
                    error.sqlMessage ||
                    error.message ||
                    "Failed to fetch room details"

            });

        }

    }
);


// ============================================================
// TEACHER ROOM MANAGEMENT
// ============================================================

app.get(
    "/api/rooms/manage",
    authenticateToken,
    async (req, res) => {

        try {

            if (
                req.user.role !==
                "teacher"
            ) {

                return res.status(403).json({

                    error:
                        "Only teachers can access room management"

                });

            }


            const [rooms] =
                await db.execute(`

                    SELECT

                        r.*,

                        COUNT(
                            DISTINCT ra.id
                        ) AS occupied_slots,

                        GROUP_CONCAT(
                            DISTINCT u.name
                        ) AS student_names,

                        GROUP_CONCAT(
                            DISTINCT s.roll_no
                        ) AS roll_numbers

                    FROM rooms r

                    LEFT JOIN room_allocations ra

                        ON r.id =
                           ra.room_id

                        AND ra.status =
                            'active'

                    LEFT JOIN students s

                        ON ra.student_id =
                           s.id

                    LEFT JOIN users u

                        ON s.user_id =
                           u.id

                    GROUP BY r.id

                    ORDER BY
                        r.block,
                        r.room_number

                `);


            const formattedRooms =
                rooms.map(room => ({

                    ...room,

                    student_names:
                        room.student_names
                            ? room.student_names.split(",")
                            : [],

                    roll_numbers:
                        room.roll_numbers
                            ? room.roll_numbers.split(",")
                            : [],

                    availability:
                        Number(room.capacity) -
                        Number(room.occupied_slots)

                }));


            res.json(
                formattedRooms
            );


        } catch (error) {

            console.error(
                "Room management error:",
                error
            );


            res.status(500).json({

                error:
                    "Failed to fetch rooms"

            });

        }

    }
);


// ============================================================
// UPDATE ROOM
// ============================================================

app.post(
    "/api/rooms/update",
    authenticateToken,
    async (req, res) => {

        try {

            if (
                req.user.role !==
                "teacher"
            ) {

                return res.status(403).json({

                    error:
                        "Only teachers can modify rooms"

                });

            }


            const {
                roomId,
                capacity,
                status
            } = req.body;


            await db.execute(`

                UPDATE rooms

                SET

                    capacity = ?,

                    status = ?,

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = ?

            `, [

                capacity,

                status,

                roomId

            ]);


            res.json({

                message:
                    "Room updated successfully"

            });


        } catch (error) {

            console.error(
                "Room update error:",
                error
            );


            res.status(500).json({

                error:
                    "Failed to update room"

            });

        }

    }
);


// ============================================================
// FEE TYPE MANAGEMENT
// ============================================================

app.post(
    "/api/fees/types",
    authenticateToken,
    async (req, res) => {

        try {

            if (
                req.user.role !==
                "admin"
            ) {

                return res.status(403).json({

                    error:
                        "Only admins can manage fee types"

                });

            }


            const {
                name,
                amount,
                description,
                academic_year,
                semester
            } = req.body;


            // IMPORTANT:
            // Use db, not pool.

            const [result] =
                await db.execute(`

                    INSERT INTO fee_types
                    (
                        name,
                        amount,
                        description,
                        academic_year,
                        semester
                    )

                    VALUES (?, ?, ?, ?, ?)

                `, [

                    name,

                    amount,

                    description,

                    academic_year,

                    semester

                ]);


            res.status(201).json({

                message:
                    "Fee type created successfully",

                feeTypeId:
                    result.insertId

            });


        } catch (error) {

            console.error(
                "Fee type creation error:",
                error
            );


            res.status(500).json({

                error:
                    "Failed to create fee type"

            });

        }

    }
);


// ============================================================
// ATTENDANCE
// ============================================================

app.post(
    "/api/attendance/mark",
    authenticateToken,
    async (req, res) => {

        try {

            if (
                req.user.role !==
                "teacher"
            ) {

                return res.status(403).json({

                    error:
                        "Only teachers can mark attendance"

                });

            }


            const {
                student_id,
                date,
                status,
                remarks
            } = req.body;


            await db.execute(`

                INSERT INTO attendance
                (
                    student_id,
                    date,
                    status,
                    marked_by,
                    remarks
                )

                VALUES (?, ?, ?, ?, ?)

                ON DUPLICATE KEY UPDATE

                    status =
                        VALUES(status),

                    remarks =
                        VALUES(remarks),

                    marked_by =
                        VALUES(marked_by)

            `, [

                student_id,

                date,

                status,

                req.user.id,

                remarks

            ]);


            res.json({

                message:
                    "Attendance marked successfully"

            });


        } catch (error) {

            console.error(
                "Attendance marking error:",
                error
            );


            res.status(500).json({

                error:
                    "Failed to mark attendance"

            });

        }

    }
);


// ============================================================
// MOUNT NORMAL ROUTES
// ============================================================

app.use(
    "/api/auth",
    authRoutes
);


app.use(
    "/api/student",
    studentRoutes
);


app.use(
    "/api/teacher",
    teacherRoutes
);


app.use(
    "/api/rooms",
    roomRoutes
);


// ============================================================
// TEST ROUTE
// ============================================================

app.get(
    "/api/test",
    (req, res) => {

        res.json({

            success: true,

            message:
                "Backend is running"

        });

    }
);


// ============================================================
// 404 HANDLER
// ============================================================

app.use(
    (req, res) => {

        console.log(
            "404:",
            req.method,
            req.originalUrl
        );


        res.status(404).json({

            error:
                "Route not found",

            method:
                req.method,

            path:
                req.originalUrl

        });

    }
);


// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "Unhandled server error:",
            error
        );


        res.status(500).json({

            error:
                "Internal server error"

        });

    }
);


// ============================================================
// START SERVER
// ============================================================

const PORT =
    process.env.PORT || 5000;


app.listen(
    PORT,
    () => {

        console.log(
            `Server is running on port ${PORT}`
        );

        console.log(
            `Student room endpoint: http://localhost:${PORT}/api/student/allocated-room`
        );

        console.log(
            `Student room-details endpoint: http://localhost:${PORT}/api/student/room-details`
        );

    }
);