import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
if (process.env.GENERATION_MODE && process.env.GENERATION_MODE !== "mock") {
  throw new Error("Only mock generation is implemented in the Day 1 foundation.");
}
const origin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const server = createServer(createApp(origin));
const io = new Server(server, {cors: {origin}, maxHttpBufferSize: 8192});
io.on("connection", socket => socket.emit("server:ready", {version: 1, mode: "mock"}));
server.listen(Number(process.env.PORT ?? 4000), () => console.log("AuraGen API listening"));
function shutdown() { io.close(); server.close(); }
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
