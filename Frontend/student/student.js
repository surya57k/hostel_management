document.addEventListener("DOMContentLoaded", async () => {

    const roomContainer = document.querySelector(".room-info");


    // ============================================================
    // FETCH ROOM DETAILS
    // ============================================================

    async function fetchRoomDetails() {

        try {

            // Get token from localStorage
            const token =
                localStorage.getItem("token");


            if (!token) {

                roomContainer.innerHTML = `
                    <p>Please login again to view room details.</p>
                `;

                return;
            }


            // ----------------------------------------------------
            // Get rooms
            // ----------------------------------------------------

            const response = await fetch(
                "http://localhost:5000/api/rooms",
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"
                    }
                }
            );


            // ----------------------------------------------------
            // Check HTTP response
            // ----------------------------------------------------

            if (!response.ok) {

                const errorData =
                    await response.json()
                        .catch(() => ({}));


                console.error(
                    "Room API error:",
                    response.status,
                    errorData
                );


                roomContainer.innerHTML = `
                    <p>
                        Failed to fetch rooms.
                        Please try again.
                    </p>
                `;

                return;
            }


            const rooms =
                await response.json();


            console.log(
                "Rooms received:",
                rooms
            );


            // ----------------------------------------------------
            // Check whether rooms exist
            // ----------------------------------------------------

            if (
                !Array.isArray(rooms) ||
                rooms.length === 0
            ) {

                roomContainer.innerHTML = `
                    <p>
                        No rooms are currently available.
                    </p>
                `;

                return;
            }


            // ----------------------------------------------------
            // Render rooms
            // ----------------------------------------------------

            roomContainer.innerHTML =
                rooms.map(room => `

                    <div class="room-card">

                        <h3>
                            Room ${room.room_number}
                        </h3>


                        <div class="room-details">

                            <p>
                                <strong>Block:</strong>
                                ${room.block}
                            </p>


                            <p>
                                <strong>Floor:</strong>
                                ${room.floor}
                            </p>


                            <p>
                                <strong>Room Type:</strong>
                                ${room.room_type}
                            </p>


                            <p>
                                <strong>Capacity:</strong>
                                ${room.capacity}
                            </p>


                            <p>
                                <strong>Available Slots:</strong>
                                ${room.available_slots}
                            </p>


                            <p>
                                <strong>Status:</strong>
                                ${room.status}
                            </p>


                            <p>
                                <strong>Occupied:</strong>
                                ${room.occupied_slots || 0}
                            </p>

                        </div>

                    </div>

                `).join("");


        } catch (error) {

            console.error(
                "Error fetching room details:",
                error
            );


            roomContainer.innerHTML = `
                <p>
                    Failed to connect to the server.
                </p>
            `;
        }
    }


    // ============================================================
    // LOAD ROOMS
    // ============================================================

    fetchRoomDetails();

});