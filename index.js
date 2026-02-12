import { Server, Room } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Schema, type, MapSchema } from "@colyseus/schema";

/* =========================
   Schema Definitions
========================= */

class Player extends Schema {}
type("number")(Player.prototype, "x");
type("number")(Player.prototype, "y");
type("number")(Player.prototype, "z");

type("number")(Player.prototype, "rotY");

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
        this.onMessage("move", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            player.x = data.x;
            player.y = data.y;
            player.z = data.z;
            player.rotY = data.rotY;
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