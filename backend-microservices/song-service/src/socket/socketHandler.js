import { Server } from "socket.io";
import { roomSet, roomGet, roomDel } from "../config/redis.js";

export default function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // CREATE ROOM
    socket.on("create-room", async ({ roomId, playlist, userId, userName }) => {
      const existing = await roomGet(roomId);
      if (existing) {
        return socket.emit("error", { message: "Room already exists" });
      }

      const roomData = {
        id: roomId,
        hostId: userId,
        hostName: userName,
        playlist,
        currentSongIndex: 0,
        currentTime: 0,
        isPlaying: false,
        startTime: null,
        members: {
          [userId]: { id: userId, name: userName, socketId: socket.id },
        },
      };

      await roomSet(roomId, roomData);
      socket.join(roomId);
      
      socket.emit("room-created", { 
        roomId, 
        playlist, 
        isHost: true 
      });
      
      console.log(`Room ${roomId} created by ${userName}`);
    });

    // JOIN ROOM
    socket.on("join-room", async ({ roomId, userId, userName }) => {
      const room = await roomGet(roomId);

      if (!room) {
        return socket.emit("error", { message: "Room not found" });
      }

      // Add member
      room.members[userId] = { id: userId, name: userName, socketId: socket.id };
      await roomSet(roomId, room);
      
      socket.join(roomId);

      // Calculate exact current state
      let syncData = {
        currentSongIndex: room.currentSongIndex,
        currentTime: room.currentTime,
        isPlaying: room.isPlaying,
      };

      // If host is playing, calculate elapsed time
      if (room.isPlaying && room.startTime) {
        const elapsedSinceStart = (Date.now() - room.startTime) / 1000;
        let calculatedTime = room.currentTime + elapsedSinceStart;
        let songIndex = room.currentSongIndex;
        const playlist = room.playlist;

        // Check if we need to advance to next song
        while (songIndex < playlist.length && calculatedTime >= playlist[songIndex].duration) {
          calculatedTime -= playlist[songIndex].duration;
          songIndex++;
        }

        // If past last song, stop at end
        if (songIndex >= playlist.length) {
          songIndex = playlist.length - 1;
          calculatedTime = playlist[songIndex].duration;
          syncData.isPlaying = false;
        } else {
          syncData.currentSongIndex = songIndex;
          syncData.currentTime = calculatedTime;
        }
      }

      // Send room state to new member
      socket.emit("room-joined", {
        roomId,
        playlist: room.playlist,
        isHost: false,
        hostName: room.hostName,
        ...syncData,
        autoPlay: syncData.isPlaying,
      });

      // Notify others
      const memberCount = Object.keys(room.members).length;
      socket.to(roomId).emit("member-joined", {
        userId,
        userName,
        memberCount,
      });

      console.log(`${userName} joined room ${roomId}. Synced to song ${syncData.currentSongIndex} at ${syncData.currentTime.toFixed(2)}s`);
    });

    // HOST CONTROLS - PLAY
    socket.on("host-play", async ({ roomId, songIndex, currentTime }) => {
      const room = await roomGet(roomId);
      if (!room) return;

      room.currentSongIndex = songIndex;
      room.currentTime = currentTime;
      room.isPlaying = true;
      room.startTime = Date.now();

      await roomSet(roomId, room);

      socket.to(roomId).emit("sync-play", {
        songIndex,
        currentTime,
      });

      console.log(`Room ${roomId}: Playing song ${songIndex} at ${currentTime.toFixed(2)}s`);
    });

    // HOST CONTROLS - PAUSE
    socket.on("host-pause", async ({ roomId, currentTime }) => {
      const room = await roomGet(roomId);
      if (!room) return;

      room.isPlaying = false;
      room.currentTime = currentTime;
      room.startTime = null;

      await roomSet(roomId, room);

      socket.to(roomId).emit("sync-pause", { currentTime });

      console.log(`Room ${roomId}: Paused at ${currentTime.toFixed(2)}s`);
    });

    // HOST CONTROLS - SEEK
    socket.on("host-seek", async ({ roomId, currentTime }) => {
      const room = await roomGet(roomId);
      if (!room) return;

      room.currentTime = currentTime;
      if (room.isPlaying) {
        room.startTime = Date.now();
      }

      await roomSet(roomId, room);

      socket.to(roomId).emit("sync-seek", { currentTime });

      console.log(`Room ${roomId}: Seeked to ${currentTime.toFixed(2)}s`);
    });

    // HOST CONTROLS - CHANGE SONG
    socket.on("host-change-song", async ({ roomId, songIndex, currentTime = 0 }) => {
      const room = await roomGet(roomId);
      if (!room) return;

      room.currentSongIndex = songIndex;
      room.currentTime = currentTime;

      if (room.isPlaying) {
        room.startTime = Date.now();
      }

      await roomSet(roomId, room);

      socket.to(roomId).emit("sync-change-song", {
        songIndex,
        currentTime,
        isPlaying: room.isPlaying,
      });

      console.log(`Room ${roomId}: Changed to song ${songIndex}`);
    });

    // MEMBER REQUEST SYNC
    socket.on("request-sync", async ({ roomId }) => {
      const room = await roomGet(roomId);
      if (!room) return;

      let syncData = {
        songIndex: room.currentSongIndex,
        currentTime: room.currentTime,
        isPlaying: room.isPlaying,
      };

      // Calculate exact position if playing
      if (room.isPlaying && room.startTime) {
        const elapsedSinceStart = (Date.now() - room.startTime) / 1000;
        let calculatedTime = room.currentTime + elapsedSinceStart;
        let songIndex = room.currentSongIndex;
        const playlist = room.playlist;

        while (songIndex < playlist.length && calculatedTime >= playlist[songIndex].duration) {
          calculatedTime -= playlist[songIndex].duration;
          songIndex++;
        }

        if (songIndex >= playlist.length) {
          songIndex = playlist.length - 1;
          calculatedTime = playlist[songIndex].duration;
          syncData.isPlaying = false;
        } else {
          syncData.songIndex = songIndex;
          syncData.currentTime = calculatedTime;
        }
      }

      socket.emit("sync-response", syncData);

      console.log(`Sync requested in room ${roomId}. Sent: song ${syncData.songIndex} at ${syncData.currentTime.toFixed(2)}s`);
    });

    // END ROOM
    socket.on("end-room", async ({ roomId, userId }) => {
      const room = await roomGet(roomId);
      if (!room || room.hostId !== userId) return;

      io.to(roomId).emit("room-ended", {
        message: "Host has ended the livestream",
      });

      await roomDel(roomId);
      io.in(roomId).socketsLeave(roomId);

      console.log(`Room ${roomId} ended and cleared from Redis`);
    });

    // LEAVE ROOM
    socket.on("leave-room", async ({ roomId, userId }) => {
      const room = await roomGet(roomId);
      if (!room) return;

      delete room.members[userId];
      socket.leave(roomId);

      if (userId === room.hostId) {
        io.to(roomId).emit("room-ended", {
          message: "Host has left the livestream",
        });
        await roomDel(roomId);
        io.in(roomId).socketsLeave(roomId);
        console.log(`Room ${roomId} ended (host left) and cleared from Redis`);
      } else {
        await roomSet(roomId, room);
        const memberCount = Object.keys(room.members).length;
        socket.to(roomId).emit("member-left", {
          userId,
          memberCount,
        });
        console.log(`User ${userId} left room ${roomId}`);
      }
    });

    // DISCONNECT
    socket.on("disconnect", async () => {
      console.log("User disconnected:", socket.id);

      // Find and handle room cleanup (scan Redis if needed)
      // For simplicity, we rely on explicit leave-room events
    });
  });

  return io;
}