const WebSocket = require("ws");

// Create a WebSocket server that listens on port 8080
const wss = new WebSocket.Server({ port: 8080 });

let externalWs = null;
let messageQueue = [];
let connectedClients = 0; // Track the number of connected clients

// Function to create and connect to the external WebSocket server
function createExternalWebSocket() {
    const externalWebSocketUrl =
        "wss://images-api-gw.lyrebirdstudio.net/graphql/realtime?header=eyJob3N0IjoiaW1hZ2VzLWFwaS1ndy5seXJlYmlyZHN0dWRpby5uZXQiLCJ4LWFwaS1rZXkiOiJkYTIteW50c2NnbmFxYmVjcGJ0ZHZzN2tqd2poYzQifQ%3D%3D&payload=e30%3D";
    const externalOptions = {
        headers: {
            "x-api-key": "da2-yntscgnaqbecpbtdvs7kjwjhc4",
            host: "images-api-gw.lyrebirdstudio.net",
        },
        perMessageDeflate: false, // Disable per-message deflate
        handshakeTimeout: 5000, // Timeout for WebSocket handshake
    };

    externalWs = new WebSocket(
        externalWebSocketUrl,
        ["graphql-ws"],
        externalOptions,
    );

    externalWs.on("open", () => {
        console.log("Connected to external WebSocket server");
        externalWs.send('{"type":"connection_init"}');

        // Send any queued messages
        while (messageQueue.length > 0) {
            externalWs.send(messageQueue.shift());
        }
    });

    externalWs.on("message", (externalMessage) => {
        const messageString = externalMessage.toString(); // Convert Buffer to string
        console.log("Received from external WebSocket:", messageString);
      
        let modifiedMessage = messageString
        .replace(/images-gql-api-gw.lyrebirdstudio.net/g, 'https://storage.googleapis.com/firebase_lab')
        .replace(/https:\/\/plat-cdn.lyrebirdstudio.net/g, 'https://storage.googleapis.com/firebase_lab');

        // Optionally, you can parse JSON if needed
        try {
            const jsonMessage = JSON.parse(modifiedMessage);
            console.log("Parsed JSON from external WebSocket:", jsonMessage);

            // Handle specific message types or errors
            if (jsonMessage.type === "error") {
                console.error(
                    "Error from external WebSocket:",
                    jsonMessage.payload.errors,
                );
            }
        } catch (error) {
            console.error("Error parsing JSON from external WebSocket:", error);
        }

        // Broadcast the message to all connected clients
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(modifiedMessage);
            }
        });
    });

    externalWs.on("close", () => {
        console.log("External WebSocket connection closed");
        // Attempt to reconnect after a delay
        setTimeout(createExternalWebSocket, 5000); // Reconnect after 5 seconds
    });

    externalWs.on("error", (error) => {
        console.error("External WebSocket error:", error);
        // Attempt to reconnect after a delay
        setTimeout(createExternalWebSocket, 5000); // Reconnect after 5 seconds
    });
}

// Initialize the external WebSocket connection
createExternalWebSocket();

wss.on("connection", (ws) => {
    console.log("New client connected");
    connectedClients++; // Increment connected clients count

    // Send an initial message to the client when they connect
    ws.send("Welcome to the WebSocket server!");

    // Handle incoming messages from the client
    ws.on("message", (message) => {
        const messageString = message.toString(); // Convert Buffer to string
        console.log("Received from client:", messageString);

        // Optionally, you can parse JSON if needed
        try {
            const jsonMessage = JSON.parse(messageString);
            console.log("Parsed JSON from client:", jsonMessage);
        } catch (error) {
            console.error("Error parsing JSON from client:", error);
        }

        // Forward the message to the external WebSocket if open, otherwise queue it
        if (externalWs.readyState === WebSocket.OPEN) {
            try {
                externalWs.send(messageString); // Forward the message to the external WebSocket
            } catch (error) {
                console.error(
                    "Error sending message to external WebSocket:",
                    error,
                );
            }
        } else {
            messageQueue.push(messageString); // Queue the message if WebSocket is not open
        }

        ws.send(`Server received: ${messageString}`); // Optionally, send a response back to the client
    });

    // Handle client disconnection
    ws.on("close", () => {
        console.log("Client disconnected");
        connectedClients--; // Decrement connected clients count
        externalWs.close(1000, "No connected clients");
        // If no clients are connected, close the external WebSocket
        if (connectedClients === 0 && externalWs) {
            externalWs.close(1000, "No connected clients");
        }
    });
});

console.log("WebSocket server is running on ws://localhost:8080");
