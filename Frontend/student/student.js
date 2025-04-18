document.addEventListener("DOMContentLoaded", async () => {
    const roomContainer = document.querySelector(".room-info");

    // Fetch room details from the backend
    async function fetchRoomDetails() {
        try {
            const response = await fetch("http://localhost:5000/api/rooms");
            const rooms = await response.json();

            // Render room details
            roomContainer.innerHTML = rooms.map(room => `
                <div class="room-card">
                    <h3>${room.name}</h3>
                    <div class="room-details">
                        <strong>Amenities:</strong>
                        <ul>${room.amenities.map(amenity => `<li>${amenity}</li>`).join('')}</ul>
                        <strong>Roommates:</strong>
                        <ul>${room.roommates.map(mate => `<li>${mate}</li>`).join('')}</ul>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error("Error fetching room details:", error);
        }
    }

    // Call the function to fetch and display room details
    fetchRoomDetails();
});