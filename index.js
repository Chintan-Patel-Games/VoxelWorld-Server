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
        this.lookX = 0;
        this.velY = 0;
        this.inputX = 0;
        this.inputZ = 0;
        this.jump = false;
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
type("boolean")(Player.prototype, "jump");
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

            if (data.jump && player.grounded) {
                player.velY = 6;
                player.grounded = false;
            }
        });

        this.setSimulationInterval((dt) => {

            dt = dt / 1000;

            this.state.players.forEach((player) => {

                const speed = 5;

                // ROTATION FIRST
                player.rotY += player.lookX * 120 * dt;

                const rad = player.rotY * Math.PI / 180;

                const forwardX = Math.sin(rad);
                const forwardZ = Math.cos(rad);

                const rightX = Math.cos(rad);
                const rightZ = -Math.sin(rad);

                const moveX = player.inputX;
                const moveZ = player.inputZ;

                const worldX =
                    forwardX * moveZ +
                    rightX * moveX;

                const worldZ =
                    forwardZ * moveZ +
                    rightZ * moveX;

                player.x += worldX * speed * dt;
                player.z += worldZ * speed * dt;

                // GRAVITY
                player.velY -= 20 * dt;
                player.y += player.velY * dt;

                if (player.y <= 2) {
                    player.y = 2;
                    player.velY = 0;
                    player.grounded = true;
                }
                else {
                    player.grounded = false;
                }
            });
        });
    }

    onJoin(client) {
        console.log("Client joined:", client.sessionId);

        const player = new Player();

        player.x = 8;
        player.z = 8;
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