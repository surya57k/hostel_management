document.addEventListener("DOMContentLoaded", function () {

    // ============================================================
    // API CONFIGURATION
    // ============================================================

    const API_BASE_URL =
        'http://localhost:5000/api';


    // ============================================================
    // FETCH WITH AUTHENTICATION
    // ============================================================

    async function fetchWithAuth(endpoint, options = {}) {

        const token =
            localStorage.getItem('token');


        // Remove duplicate /api if supplied
        let cleanEndpoint = endpoint;

        if (cleanEndpoint.startsWith('/api')) {
            cleanEndpoint =
                cleanEndpoint.substring(4);
        }


        try {

            const response =
                await fetch(
                    `${API_BASE_URL}${cleanEndpoint}`,
                    {
                        ...options,

                        headers: {
                            'Content-Type':
                                'application/json',

                            'Authorization':
                                `Bearer ${token}`,

                            ...options.headers
                        }
                    }
                );


            // Try to parse JSON
            let data = {};

            try {

                data =
                    await response.json();

            } catch (jsonError) {

                data = {};

            }


            // ====================================================
            // UNAUTHORIZED
            // ====================================================

            if (response.status === 401) {

                localStorage.clear();

                window.location.href =
                    '../auth/login.html';

                return null;
            }


            // ====================================================
            // NOT FOUND
            // ====================================================

            if (response.status === 404) {

                return null;
            }


            // ====================================================
            // OTHER ERRORS
            // ====================================================

            if (!response.ok) {

                throw new Error(
                    data.error ||
                    data.message ||
                    `HTTP error! status: ${response.status}`
                );
            }


            return data;


        } catch (error) {

            console.error(
                `API Error (${endpoint}):`,
                error
            );

            throw error;
        }
    }


    // ============================================================
    // LOGOUT
    // ============================================================

    window.logout = function () {

        localStorage.removeItem('token');

        localStorage.removeItem('userData');


        showNotification(
            'Logging out...',
            'info'
        );


        setTimeout(() => {

            window.location.href =
                '../auth/login.html';

        }, 1000);
    };


    // ============================================================
    // SHOW NOTIFICATION
    // ============================================================

    function showNotification(
        message,
        type = 'info'
    ) {

        const notification =
            document.createElement('div');


        notification.className =
            `notification ${type}`;


        notification.textContent =
            message;


        document.body.appendChild(
            notification
        );


        setTimeout(() => {

            notification.remove();

        }, 3000);
    }


    // ============================================================
    // LOGOUT BUTTON
    // ============================================================

    const logoutButton =
        document.getElementById(
            'logoutButton'
        );


    if (logoutButton) {

        logoutButton.addEventListener(
            'click',
            function (e) {

                e.preventDefault();

                logout();

            }
        );
    }


    // ============================================================
    // FETCH USER DATA
    // ============================================================

    async function fetchUserData() {

        try {

            const response =
                await fetchWithAuth(
                    '/student/profile'
                );


            return response;

        } catch (error) {

            console.error(
                'Error fetching user data:',
                error
            );


            return null;
        }
    }


    // ============================================================
    // INITIALIZE DASHBOARD
    // ============================================================

    async function initializeDashboard() {

        try {

            const [
                complaintsResponse,
                roomResponse
            ] = await Promise.allSettled([

                fetchWithAuth(
                    '/student/complaints'
                ),

                fetchWithAuth(
                    '/student/allocated-room'
                )

            ]);


            // ----------------------------------------------------
            // Complaints counter
            // ----------------------------------------------------

            const pendingComplaintsElement =
                document.getElementById(
                    "pendingComplaints"
                );


            if (
                pendingComplaintsElement &&
                complaintsResponse.status ===
                    'fulfilled'
            ) {

                const complaints =
                    complaintsResponse.value
                        ?.complaints || [];


                const pendingCount =
                    complaints.filter(
                        c =>
                            c.status ===
                            'pending'
                    ).length || 0;


                pendingComplaintsElement.innerText =
                    pendingCount;
            }


            // ----------------------------------------------------
            // Room information
            // ----------------------------------------------------

            const roomInfoElement =
                document.getElementById(
                    "roomInfo"
                );


            if (roomInfoElement) {

                if (
                    roomResponse.status ===
                        'fulfilled' &&
                    roomResponse.value
                ) {

                    roomInfoElement.innerText =
                        `${roomResponse.value.block}-${roomResponse.value.room_number}`;

                } else {

                    roomInfoElement.innerText =
                        'Not Allocated';
                }
            }


        } catch (error) {

            console.error(
                'Error initializing dashboard:',
                error
            );


            showNotification(
                'Some dashboard features may be unavailable',
                'warning'
            );
        }
    }


    // ============================================================
    // CALCULATE ATTENDANCE
    // ============================================================

    function calculateAttendancePercentage(
        attendance
    ) {

        if (
            !attendance ||
            !attendance.length
        ) {

            return 0;
        }


        const total =
            attendance.length;


        const present =
            attendance.filter(
                record =>
                    record.status ===
                    'present'
            ).length;


        return Math.round(
            (present / total) * 100
        );
    }


    // ============================================================
    // SHOW ERROR
    // ============================================================

    function showError(message) {

        const errorElement =
            document.createElement('div');


        errorElement.className =
            'alert alert-danger';


        errorElement.innerText =
            message;


        document.body.insertBefore(
            errorElement,
            document.body.firstChild
        );


        setTimeout(() => {

            errorElement.remove();

        }, 5000);
    }


    // ============================================================
    // SHOW SUCCESS
    // ============================================================

    function showSuccess(message) {

        document.getElementById(
            "content"
        ).innerHTML = `

            <div class="success-message">

                <i class="fas fa-check-circle"></i>

                <p>
                    ${message}
                </p>

            </div>

        `;
    }


    // ============================================================
    // PROFILE
    // ============================================================

    window.updateProfile =
        async function () {

            try {

                const profile =
                    await fetchWithAuth(
                        '/student/profile'
                    );


                const qrResponse =
                    await fetchWithAuth(
                        '/student/generate-qr'
                    );


                document.getElementById(
                    "content"
                ).innerHTML = `

                    <div class="profile-section">

                        <div class="profile-header">

                            <div class="profile-image">

                                <i class="fas fa-user"></i>

                            </div>


                            <div class="profile-info">

                                <h2>
                                    ${profile?.name || 'Student'}
                                </h2>


                                <p>
                                    ${profile?.student_dept || 'Department'}
                                    -
                                    ${profile?.year || 'Year'}
                                    Year
                                </p>


                                <p>
                                    Roll No:
                                    ${profile?.roll_no || 'N/A'}
                                </p>

                            </div>

                        </div>


                        <div class="profile-details">

                            <div class="detail-row">

                                <span>
                                    Email
                                </span>

                                <span>
                                    ${profile?.email || 'N/A'}
                                </span>

                            </div>


                            <div class="detail-row">

                                <span>
                                    Phone
                                </span>

                                <span>
                                    ${profile?.phone || 'N/A'}
                                </span>

                            </div>


                            <div class="detail-row">

                                <span>
                                    Department
                                </span>

                                <span>
                                    ${profile?.student_dept || 'N/A'}
                                </span>

                            </div>


                            <div class="detail-row">

                                <span>
                                    Year
                                </span>

                                <span>
                                    ${profile?.year || 'N/A'}
                                </span>

                            </div>


                            <div class="detail-row">

                                <span>
                                    Section
                                </span>

                                <span>
                                    ${profile?.section || 'N/A'}
                                </span>

                            </div>


                            <div class="detail-row">

                                <span>
                                    Roll Number
                                </span>

                                <span>
                                    ${profile?.roll_no || 'N/A'}
                                </span>

                            </div>


                            ${
                                qrResponse?.qrImage

                                ? `

                                    <div class="qr-section">

                                        <h3>
                                            Your QR Code
                                        </h3>


                                        <div id="qr-display">

                                            <img
                                                src="${qrResponse.qrImage}"
                                                alt="QR Code"
                                                id="qrImage"
                                            />

                                        </div>


                                        <div class="qr-actions">

                                            <button
                                                onclick="downloadQR()"
                                                class="qr-button"
                                            >

                                                <i class="fas fa-download"></i>

                                                Download QR Code

                                            </button>


                                            <button
                                                onclick="regenerateQR()"
                                                class="qr-button"
                                            >

                                                <i class="fas fa-sync"></i>

                                                Regenerate

                                            </button>

                                        </div>

                                    </div>

                                `

                                : ''
                            }

                        </div>

                    </div>

                `;


            } catch (error) {

                console.error(
                    'Error fetching profile:',
                    error
                );


                showNotification(
                    'Failed to load profile data',
                    'error'
                );
            }
        };


    // ============================================================
    // DOWNLOAD QR
    // ============================================================

    window.downloadQR =
        function () {

            const qrImage =
                document.getElementById(
                    'qrImage'
                );


            if (!qrImage) {

                return;
            }


            const link =
                document.createElement('a');


            link.download =
                'hostel-qr-code.png';


            link.href =
                qrImage.src;


            document.body.appendChild(
                link
            );


            link.click();


            document.body.removeChild(
                link
            );


            showNotification(
                'QR Code downloaded successfully',
                'success'
            );
        };


    // ============================================================
    // REGENERATE QR
    // ============================================================

    window.regenerateQR =
        async function () {

            try {

                const response =
                    await fetchWithAuth(
                        '/api/auth/profile/regenerate-qr'
                    );


                const qrDisplay =
                    document.getElementById(
                        'qr-display'
                    );


                if (
                    qrDisplay &&
                    response?.qrImage
                ) {

                    qrDisplay.innerHTML =
                        `<img src="${response.qrImage}" alt="QR Code" />`;


                    showNotification(
                        'QR Code regenerated successfully',
                        'success'
                    );
                }


            } catch (error) {

                console.error(
                    'Error regenerating QR:',
                    error
                );


                showError(
                    'Failed to regenerate QR code'
                );
            }
        };


    // ============================================================
    // VIEW ROOM DETAILS
    // ============================================================

    window.viewRoomDetails =
        async function () {

            try {

                const response =
                    await fetchWithAuth(
                        '/student/allocated-room'
                    );


                // ------------------------------------------------
                // No room allocated
                // ------------------------------------------------

                if (!response) {

                    document.getElementById(
                        "content"
                    ).innerHTML = `

                        <div class="room-section">

                            <div class="alert alert-info">

                                <i class="fas fa-info-circle"></i>

                                <h3>
                                    No Room Allocated
                                </h3>


                                <p>
                                    You have not been allocated
                                    a room yet.
                                </p>


                                <p>
                                    Please contact the hostel
                                    administrator for room allocation.
                                </p>

                            </div>

                        </div>

                    `;

                    return;
                }


                // ------------------------------------------------
                // Backend error
                // ------------------------------------------------

                if (response.error) {

                    document.getElementById(
                        "content"
                    ).innerHTML = `

                        <div class="room-section">

                            <div class="alert alert-info">

                                <i class="fas fa-info-circle"></i>


                                <p>
                                    ${response.error}
                                </p>


                                <p>
                                    Please contact the hostel
                                    administrator for room allocation.
                                </p>

                            </div>

                        </div>

                    `;

                    return;
                }


                // ------------------------------------------------
                // Validate room
                // ------------------------------------------------

                if (!response.room_number) {

                    throw new Error(
                        'Invalid room data received'
                    );
                }


                // ------------------------------------------------
                // Display room
                // ------------------------------------------------

                document.getElementById(
                    "content"
                ).innerHTML = `

                    <div class="room-section">

                        <h2>
                            Room Details
                        </h2>


                        <div class="room-info">

                            <div class="room-card">

                                <h3>
                                    Room
                                    ${response.room_number}
                                </h3>


                                <p>

                                    <strong>
                                        Block:
                                    </strong>

                                    ${response.block || 'N/A'}

                                </p>


                                <p>

                                    <strong>
                                        Floor:
                                    </strong>

                                    ${response.floor || 'N/A'}

                                </p>


                                <p>

                                    <strong>
                                        Room Type:
                                    </strong>

                                    ${response.room_type || 'N/A'}

                                </p>


                                <p>

                                    <strong>
                                        Capacity:
                                    </strong>

                                    ${response.capacity || 'N/A'}

                                </p>


                                <p>

                                    <strong>
                                        Available Slots:
                                    </strong>

                                    ${
                                        response.available_slots
                                        ?? 'N/A'
                                    }

                                </p>


                                <p>

                                    <strong>
                                        Allocation Date:
                                    </strong>


                                    ${
                                        response.allocated_date

                                        ? new Date(
                                            response.allocated_date
                                          ).toLocaleDateString()

                                        : 'N/A'
                                    }

                                </p>


                                ${
                                    response.roommates &&
                                    response.roommates.length > 0

                                    ? `

                                        <div class="roommates">

                                            <h4>
                                                Roommates
                                            </h4>


                                            <ul>

                                                ${
                                                    response.roommates
                                                        .map(
                                                            mate =>
                                                                `<li>${mate.name || mate}</li>`
                                                        )
                                                        .join('')
                                                }

                                            </ul>

                                        </div>

                                    `

                                    : `

                                        <p>

                                            <strong>
                                                Roommates:
                                            </strong>

                                            No roommates

                                        </p>

                                    `
                                }

                            </div>

                        </div>

                    </div>

                `;


            } catch (error) {

                console.error(
                    'Error fetching room details:',
                    error
                );


                document.getElementById(
                    "content"
                ).innerHTML = `

                    <div class="room-section">

                        <div class="alert alert-danger">

                            <i class="fas fa-exclamation-circle"></i>


                            <p>
                                Failed to load room details.
                            </p>


                            <p>
                                Please try again later.
                            </p>


                            <p class="error-details">

                                Error:
                                ${error.message}

                            </p>

                        </div>

                    </div>

                `;
            }
        };


    // ============================================================
// REQUEST GATE PASS
// ============================================================

window.requestGatePass = async function () {

    const content = document.getElementById("content");

    if (!content) {
        console.error("Content element not found");
        return;
    }

    try {

        // --------------------------------------------------------
        // Load existing gate pass requests
        // --------------------------------------------------------

        let passes = [];

        try {

            const response =
                await fetchWithAuth(
                    "/student/gate-passes"
                );

            if (Array.isArray(response)) {
                passes = response;
            }

        } catch (error) {

            console.warn(
                "Could not load gate pass history:",
                error
            );

        }


        // --------------------------------------------------------
        // Display form + history
        // --------------------------------------------------------

        content.innerHTML = `

            <div class="gate-pass-section">

                <h2>
                    <i class="fas fa-door-open"></i>
                    Gate Pass Request
                </h2>


                <!-- Request Form -->

                <div class="gate-pass-form">

                    <h3>
                        Request a New Gate Pass
                    </h3>


                    <form id="gatePassForm">


                        <!-- Reason -->

                        <div class="form-group">

                            <label for="gatePassReason">
                                Reason for Leave
                            </label>

                            <textarea
                                id="gatePassReason"
                                name="reason"
                                rows="4"
                                placeholder="Enter the reason for leaving the hostel..."
                                required
                            ></textarea>

                        </div>


                        <!-- Leave Date -->

                        <div class="form-group">

                            <label for="gatePassLeaveDate">
                                Leave Date
                            </label>

                            <input
                                type="date"
                                id="gatePassLeaveDate"
                                name="leave_date"
                                required
                            />

                        </div>


                        <!-- Return Date -->

                        <div class="form-group">

                            <label for="gatePassReturnDate">
                                Expected Return Date
                            </label>

                            <input
                                type="date"
                                id="gatePassReturnDate"
                                name="return_date"
                                required
                            />

                        </div>


                        <button
                            type="submit"
                            class="gate-pass-submit-btn"
                        >

                            <i class="fas fa-paper-plane"></i>

                            Submit Request

                        </button>

                    </form>

                </div>


                <!-- Request History -->

                <div class="pass-history">

                    <h3>
                        <i class="fas fa-history"></i>
                        Gate Pass History
                    </h3>


                    ${
                        passes.length === 0

                        ?

                        `
                        <div class="alert alert-info">

                            <i class="fas fa-info-circle"></i>

                            <p>
                                You have not submitted any gate
                                pass requests yet.
                            </p>

                        </div>
                        `

                        :

                        `

                        <div class="gate-pass-table-wrapper">

                            <table class="gate-pass-table">

                                <thead>

                                    <tr>

                                        <th>
                                            Reason
                                        </th>

                                        <th>
                                            Leave Date
                                        </th>

                                        <th>
                                            Return Date
                                        </th>

                                        <th>
                                            Status
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    ${
                                        passes.map(
                                            pass => {

                                                let statusClass =
                                                    "pending";

                                                if (
                                                    pass.status ===
                                                    "approved"
                                                ) {
                                                    statusClass =
                                                        "approved";
                                                }

                                                if (
                                                    pass.status ===
                                                    "rejected"
                                                ) {
                                                    statusClass =
                                                        "rejected";
                                                }


                                                return `

                                                    <tr>

                                                        <td>
                                                            ${
                                                                pass.reason ||
                                                                "N/A"
                                                            }
                                                        </td>

                                                        <td>
                                                            ${
                                                                pass.leave_date
                                                                    ? new Date(
                                                                        pass.leave_date
                                                                    ).toLocaleDateString()
                                                                    : "N/A"
                                                            }
                                                        </td>

                                                        <td>
                                                            ${
                                                                pass.return_date
                                                                    ? new Date(
                                                                        pass.return_date
                                                                    ).toLocaleDateString()
                                                                    : "N/A"
                                                            }
                                                        </td>

                                                        <td>

                                                            <span
                                                                class="gate-pass-status ${statusClass}"
                                                            >
                                                                ${
                                                                    (
                                                                        pass.status ||
                                                                        "pending"
                                                                    )
                                                                        .charAt(0)
                                                                        .toUpperCase()
                                                                    +
                                                                    (
                                                                        pass.status ||
                                                                        "pending"
                                                                    ).slice(1)
                                                                }
                                                            </span>

                                                        </td>

                                                    </tr>

                                                `;

                                            }
                                        ).join("")
                                    }

                                </tbody>

                            </table>

                        </div>

                        `

                    }

                </div>

            </div>

        `;


        // --------------------------------------------------------
        // Set minimum dates
        // --------------------------------------------------------

        const today =
            new Date()
                .toISOString()
                .split("T")[0];


        const leaveDateInput =
            document.getElementById(
                "gatePassLeaveDate"
            );

        const returnDateInput =
            document.getElementById(
                "gatePassReturnDate"
            );


        if (leaveDateInput) {
            leaveDateInput.min = today;
        }

        if (returnDateInput) {
            returnDateInput.min = today;
        }


        // --------------------------------------------------------
        // Update return-date minimum
        // --------------------------------------------------------

        if (leaveDateInput && returnDateInput) {

            leaveDateInput.addEventListener(
                "change",
                function () {

                    returnDateInput.min =
                        this.value;

                    if (
                        returnDateInput.value &&
                        returnDateInput.value <
                        this.value
                    ) {

                        returnDateInput.value =
                            this.value;

                    }

                }
            );

        }


        // --------------------------------------------------------
        // FORM SUBMIT
        // --------------------------------------------------------

        const form =
            document.getElementById(
                "gatePassForm"
            );


        if (!form) {
            console.error(
                "Gate pass form not found"
            );
            return;
        }


        form.addEventListener(
            "submit",
            async function (e) {

                e.preventDefault();


                const reason =
                    document
                        .getElementById(
                            "gatePassReason"
                        )
                        .value
                        .trim();


                const leaveDate =
                    document
                        .getElementById(
                            "gatePassLeaveDate"
                        )
                        .value;


                const returnDate =
                    document
                        .getElementById(
                            "gatePassReturnDate"
                        )
                        .value;


                // ------------------------------------------------
                // Validation
                // ------------------------------------------------

                if (!reason) {

                    alert(
                        "Please enter the reason for leave."
                    );

                    return;

                }


                if (!leaveDate) {

                    alert(
                        "Please select the leave date."
                    );

                    return;

                }


                if (!returnDate) {

                    alert(
                        "Please select the expected return date."
                    );

                    return;

                }


                if (returnDate < leaveDate) {

                    alert(
                        "Return date cannot be earlier than leave date."
                    );

                    return;

                }


                // ------------------------------------------------
                // Disable button
                // ------------------------------------------------

                const submitButton =
                    form.querySelector(
                        'button[type="submit"]'
                    );


                if (submitButton) {

                    submitButton.disabled =
                        true;

                    submitButton.innerHTML = `

                        <i class="fas fa-spinner fa-spin"></i>

                        Submitting...

                    `;

                }


                try {

                    console.log(
                        "Submitting gate pass request..."
                    );

                    console.log(
                        "Reason:",
                        reason
                    );

                    console.log(
                        "Leave Date:",
                        leaveDate
                    );

                    console.log(
                        "Return Date:",
                        returnDate
                    );


                    // ------------------------------------------------
                    // Send request to backend
                    // ------------------------------------------------

                    const response =
                        await fetchWithAuth(
                            "/student/gate-pass",
                            {
                                method: "POST",

                                body: JSON.stringify({

                                    reason:
                                        reason,

                                    leave_date:
                                        leaveDate,

                                    return_date:
                                        returnDate

                                })
                            }
                        );


                    console.log(
                        "Gate pass response:",
                        response
                    );


                    if (!response) {

                        throw new Error(
                            "Failed to submit gate pass request"
                        );

                    }


                    if (response.error) {

                        throw new Error(
                            response.error
                        );

                    }


                    // ------------------------------------------------
                    // Success
                    // ------------------------------------------------

                    alert(
                        "Gate pass request submitted successfully!"
                    );


                    // Reload gate pass page
                    await window.requestGatePass();


                } catch (error) {

                    console.error(
                        "Gate pass submission error:",
                        error
                    );


                    alert(
                        error.message ||
                        "Failed to submit gate pass request."
                    );


                    // Restore button

                    if (submitButton) {

                        submitButton.disabled =
                            false;

                        submitButton.innerHTML = `

                            <i class="fas fa-paper-plane"></i>

                            Submit Request

                        `;

                    }

                }

            }
        );


    } catch (error) {

        console.error(
            "Error loading gate pass section:",
            error
        );


        content.innerHTML = `

            <div class="alert alert-danger">

                <i class="fas fa-exclamation-circle"></i>

                <h3>
                    Failed to Load Gate Pass
                </h3>

                <p>
                    ${error.message}
                </p>

            </div>

        `;

    }

};


    // ============================================================
    // FEE DETAILS
    // ============================================================

    window.viewFeeDetails =
        async function () {

            try {

                const feeData = await fetchWithAuth('/student/fee-status');

const assignments =
    Array.isArray(feeData?.current_semester)
        ? feeData.current_semester
        : [];

if (assignments.length === 0) {

                    document.getElementById(
                        "content"
                    ).innerHTML = `

                        <div class="fees-section">

                            <div class="no-fees-message">

                                <i class="fas fa-info-circle"></i>

                                <p>
                                    No fees have been assigned yet.
                                    Please check back later or
                                    contact your hostel administrator.
                                </p>

                            </div>

                        </div>

                    `;

                    return;
                }


                const totalAssigned =
                    assignments.reduce(
                        (sum, fee) =>
                            sum +
                            Number(fee.amount || 0),
                        0
                    );


                const totalPaid =
                    assignments.reduce(
                        (sum, fee) => {

                            return sum +

                                (
                                    fee.payments || []
                                ).reduce(
                                    (
                                        pSum,
                                        payment
                                    ) =>
                                        pSum +
                                        Number(
                                            payment.amount_paid ||
                                            0
                                        ),
                                    0
                                );

                        },
                        0
                    );


                const totalDue =
                    totalAssigned -
                    totalPaid;


                document.getElementById(
                    "content"
                ).innerHTML = `

                    <div class="fees-section">

                        <div class="fee-summary">

                            <div class="fee-card">

                                <h3>
                                    Total Fee
                                </h3>

                                <span class="amount">
                                    ₹${totalAssigned.toLocaleString()}
                                </span>

                            </div>


                            <div class="fee-card">

                                <h3>
                                    Paid
                                </h3>

                                <span class="amount">
                                    ₹${totalPaid.toLocaleString()}
                                </span>

                            </div>


                            <div class="fee-card due">

                                <h3>
                                    Due Amount
                                </h3>

                                <span class="amount">
                                    ₹${totalDue.toLocaleString()}
                                </span>

                            </div>

                        </div>


                        <div class="fee-assignments">

                            <h3>
                                Fee Details
                            </h3>


                            <table class="fee-table">

                                <thead>

                                    <tr>

                                        <th>
                                            Fee Type
                                        </th>

                                        <th>
                                            Academic Year
                                        </th>

                                        <th>
                                            Semester
                                        </th>

                                        <th>
                                            Amount
                                        </th>

                                        <th>
                                            Due Date
                                        </th>

                                        <th>
                                            Status
                                        </th>

                                        <th>
                                            Action
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    ${
                                        assignments
                                            .map(
                                                fee => `

                                                    <tr>

                                                        <td>
                                                            ${fee.name}
                                                        </td>

                                                        <td>
                                                            ${fee.academic_year}
                                                        </td>

                                                        <td>
                                                            ${fee.semester}
                                                        </td>

                                                        <td>
                                                            ₹${Number(fee.amount || 0).toLocaleString()}
                                                        </td>

                                                        <td>
                                                            ${
                                                                new Date(
                                                                    fee.due_date
                                                                ).toLocaleDateString()
                                                            }
                                                        </td>

                                                        <td>

                                                            <span
                                                                class="status ${String(fee.status).toLowerCase()}"
                                                            >
                                                                ${fee.status}
                                                            </span>

                                                        </td>

                                                        <td>

                                                            ${
                                                                fee.status !==
                                                                'paid'

                                                                ? `

                                                                    <button
                                                                        onclick="initiatePayment(${fee.assignment_id})"
                                                                        class="pay-button"
                                                                    >

                                                                        <i class="fas fa-money-bill"></i>

                                                                        Pay Now

                                                                    </button>

                                                                `

                                                                : `

                                                                    <span class="paid-text">
                                                                        Paid
                                                                    </span>

                                                                `
                                                            }

                                                        </td>

                                                    </tr>

                                                `
                                            )
                                            .join('')
                                    }

                                </tbody>

                            </table>

                        </div>


                        <div class="payment-history">

                            <h3>
                                Payment History
                            </h3>


                            <table class="payment-table">

                                <thead>

                                    <tr>

                                        <th>
                                            Date
                                        </th>

                                        <th>
                                            Fee Type
                                        </th>

                                        <th>
                                            Amount
                                        </th>

                                        <th>
                                            Method
                                        </th>

                                        <th>
                                            Status
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    ${
                                        (
                                            feeData.payments ||
                                            []
                                        )
                                        .map(
                                            payment => `

                                                <tr>

                                                    <td>
                                                        ${
                                                            new Date(
                                                                payment.payment_date
                                                            ).toLocaleDateString()
                                                        }
                                                    </td>

                                                    <td>
                                                        ${payment.fee_name}
                                                    </td>

                                                    <td>
                                                        ₹${Number(payment.amount_paid || 0).toLocaleString()}
                                                    </td>

                                                    <td>
                                                        ${payment.payment_method}
                                                    </td>

                                                    <td>

                                                        <span
                                                            class="status ${String(payment.status).toLowerCase()}"
                                                        >
                                                            ${payment.status}
                                                        </span>

                                                    </td>

                                                </tr>

                                            `
                                        )
                                        .join('')
                                    }

                                </tbody>

                            </table>

                        </div>

                    </div>

                `;


            } catch (error) {

                console.error(
                    'Error fetching fee details:',
                    error
                );


                showError(
                    'Failed to load fee details. Please try again.'
                );
            }
        };


    // ============================================================
    // INITIATE PAYMENT
    // ============================================================

    // ============================================================
// INITIATE PAYMENT - DEMO
// ============================================================

window.initiatePayment =
    async function (assignmentId) {

        try {

            const confirmPayment =
                confirm(
                    'Proceed with the demo payment for this fee?'
                );


            if (!confirmPayment) {
                return;
            }


            const response =
                await fetchWithAuth(
                    `/student/fee-payment/${assignmentId}`,
                    {
                        method: 'POST'
                    }
                );


            console.log(
                'Payment response:',
                response
            );


            if (response?.success) {

                alert(
                    `Payment successful!\n\n` +
                    `Amount: ₹${Number(
                        response.payment.amount
                    ).toLocaleString()}\n` +
                    `Transaction ID: ${
                        response.payment.transaction_id
                    }\n` +
                    `Receipt ID: ${
                        response.payment.receipt_id
                    }`
                );


                // Refresh fee details
                if (
                    typeof window.viewFeeStatus ===
                    'function'
                ) {
                    await window.viewFeeStatus();
                }


            } else {

                showError(
                    response?.error ||
                    'Payment failed. Please try again.'
                );

            }


        } catch (error) {

            console.error(
                'Error initiating payment:',
                error
            );


            showError(
                'Failed to process payment. Please try again.'
            );

        }

    };

    // ============================================================
    // SUBMIT COMPLAINT
    // ============================================================

    window.submitComplaint =
        async function () {

            try {

                const response =
                    await fetchWithAuth(
                        '/student/complaints'
                    );


                const complaints =
                    response?.complaints || [];


                document.getElementById(
                    "content"
                ).innerHTML = `

                    <div class="complaints-section">

                        <h2>
                            Submit Complaint
                        </h2>


                        <form
                            id="complaintForm"
                            class="complaint-form"
                        >

                            <div class="form-group">

                                <label for="subject">
                                    Subject
                                </label>

                                <input
                                    type="text"
                                    id="subject"
                                    name="subject"
                                    required
                                />

                            </div>


                            <div class="form-group">

                                <label for="description">
                                    Description
                                </label>

                                <textarea
                                    id="description"
                                    name="description"
                                    required
                                ></textarea>

                            </div>


                            <button type="submit">

                                <i class="fas fa-paper-plane"></i>

                                Submit Complaint

                            </button>

                        </form>


                        <div class="complaints-history">

                            <h3>
                                Complaint History
                            </h3>


                            <table class="complaints-table">

                                <thead>

                                    <tr>

                                        <th>
                                            Date
                                        </th>

                                        <th>
                                            Subject
                                        </th>

                                        <th>
                                            Description
                                        </th>

                                        <th>
                                            Status
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    ${
                                        complaints
                                            .map(
                                                complaint => `

                                                    <tr>

                                                        <td>
                                                            ${
                                                                new Date(
                                                                    complaint.created_at
                                                                ).toLocaleDateString()
                                                            }
                                                        </td>

                                                        <td>
                                                            ${complaint.subject}
                                                        </td>

                                                        <td>
                                                            ${complaint.description}
                                                        </td>

                                                        <td>

                                                            <span
                                                                class="status ${String(complaint.status).toLowerCase()}"
                                                            >
                                                                ${complaint.status}
                                                            </span>

                                                        </td>

                                                    </tr>

                                                `
                                            )
                                            .join('')
                                    }

                                </tbody>

                            </table>

                        </div>

                    </div>

                `;


                document
                    .getElementById(
                        "complaintForm"
                    )
                    .addEventListener(
                        "submit",
                        async function (event) {

                            event.preventDefault();


                            const formData =
                                new FormData(this);


                            try {

                                const response =
                                    await fetchWithAuth(
                                        '/student/complaints',
                                        {
                                            method:
                                                'POST',

                                            body:
                                                JSON.stringify(
                                                    {
                                                        subject:
                                                            formData.get(
                                                                'subject'
                                                            ),

                                                        description:
                                                            formData.get(
                                                                'description'
                                                            ),

                                                        status:
                                                            'pending'
                                                    }
                                                )
                                        }
                                    );


                                if (
                                    response?.success
                                ) {

                                    showSuccess(
                                        'Complaint submitted successfully'
                                    );


                                    this.reset();


                                    submitComplaint();

                                } else {

                                    showError(
                                        response?.message ||
                                        'Failed to submit complaint'
                                    );
                                }


                            } catch (error) {

                                console.error(
                                    'Error submitting complaint:',
                                    error
                                );


                                showError(
                                    'Failed to submit complaint. Please try again.'
                                );
                            }

                        }
                    );


            } catch (error) {

                console.error(
                    'Error fetching complaints:',
                    error
                );


                showError(
                    'Failed to load complaints data. Please try again.'
                );
            }
        };


    // ============================================================
// STUDENT ATTENDANCE
// ============================================================

window.viewAttendance = async function () {

    try {

        console.log("Loading student attendance...");

        const response =
            await fetchWithAuth(
                '/student/attendance'
            );

        console.log(
            "Attendance response:",
            response
        );


        // --------------------------------------------------------
        // Backend returns:
        //
        // {
        //   attendance_records: [],
        //   statistics: {}
        // }
        // --------------------------------------------------------

        const attendance =
            Array.isArray(
                response?.attendance_records
            )
                ? response.attendance_records
                : [];


        const statistics =
            response?.statistics || {};


        const totalDays =
            Number(
                statistics.total_days || 0
            );


        const presentDays =
            Number(
                statistics.present_days || 0
            );


        const absentDays =
            Number(
                statistics.absent_days || 0
            );


        const leaveDays =
            Number(
                statistics.leave_days || 0
            );


        const attendancePercentage =
            Number(
                statistics.attendance_percentage || 0
            );


        console.log(
            "Attendance records:",
            attendance
        );


        console.log(
            "Attendance statistics:",
            statistics
        );


        // --------------------------------------------------------
        // Content element
        // --------------------------------------------------------

        const content =
            document.getElementById(
                "content"
            );


        if (!content) {

            console.error(
                "Content element not found"
            );

            return;

        }


        // --------------------------------------------------------
        // Display
        // --------------------------------------------------------

        content.innerHTML = `

            <div class="attendance-section">

                <h2>
                    <i class="fas fa-calendar-check"></i>
                    My Attendance
                </h2>


                <!-- Statistics -->

                <div class="attendance-stats">


                    <div class="attendance-stat-card">

                        <div class="stat-icon">
                            <i class="fas fa-calendar"></i>
                        </div>

                        <div class="stat-info">

                            <span class="stat-label">
                                Total Days
                            </span>

                            <span class="stat-value">
                                ${totalDays}
                            </span>

                        </div>

                    </div>


                    <div class="attendance-stat-card">

                        <div class="stat-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>

                        <div class="stat-info">

                            <span class="stat-label">
                                Present
                            </span>

                            <span class="stat-value">
                                ${presentDays}
                            </span>

                        </div>

                    </div>


                    <div class="attendance-stat-card">

                        <div class="stat-icon">
                            <i class="fas fa-times-circle"></i>
                        </div>

                        <div class="stat-info">

                            <span class="stat-label">
                                Absent
                            </span>

                            <span class="stat-value">
                                ${absentDays}
                            </span>

                        </div>

                    </div>


                    <div class="attendance-stat-card">

                        <div class="stat-icon">
                            <i class="fas fa-user-clock"></i>
                        </div>

                        <div class="stat-info">

                            <span class="stat-label">
                                Leave
                            </span>

                            <span class="stat-value">
                                ${leaveDays}
                            </span>

                        </div>

                    </div>


                    <div class="attendance-stat-card percentage-card">

                        <div class="stat-icon">
                            <i class="fas fa-chart-pie"></i>
                        </div>

                        <div class="stat-info">

                            <span class="stat-label">
                                Attendance
                            </span>

                            <span class="stat-value">
                                ${attendancePercentage}%
                            </span>

                        </div>

                    </div>


                </div>


                <!-- Attendance History -->

                <div class="attendance-history">

                    <h3>
                        <i class="fas fa-history"></i>
                        Attendance History
                    </h3>


                    ${
                        attendance.length === 0

                        ?

                        `
                        <div class="alert alert-info">

                            <i class="fas fa-info-circle"></i>

                            <span>
                                No attendance records found.
                            </span>

                        </div>
                        `

                        :

                        `
                        <div class="attendance-table-container">

                            <table class="attendance-table">

                                <thead>

                                    <tr>

                                        <th>
                                            Date
                                        </th>

                                        <th>
                                            Status
                                        </th>

                                        <th>
                                            Remarks
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    ${
                                        attendance
                                            .map(record => {

                                                let statusClass =
                                                    "pending";

                                                let statusText =
                                                    record.status ||
                                                    "Unknown";


                                                if (
                                                    record.status ===
                                                    "present"
                                                ) {

                                                    statusClass =
                                                        "present";

                                                }


                                                if (
                                                    record.status ===
                                                    "absent"
                                                ) {

                                                    statusClass =
                                                        "absent";

                                                }


                                                if (
                                                    record.status ===
                                                    "leave"
                                                ) {

                                                    statusClass =
                                                        "leave";

                                                }


                                                return `

                                                    <tr>

                                                        <td>
                                                            ${
                                                                record.date
                                                                    ? new Date(
                                                                        record.date
                                                                    ).toLocaleDateString()
                                                                    : "N/A"
                                                            }
                                                        </td>


                                                        <td>

                                                            <span
                                                                class="attendance-status ${statusClass}"
                                                            >

                                                                ${
                                                                    statusText
                                                                        .charAt(0)
                                                                        .toUpperCase()
                                                                    +
                                                                    statusText.slice(1)
                                                                }

                                                            </span>

                                                        </td>


                                                        <td>
                                                            ${
                                                                record.remarks ||
                                                                "-"
                                                            }
                                                        </td>

                                                    </tr>

                                                `;

                                            })
                                            .join("")
                                    }

                                </tbody>

                            </table>

                        </div>
                        `

                    }

                </div>

            </div>

        `;


    } catch (error) {

        console.error(
            "Error fetching attendance:",
            error
        );


        const content =
            document.getElementById(
                "content"
            );


        if (content) {

            content.innerHTML = `

                <div class="alert alert-danger">

                    <i class="fas fa-exclamation-circle"></i>

                    <span>
                        Failed to load attendance.
                        Please try again.
                    </span>

                </div>

            `;

        }

    }

};


    // ============================================================
    // ANNOUNCEMENTS
    // ============================================================

    window.viewAnnouncements =
        async function () {

            try {

                const response =
                    await fetchWithAuth(
                        '/student/announcements'
                    );


                const announcements =
                    response?.announcements || [];


                document.getElementById(
                    "content"
                ).innerHTML = `

                    <div class="announcements-section">

                        <h2>
                            Announcements
                        </h2>


                        <div class="announcements-list">

                            ${
                                announcements
                                    .map(
                                        announcement => `

                                            <div
                                                class="announcement-card"
                                            >

                                                <div
                                                    class="announcement-header"
                                                >

                                                    <h3>
                                                        ${announcement.title}
                                                    </h3>


                                                    <span class="date">

                                                        ${
                                                            new Date(
                                                                announcement.date
                                                            ).toLocaleDateString()
                                                        }

                                                    </span>

                                                </div>


                                                <div
                                                    class="announcement-content"
                                                >

                                                    <p>
                                                        ${announcement.content}
                                                    </p>

                                                </div>


                                                <div
                                                    class="announcement-footer"
                                                >

                                                    <span class="author">

                                                        Posted by:
                                                        ${announcement.author}

                                                    </span>

                                                </div>

                                            </div>

                                        `
                                    )
                                    .join('')
                            }

                        </div>

                    </div>

                `;


            } catch (error) {

                console.error(
                    'Error fetching announcements:',
                    error
                );


                showError(
                    'Failed to load announcements. Please try again.'
                );
            }
        };


    // ============================================================
    // CHANGE PASSWORD
    // ============================================================

    window.changePassword =
        async function () {

            document.getElementById(
                "content"
            ).innerHTML = `

                <div class="form-container">

                    <h2>
                        Change Password
                    </h2>


                    <form
                        id="changePasswordForm"
                    >

                        <div class="form-group">

                            <label for="currentPassword">
                                Current Password
                            </label>

                            <input
                                type="password"
                                id="currentPassword"
                                required
                            />

                        </div>


                        <div class="form-group">

                            <label for="newPassword">
                                New Password
                            </label>

                            <input
                                type="password"
                                id="newPassword"
                                required
                            />

                        </div>


                        <div class="form-group">

                            <label for="confirmPassword">
                                Confirm New Password
                            </label>

                            <input
                                type="password"
                                id="confirmPassword"
                                required
                            />

                        </div>


                        <button type="submit">
                            Change Password
                        </button>

                    </form>

                </div>

            `;


            document
    .getElementById("changePasswordForm")
    .addEventListener(
        "submit",
        async (e) => {

            e.preventDefault();

            const currentPassword =
                document.getElementById(
                    "currentPassword"
                ).value;

            const newPassword =
                document.getElementById(
                    "newPassword"
                ).value;

            const confirmPassword =
                document.getElementById(
                    "confirmPassword"
                ).value;

            if (!currentPassword ||
                !newPassword ||
                !confirmPassword) {

                showNotification(
                    "Please fill all password fields",
                    "error"
                );

                return;
            }

            if (newPassword !== confirmPassword) {

                showNotification(
                    "New passwords do not match",
                    "error"
                );

                return;
            }

            try {

                const response =
                    await fetchWithAuth(
                        "/auth/change-password",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                currentPassword,
                                newPassword,
                                confirmPassword
                            })
                        }
                    );

                if (response?.success) {

                    showNotification(
                        response.message ||
                        "Password changed successfully",
                        "success"
                    );

                    document
                        .getElementById(
                            "changePasswordForm"
                        )
                        .reset();

                } else {

                    showNotification(
                        response?.error ||
                        "Failed to change password",
                        "error"
                    );
                }

            } catch (error) {

                console.error(
                    "Change password error:",
                    error
                );

                showNotification(
                    error.message ||
                    "Failed to change password",
                    "error"
                );
            }
        }
    );
        };


    // ============================================================
    // LOAD COMPLAINTS
    // ============================================================

    async function loadComplaints() {

        try {

            const response =
                await fetchWithAuth(
                    '/student/complaints'
                );


            const complaints =
                response?.complaints || [];


            const complaintsTable =
                document.querySelector(
                    '.complaints-table tbody'
                );


            if (!complaintsTable) {

                return;
            }


            complaintsTable.innerHTML =
                complaints
                    .map(
                        complaint => `

                            <tr>

                                <td>
                                    ${
                                        new Date(
                                            complaint.created_at
                                        ).toLocaleDateString()
                                    }
                                </td>


                                <td>
                                    ${complaint.subject}
                                </td>


                                <td>
                                    ${complaint.description}
                                </td>


                                <td>

                                    <span
                                        class="status ${String(complaint.status).toLowerCase()}"
                                    >
                                        ${complaint.status}
                                    </span>

                                </td>

                            </tr>

                        `
                    )
                    .join('');


        } catch (error) {

            console.error(
                'Error loading complaints:',
                error
            );


            showError(
                'Failed to load complaints history'
            );
        }
    }


    // ============================================================
    // INITIALIZE COMPLAINTS VIEW
    // ============================================================

    function initializeComplaintsView() {

        const content =
            document.getElementById(
                'content'
            );


        content.innerHTML = `

            <div class="complaints-section">

                <h2>
                    Submit Complaint
                </h2>


                <form
                    id="complaintForm"
                    class="complaint-form"
                >

                    <div class="form-group">

                        <label for="subject">
                            Subject
                        </label>

                        <input
                            type="text"
                            id="subject"
                            name="subject"
                            required
                        />

                    </div>


                    <div class="form-group">

                        <label for="description">
                            Description
                        </label>

                        <textarea
                            id="description"
                            name="description"
                            required
                        ></textarea>

                    </div>


                    <button type="submit">

                        <i class="fas fa-paper-plane"></i>

                        Submit Complaint

                    </button>

                </form>


                <div class="complaints-history">

                    <h3>
                        Complaint History
                    </h3>


                    <table class="complaints-table">

                        <thead>

                            <tr>

                                <th>
                                    Date
                                </th>

                                <th>
                                    Subject
                                </th>

                                <th>
                                    Description
                                </th>

                                <th>
                                    Status
                                </th>

                            </tr>

                        </thead>


                        <tbody></tbody>

                    </table>

                </div>

            </div>

        `;


        const form =
            document.getElementById(
                'complaintForm'
            );


        form.addEventListener(
            'submit',
            async (e) => {

                e.preventDefault();

                await submitComplaint();

            }
        );


        loadComplaints();
    }


    // ============================================================
    // MARK ANNOUNCEMENT AS READ
    // ============================================================

    async function markAnnouncementAsRead(
        announcementId
    ) {

        try {

            await fetchWithAuth(
                `/student/announcements/${announcementId}/read`,
                {
                    method: 'POST'
                }
            );


            const announcements =
                await fetchWithAuth(
                    '/student/announcements'
                );


            if (
                typeof updateAnnouncementsSection ===
                'function'
            ) {

                updateAnnouncementsSection(
                    announcements
                );
            }


        } catch (error) {

            console.error(
                'Error marking announcement as read:',
                error
            );


            showError(
                'Failed to mark announcement as read'
            );
        }
    }


    // ============================================================
// GET STUDENT ID
// ============================================================

async function getStudentId() {

    try {

        const userData =
            localStorage.getItem('userData');

        if (userData) {

            const user =
                JSON.parse(userData);

            if (user.student_id) {

                return Number(
                    user.student_id
                );

            }

        }

    } catch (error) {

        console.warn(
            'Could not read userData:',
            error
        );

    }


    // --------------------------------------------------------
    // Get student profile from backend
    // --------------------------------------------------------

    const profile =
        await fetchWithAuth(
            '/student/profile'
        );


    if (!profile) {

        throw new Error(
            'Unable to get student profile'
        );

    }


    console.log(
        'Student profile:',
        profile
    );


    // IMPORTANT:
    // We need students.id, not users.id.

    if (profile.student_id) {

        return Number(
            profile.student_id
        );

    }


    throw new Error(
        'Student ID not found in profile'
    );

}


// ============================================================
// SHOW AVAILABLE ROOMS
// ============================================================

window.showAvailableRooms =
    async function () {

        try {

            console.log(
                'Loading available rooms...'
            );


            // ------------------------------------------------
            // Fetch available rooms
            // ------------------------------------------------

            const rooms =
                await fetchWithAuth(
                    '/student/rooms'
                );


            console.log(
                'Available rooms:',
                rooms
            );


            const content =
                document.getElementById(
                    'content'
                );


            if (!content) {

                console.error(
                    'Content element not found'
                );

                return;

            }


            // ------------------------------------------------
            // Check response
            // ------------------------------------------------

            if (!rooms) {

                content.innerHTML = `

                    <div class="room-section">

                        <h2>
                            Available Rooms
                        </h2>

                        <div class="alert alert-danger">

                            <i class="fas fa-exclamation-circle"></i>

                            <p>
                                Failed to load available rooms.
                            </p>

                        </div>

                    </div>

                `;

                return;

            }


            if (!Array.isArray(rooms)) {

                console.error(
                    'Invalid rooms response:',
                    rooms
                );

                throw new Error(
                    'Invalid rooms data received'
                );

            }


            // ------------------------------------------------
            // No rooms
            // ------------------------------------------------

            if (rooms.length === 0) {

                content.innerHTML = `

                    <div class="room-section">

                        <h2>
                            Available Rooms
                        </h2>

                        <div class="alert alert-info">

                            <i class="fas fa-info-circle"></i>

                            <h3>
                                No Available Rooms
                            </h3>

                            <p>
                                There are currently no rooms
                                available for allocation.
                            </p>

                        </div>

                    </div>

                `;

                return;

            }


            // ------------------------------------------------
            // Display rooms
            // ------------------------------------------------

            content.innerHTML = `

                <div class="room-section">

                    <h2>
                        Available Rooms
                    </h2>


                    <div class="room-grid">

                        ${
                            rooms
                                .map(
                                    room => `

                                        <div
                                            class="room-card ${
                                                Number(
                                                    room.available_slots
                                                ) > 0

                                                    ? 'available'

                                                    : 'full'
                                            }"
                                        >

                                            <h3>

                                                Room
                                                ${room.room_number}

                                            </h3>


                                            <p>

                                                <strong>
                                                    Block:
                                                </strong>

                                                ${
                                                    room.block ||
                                                    'N/A'
                                                }

                                            </p>


                                            <p>

                                                <strong>
                                                    Floor:
                                                </strong>

                                                ${
                                                    room.floor ??
                                                    'N/A'
                                                }

                                            </p>


                                            <p>

                                                <strong>
                                                    Type:
                                                </strong>

                                                ${
                                                    room.room_type ||
                                                    'N/A'
                                                }

                                            </p>


                                            <p>

                                                <strong>
                                                    Capacity:
                                                </strong>

                                                ${
                                                    room.capacity ??
                                                    'N/A'
                                                }

                                            </p>


                                            <p>

                                                <strong>
                                                    Available Slots:
                                                </strong>

                                                ${
                                                    room.available_slots ??
                                                    0
                                                }

                                            </p>


                                            <p>

                                                <strong>
                                                    Status:
                                                </strong>

                                                ${
                                                    room.status ||
                                                    'available'
                                                }

                                            </p>


                                            ${
                                                Number(
                                                    room.available_slots
                                                ) > 0

                                                ? `

                                                    <button
                                                        type="button"
                                                        class="select-room-button"
                                                        data-room-id="${room.id}"
                                                    >

                                                        <i
                                                            class="fas fa-bed"
                                                        ></i>

                                                        Select Room

                                                    </button>

                                                `

                                                : `

                                                    <span
                                                        class="full-tag"
                                                    >
                                                        Full
                                                    </span>

                                                `
                                            }

                                        </div>

                                    `
                                )
                                .join('')
                        }

                    </div>

                </div>

            `;


            // ------------------------------------------------
            // IMPORTANT
            // Add click events AFTER dynamic HTML
            // has been inserted into the page.
            // ------------------------------------------------

            const roomButtons =
                document.querySelectorAll(
                    '.select-room-button'
                );


            console.log(
                'Room buttons found:',
                roomButtons.length
            );


            roomButtons.forEach(
                button => {

                    button.addEventListener(
                        'click',
                        async function (event) {

                            event.preventDefault();

                            event.stopPropagation();


                            const roomId =
                                this.getAttribute(
                                    'data-room-id'
                                );


                            console.log(
                                'Select Room clicked:',
                                roomId
                            );


                            if (!roomId) {

                                showNotification(
                                    'Invalid room selected',
                                    'error'
                                );

                                return;

                            }


                            await selectRoom(
                                Number(roomId)
                            );

                        }
                    );

                }
            );


        } catch (error) {

            console.error(
                'Error loading available rooms:',
                error
            );


            const content =
                document.getElementById(
                    'content'
                );


            if (content) {

                content.innerHTML = `

                    <div class="room-section">

                        <div class="alert alert-danger">

                            <i
                                class="fas fa-exclamation-circle"
                            ></i>

                            <h3>
                                Failed to Load Available Rooms
                            </h3>

                            <p>
                                ${
                                    error.message ||
                                    'Please try again later.'
                                }
                            </p>

                        </div>

                    </div>

                `;

            }

        }

    };


// ============================================================
// SELECT ROOM
// ============================================================

window.selectRoom =
    async function (roomId) {

        try {

            console.log(
                '================================'
            );

            console.log(
                'SELECT ROOM'
            );

            console.log(
                'Room ID:',
                roomId
            );

            console.log(
                '================================'
            );


            // ------------------------------------------------
            // Validate room ID
            // ------------------------------------------------

            if (!roomId) {

                showNotification(
                    'Invalid room selected',
                    'error'
                );

                return;

            }


            // ------------------------------------------------
            // Confirmation
            // ------------------------------------------------

            const confirmed =
                window.confirm(
                    'Are you sure you want to select this room?'
                );


            if (!confirmed) {

                return;

            }


            // ------------------------------------------------
            // Get student ID
            // ------------------------------------------------

            const studentId =
                await getStudentId();


            console.log(
                'Student ID:',
                studentId
            );


            if (!studentId) {

                showNotification(
                    'Student information not found. Please login again.',
                    'error'
                );

                return;

            }


            // ------------------------------------------------
            // Send allocation request
            // ------------------------------------------------

            console.log(
                'Sending allocation request...'
            );


            console.log(
                'URL:',
                `/rooms/${roomId}/allocate`
            );


            console.log(
                'Body:',
                {
                    student_id:
                        Number(studentId)
                }
            );


            const response =
                await fetchWithAuth(

                    `/rooms/${roomId}/allocate`,

                    {

                        method:
                            'POST',

                        body:
                            JSON.stringify({

                                student_id:
                                    Number(
                                        studentId
                                    )

                            })

                    }

                );


            console.log(
                'Room allocation response:',
                response
            );


            // ------------------------------------------------
            // No response
            // ------------------------------------------------

            if (!response) {

                showNotification(
                    'Failed to allocate room',
                    'error'
                );

                return;

            }


            // ------------------------------------------------
            // Backend returned error
            // ------------------------------------------------

            if (response.error) {

                showNotification(
                    response.error,
                    'error'
                );

                return;

            }


            // ------------------------------------------------
            // Success
            // ------------------------------------------------

            showNotification(
                response.message ||
                'Room allocated successfully!',
                'success'
            );


            // ------------------------------------------------
            // Refresh available rooms
            // ------------------------------------------------

            await showAvailableRooms();


            // ------------------------------------------------
            // Open Room Details
            // ------------------------------------------------

            setTimeout(
                async function () {

                    await viewRoomDetails();

                },
                700
            );


        } catch (error) {

            console.error(
                'Error selecting room:',
                error
            );


            showNotification(
                error.message ||
                'Error selecting room',
                'error'
            );

        }

    };


// ============================================================
// VIEW ROOM DETAILS
// ============================================================

window.viewRoomDetails =
    async function () {

        try {

            const response =
                await fetchWithAuth(
                    '/student/allocated-room'
                );


            console.log(
                'Room details response:',
                response
            );


            // ------------------------------------------------
            // No room allocated
            // ------------------------------------------------

            if (!response) {

                document.getElementById(
                    'content'
                ).innerHTML = `

                    <div class="room-section">

                        <div class="alert alert-info">

                            <i
                                class="fas fa-info-circle"
                            ></i>

                            <h3>
                                No Room Allocated
                            </h3>

                            <p>
                                You have not been allocated
                                a room yet.
                            </p>

                            <p>
                                Please select an available
                                room.
                            </p>

                            <button
                                type="button"
                                class="select-room-button"
                                onclick="showAvailableRooms()"
                            >

                                <i
                                    class="fas fa-door-open"
                                ></i>

                                View Available Rooms

                            </button>

                        </div>

                    </div>

                `;

                return;

            }


            // ------------------------------------------------
            // Backend error
            // ------------------------------------------------

            if (response.error) {

                document.getElementById(
                    'content'
                ).innerHTML = `

                    <div class="room-section">

                        <div class="alert alert-danger">

                            <i
                                class="fas fa-exclamation-circle"
                            ></i>

                            <p>
                                ${response.error}
                            </p>

                        </div>

                    </div>

                `;

                return;

            }


            // ------------------------------------------------
            // Validate room
            // ------------------------------------------------

            if (!response.room_number) {

                throw new Error(
                    'Invalid room data received'
                );

            }


            // ------------------------------------------------
            // Display room details
            // ------------------------------------------------

            document.getElementById(
                'content'
            ).innerHTML = `

                <div class="room-section">

                    <h2>
                        Room Details
                    </h2>


                    <div class="room-info">

                        <div class="room-card">

                            <h3>
                                Room
                                ${response.room_number}
                            </h3>


                            <p>

                                <strong>
                                    Block:
                                </strong>

                                ${
                                    response.block ||
                                    'N/A'
                                }

                            </p>


                            <p>

                                <strong>
                                    Floor:
                                </strong>

                                ${
                                    response.floor ??
                                    'N/A'
                                }

                            </p>


                            <p>

                                <strong>
                                    Room Type:
                                </strong>

                                ${
                                    response.room_type ||
                                    'N/A'
                                }

                            </p>


                            <p>

                                <strong>
                                    Capacity:
                                </strong>

                                ${
                                    response.capacity ??
                                    'N/A'
                                }

                            </p>


                            <p>

                                <strong>
                                    Available Slots:
                                </strong>

                                ${
                                    response.available_slots ??
                                    'N/A'
                                }

                            </p>


                            <p>

                                <strong>
                                    Allocation Date:
                                </strong>

                                ${
                                    response.allocated_date

                                    ? new Date(
                                        response.allocated_date
                                      ).toLocaleDateString()

                                    : 'N/A'
                                }

                            </p>


                            ${
                                response.roommates &&
                                response.roommates.length > 0

                                ? `

                                    <div
                                        class="roommates"
                                    >

                                        <h4>
                                            Roommates
                                        </h4>


                                        <ul>

                                            ${
                                                response.roommates
                                                    .map(
                                                        mate => `

                                                            <li>

                                                                ${
                                                                    mate.name ||
                                                                    mate
                                                                }

                                                            </li>

                                                        `
                                                    )
                                                    .join('')
                                            }

                                        </ul>

                                    </div>

                                `

                                : `

                                    <p>

                                        <strong>
                                            Roommates:
                                        </strong>

                                        No roommates

                                    </p>

                                `
                            }

                        </div>

                    </div>

                </div>

            `;


        } catch (error) {

            console.error(
                'Error fetching room details:',
                error
            );


            document.getElementById(
                'content'
            ).innerHTML = `

                <div class="room-section">

                    <div class="alert alert-danger">

                        <i
                            class="fas fa-exclamation-circle"
                        ></i>

                        <h3>
                            Failed to load room details
                        </h3>

                        <p>
                            ${error.message}
                        </p>

                    </div>

                </div>

            `;

        }

    };


// ============================================================
// INITIALIZE DASHBOARD
// ============================================================

initializeDashboard();

});
