import { Server, Room } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Schema, type, MapSchema } from "@colyseus/schema";

/* =========================
   WORLD SETTINGS
========================= */

const CHUNK_SIZE = 16;
const WORLD_CHUNKS = 8;

const WORLD_SIZE = CHUNK_SIZE * WORLD_CHUNKS;

const MIN_X = 0;
const MAX_X = WORLD_SIZE - 1;

const MIN_Z = 0;
const MAX_Z = WORLD_SIZE - 1;

const GROUND_Y = 16;

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
        this.lookX = 0;
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
type("number")(Player.prototype, "lookX");
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
            player.lookX = data.lookX;

            if (data.jump)
                player.jump = true;
        });

        this.setSimulationInterval((dtMs) => {

            const dt = dtMs / 1000;

            this.state.players.forEach((player) => {

                const speed = 5;

                // SERVER YAW
                const yawSpeed = 180;
                player.rotY += player.lookX * yawSpeed * dt;

                const moveX = player.inputX;
                const moveZ = player.inputZ;

                // NORMALIZE
                const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
                const nx = len > 0 ? moveX / len : 0;
                const nz = len > 0 ? moveZ / len : 0;

                const rad = player.rotY * Math.PI / 180;

                const forwardX = Math.sin(rad);
                const forwardZ = Math.cos(rad);

                const rightX = Math.cos(rad);
                const rightZ = -Math.sin(rad);

                const worldX = forwardX * nz + rightX * nx;
                const worldZ = forwardZ * nz + rightZ * nx;

                player.x += worldX * speed * dt;
                player.z += worldZ * speed * dt;

                /* -------- WORLD BOUNDARY LOCK -------- */
                player.x = Math.max(MIN_X, Math.min(MAX_X, player.x));
                player.z = Math.max(MIN_Z, Math.min(MAX_Z, player.z));

                // JUMP ONLY HERE
                if (player.jump && player.grounded) {
                    player.velY = 6;
                    player.grounded = false;
                    player.jump = false;
                }

                // GRAVITY
                if (!player.grounded) {
                    player.velY -= 20 * dt;
                    player.y += player.velY * dt;
                }

                if (player.y <= 16) {
                    player.y = 16;
                    player.velY = 0;
                    player.grounded = true;
                } else {
                    player.grounded = false;
                }
            });
        });
    }

    onJoin(client) {
        console.log("Client joined:", client.sessionId);

        const player = new Player();

        player.x = 64;
        player.z = 64;
        player.y = 20;

        player.inputX = 0;
        player.inputZ = 0;
        player.velY = 0;
        player.grounded = false;

        this.state.players.set(client.sessionId, player);

        console.log(`Spawned ${client.sessionId} at X:${player.x} Y:${player.y} Z:${player.z}`
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