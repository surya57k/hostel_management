// Test script to verify navigation functions
console.log("Test script loaded");

// Define test functions for each navigation item
function testManageRooms() {
    console.log("manageRooms function called");
    document.getElementById("content").innerHTML = `
        <h2>Manage Rooms (Test)</h2>
        <div class="dashboard-card">
            <p>This is a test page for Manage Rooms functionality.</p>
        </div>
    `;
}

function testManageGateRequests() {
    console.log("manageGateRequests function called");
    document.getElementById("content").innerHTML = `
        <h2>Gate Pass Requests (Test)</h2>
        <div class="dashboard-card">
            <p>This is a test page for Gate Pass Requests functionality.</p>
        </div>
    `;
}

function testMonitorRoomVacancies() {
    console.log("monitorRoomVacancies function called");
    document.getElementById("content").innerHTML = `
        <h2>Room Vacancies (Test)</h2>
        <div class="dashboard-card">
            <p>This is a test page for Room Vacancies functionality.</p>
        </div>
    `;
}

function testHandleComplaints() {
    console.log("handleComplaints function called");
    document.getElementById("content").innerHTML = `
        <h2>Handle Complaints (Test)</h2>
        <div class="dashboard-card">
            <p>This is a test page for Handle Complaints functionality.</p>
        </div>
    `;
}

function testVerifyFees() {
    console.log("verifyFees function called");
    document.getElementById("content").innerHTML = `
        <h2>Verify Fees (Test)</h2>
        <div class="dashboard-card">
            <p>This is a test page for Verify Fees functionality.</p>
        </div>
    `;
}

function testViewStudentInfo() {
    console.log("viewStudentInfo function called");
    document.getElementById("content").innerHTML = `
        <h2>Student Info (Test)</h2>
        <div class="dashboard-card">
            <p>This is a test page for Student Info functionality.</p>
        </div>
    `;
}

function testGenerateReports() {
    console.log("generateReports function called");
    document.getElementById("content").innerHTML = `
        <h2>Generate Reports (Test)</h2>
        <div class="dashboard-card">
            <p>This is a test page for Generate Reports functionality.</p>
        </div>
    `;
}

function testMarkAttendance() {
    console.log("markAttendance function called");
    document.getElementById("content").innerHTML = `
        <h2>Mark Attendance (Test)</h2>
        <div class="dashboard-card">
            <p>This is a test page for Mark Attendance functionality.</p>
        </div>
    `;
}

// Override the global functions with test functions
window.manageRooms = testManageRooms;
window.manageGateRequests = testManageGateRequests;
window.monitorRoomVacancies = testMonitorRoomVacancies;
window.handleComplaints = testHandleComplaints;
window.verifyFees = testVerifyFees;
window.viewStudentInfo = testViewStudentInfo;
window.generateReports = testGenerateReports;
window.markAttendance = testMarkAttendance;

console.log("Test functions assigned to global window object"); 