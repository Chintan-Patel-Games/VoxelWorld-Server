import { Server, Room } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Schema, type, MapSchema } from "@colyseus/schema";

/* =========================
   Schema Definitions
========================= */

class Player extends Schema {
    constructor() {
        super();

        this.x = 0;
        this.y = 2;
        this.z = 0;
        this.rotY = 0;

        this.velY = 0;
        this.inputX = 0;
        this.inputZ = 0;
        this.grounded = false;
    }
}

type("number")(Player.prototype, "x");
type("number")(Player.prototype, "y");
type("number")(Player.prototype, "z");
type("number")(Player.prototype, "rotY");

// NEW
type("number")(Player.prototype, "velY");
type("number")(Player.prototype, "inputX");
type("number")(Player.prototype, "inputZ");
type("boolean")(Player.prototype, "grounded");

class State extends Schema {
    constructor() {
        super();
        this.players = new MapSchema();
    }
}
type({ map: Player })(State.prototype, "players");

/* =========================
   Room Definition
========================= */

class MyRoom extends Room {

    onCreate() {
        console.log("Room created.");

        this.setState(new State());

        // Handle movement + spawn correction
        this.onMessage("input", (client, data) => {

            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            player.inputX = data.moveX;
            player.inputZ = data.moveY;

            player.rotY += data.lookX * 0.1;

            if (data.jump && player.grounded) {
                player.velY = 6;
                player.grounded = false;
            }
        });

        this.setSimulationInterval((dt) => {

            this.state.players.forEach((player) => {

                const speed = 5;

                // Horizontal Movement
                player.x += player.inputX * speed * dt;
                player.z += player.inputZ * speed * dt;

                // Gravity
                player.velY -= 20 * dt;
                player.y += player.velY * dt;

                // Ground Check (TEMP until voxel collision added)
                if (player.y <= 2) {
                    player.y = 2;
                    player.velY = 0;
                    player.grounded = true;
                }
            });
        });
    }

    onJoin(client) {
        console.log("Client joined:", client.sessionId);

        const player = new Player();
        const chunkSize = 4;

        // Random X/Z inside chunk
        player.x = Math.floor(Math.random() * chunkSize);
        player.z = Math.floor(Math.random() * chunkSize);

        // Temporary Y (client will correct)
        player.y = 0;

        this.state.players.set(client.sessionId, player);

        console.log(
            `Spawned ${client.sessionId} at X:${player.x} Y:${player.y} Z:${player.z}`
        );
    }

    onLeave(client) {
        console.log("Client left:", client.sessionId);
        this.state.players.delete(client.sessionId);
    }
}

/* =========================
   Server Bootstrap
========================= */

const port = process.env.PORT || 2567;

const gameServer = new Server({
    transport: new WebSocketTransport()
});

gameServer.define("my_room", MyRoom);

await gameServer.listen(port);

console.log(`✅ Server running at ws://localhost:${port}`);