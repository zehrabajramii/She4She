const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const socketio = require("socket.io");
const io = socketio(server);

// 🔥 Firebase Admin SDK Setup (E NDRYSHUAR)
const admin = require("firebase-admin"); // Përdor firebase-admin
const serviceAccount = require("./she4she-776f9-firebase-adminsdk-fbsvc-40321c4f8e.json");


// Kontrollo nëse Firebase Admin tashmë është inicializuar për të shmangur gabimet
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://she4she-776f9-default-rtdb.firebaseio.com"
  });
}
const db = admin.database(); // Përdor admin.database()

// 🎀 Shërbe skedarët statikë të frontend-it
app.use(express.static(__dirname + "/frontend"));

// 💬 Logjika e WebSocket-it
io.on("connection", (socket) => {
  console.log("🌸 Një përdorues u lidh me sistemin She4She.");

  // 🔁 Bashkohu në dhomën e bisedës
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    console.log(`🔗 Përdoruesi u bashkua në dhomën e bisedës: ${roomId}`);
  });

  // 💬 Dërgo mesazh në bisedë
  socket.on("send_message", ({ roomId, sender, message }) => {
    console.log(`📨 Mesazh nga ${sender} në ${roomId}: ${message}`);

    // Dërgo mesazhin të gjithë në dhomën e duhur
    io.to(roomId).emit("receive_message", { sender, message });

    // Ruaj në Firebase Realtime Database për persistencë
    // Kujdes: Kjo rrugë 'chats' nuk përdoret nga front-end.
    // Mesazhet ruhen tashmë direkt në `supports/${roomId}/messages` nga front-endi.
    // Kjo pjesë mund të jetë e panevojshme ose duhet rregulluar në varësi të modelit tuaj të të dhënave.
    // Nëse e mbani, sigurohuni që struktura e `chats` është e nevojshme.
    const chatRef = db.ref(`chats/${roomId}`); // Kujdes: Shih shënimin sipër!
    chatRef.push({ sender, message, timestamp: new Date().toISOString() });
  });

  // 🆘 Trajto kërkesat për ndihmë – TANI KJO NUK DO TË PËRDORET KËTU NGA FRONT-END.
  // Front-endi e ruan direkt në 'supports' tashmë.
  socket.on("supportRequest", (data) => {
    console.log("🆘 Kërkesa për ndihmë u mor (server side - kjo socket emit mund të mos jetë e nevojshme):", data);

    // Kjo logjikë më poshtë është e panevojshme nëse front-endi e ruan direkt.
    // Nëse dëshironi që serveri të bëjë ruajtjen, duhet ta ndryshoni logjikën e front-endit.
    // Për momentin, po e lë por me shënim.
    const supportLogsRef = db.ref("supportRequestsLog");
    supportLogsRef
      .push({
        timestamp: new Date().toISOString(),
        emotion: data.emotion,
        location: data.location,
        status: data.status || "new",
      })
      .then(() => {
        console.log("✅ Kërkesa për ndihmë u ruajt me sukses në Firebase (server side)!");
      })
      .catch((error) => {
        console.error("❌ Gabim gjatë ruajtjes së kërkesës në Firebase (server side):", error);
      });
  });

  socket.on("disconnect", () => {
    console.log("💔 Përdoruesi u shkëput nga sistemi She4She.");
  });
});

// 🚀 Nise serverin
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎀 Serveri She4She dëgjon në portën ${PORT}.`);
});