import { useState, useEffect, useRef } from "react";
import { useSocket } from "../contexts/SocketContext";
import { useAuthStore } from "../store/useAuthStore";
import { usePlayerStore } from "../store/usePlayerStore";
import { useRoomStore } from "../store/useRoomStore";
import { useSongStore } from "../store/useSongStore";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { 
  Radio, 
  Users, 
  LogOut,
  RefreshCw,
  Music,
  Loader
} from "lucide-react";

export default function LivePage() {
  const socket = useSocket();
  const { user } = useAuthStore();
  const { songs, fetchSongs, isLoading } = useSongStore();
  const navigate = useNavigate();
  
  const { 
    roomId, 
    isHost, 
    playlist,
    setRoomId, 
    setIsHost, 
    setRoomData, 
    resetRoom 
  } = useRoomStore();

  const {
    currentSong,
    isPlaying,
    queue,
    currentIndex,
    setQueue,
    setIsPlaying,
    clearQueue,
  } = usePlayerStore();

  const [roomIdInput, setRoomIdInput] = useState("");
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [memberCount, setMemberCount] = useState(1);
  const [hostName, setHostName] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [hostPosition, setHostPosition] = useState({ songIndex: 0, time: 0 });

  // Broadcast host position to AudioPlayer via custom event
  useEffect(() => {
    const event = new CustomEvent("livestream-host-position", {
      detail: hostPosition
    });
    window.dispatchEvent(event);
  }, [hostPosition]);

  const previousIndexRef = useRef(null);
  const isInitializedRef = useRef(false);

  // Generate random room ID
  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // Fetch songs on mount
  useEffect(() => {
    if (songs.length === 0) {
      fetchSongs();
    }
  }, []);

  // Get audio element from AudioPlayer
  const getAudioElement = () => {
    return document.querySelector("audio");
  };

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    // ROOM CREATED
    socket.on("room-created", ({ roomId, playlist, isHost }) => {
      console.log("Room created:", { roomId, playlistLength: playlist.length });
      
      setRoomId(roomId);
      setIsHost(true);
      setRoomData({ playlist, startTime: Date.now(), status: "playing" });
      
      // Clear old queue and set new playlist
      clearQueue();
      setQueue(playlist, 0);
      
      toast.success(`Livestream started! Room ID: ${roomId}`);
    });

    // ROOM JOINED
    socket.on("room-joined", ({ 
      roomId, 
      playlist, 
      isHost, 
      hostName,
      currentSongIndex,
      currentTime,
      isPlaying,
      autoPlay
    }) => {
      console.log("Room joined:", { 
        roomId, 
        currentSongIndex, 
        currentTime, 
        isPlaying, 
        playlistLength: playlist.length 
      });
      
      setRoomId(roomId);
      setIsHost(false);
      setHostName(hostName);
      setRoomData({ playlist, startTime: Date.now(), status: "playing" });
      setHostPosition({ songIndex: currentSongIndex, time: currentTime });
      
      // Clear old queue and set new playlist
      clearQueue();
      setQueue(playlist, currentSongIndex);
      
      // Auto-play if host is playing
      if (autoPlay) {
        setTimeout(() => {
          const audio = getAudioElement();
          if (audio) {
            audio.currentTime = currentTime;
            audio.play().catch(err => {
              console.error("Auto-play failed:", err);
              toast.error("Click play to sync with livestream");
            });
            setIsPlaying(true);
          }
        }, 500);
      } else if (currentTime > 0) {
        setTimeout(() => {
          const audio = getAudioElement();
          if (audio) {
            audio.currentTime = currentTime;
          }
        }, 500);
      }
      
      toast.success(`Joined ${hostName}'s livestream!`);
    });

    // SYNC PLAY
    socket.on("sync-play", ({ songIndex, currentTime }) => {
      if (isHost) return;
      
      console.log("Sync play:", { songIndex, currentTime });
      setHostPosition({ songIndex, time: currentTime });
      
      // Set queue to correct song
      setQueue(playlist, songIndex);
      
      setTimeout(() => {
        const audio = getAudioElement();
        if (audio) {
          audio.currentTime = currentTime;
          audio.play().catch(console.error);
          setIsPlaying(true);
        }
      }, 200);
    });

    // SYNC PAUSE
    socket.on("sync-pause", ({ currentTime }) => {
      if (isHost) return;
      
      console.log("Sync pause:", { currentTime });
      setHostPosition(prev => ({ ...prev, time: currentTime }));
      
      const audio = getAudioElement();
      if (audio) {
        audio.pause();
        audio.currentTime = currentTime;
        setIsPlaying(false);
      }
    });

    // SYNC SEEK
    socket.on("sync-seek", ({ currentTime }) => {
      if (isHost) return;
      
      console.log("Sync seek:", { currentTime });
      setHostPosition(prev => ({ ...prev, time: currentTime }));
      
      const audio = getAudioElement();
      if (audio) {
        audio.currentTime = currentTime;
      }
    });

    // SYNC CHANGE SONG
    socket.on("sync-change-song", ({ songIndex, currentTime, isPlaying }) => {
      if (isHost) return;
      
      console.log("Sync change song:", { songIndex, currentTime, isPlaying });
      setHostPosition({ songIndex, time: currentTime });
      
      // Change to correct song in queue
      setQueue(playlist, songIndex);
      
      setTimeout(() => {
        const audio = getAudioElement();
        if (audio) {
          audio.currentTime = currentTime;
          if (isPlaying) {
            audio.play().catch(console.error);
            setIsPlaying(true);
          } else {
            audio.pause();
            setIsPlaying(false);
          }
        }
      }, 200);
    });

    // SYNC RESPONSE
    socket.on("sync-response", ({ songIndex, currentTime, isPlaying }) => {
      console.log("Sync response:", { songIndex, currentTime, isPlaying });
      
      setIsSyncing(false);
      setHostPosition({ songIndex, time: currentTime });
      
      // Sync to host's position
      setQueue(playlist, songIndex);
      
      setTimeout(() => {
        const audio = getAudioElement();
        if (audio) {
          audio.currentTime = currentTime;
          if (isPlaying) {
            audio.play().catch(console.error);
            setIsPlaying(true);
          } else {
            audio.pause();
            setIsPlaying(false);
          }
        }
      }, 200);
      
      toast.success("Synced with host!");
    });

    // ROOM ENDED
    socket.on("room-ended", ({ message }) => {
      toast.error(message);
      handleLeaveRoom();
    });

    // MEMBER JOINED/LEFT
    socket.on("member-joined", ({ userName, memberCount }) => {
      setMemberCount(memberCount);
      toast(`${userName} joined`, { icon: "👋" });
    });

    socket.on("member-left", ({ memberCount }) => {
      setMemberCount(memberCount);
    });

    socket.on("error", ({ message }) => {
      toast.error(message);
    });

    return () => {
      socket.off("room-created");
      socket.off("room-joined");
      socket.off("sync-play");
      socket.off("sync-pause");
      socket.off("sync-seek");
      socket.off("sync-change-song");
      socket.off("sync-response");
      socket.off("room-ended");
      socket.off("member-joined");
      socket.off("member-left");
      socket.off("error");
    };
  }, [socket, isHost, playlist]);

  // Emit host events
  useEffect(() => {
    if (!socket || !roomId || !isHost) return;

    const audio = getAudioElement();
    if (!audio) return;

    const handlePlay = () => {
      socket.emit("host-play", {
        roomId,
        songIndex: currentIndex,
        currentTime: audio.currentTime,
      });
    };

    const handlePause = () => {
      socket.emit("host-pause", {
        roomId,
        currentTime: audio.currentTime,
      });
    };

    const handleSeeked = () => {
      socket.emit("host-seek", {
        roomId,
        currentTime: audio.currentTime,
      });
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("seeked", handleSeeked);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("seeked", handleSeeked);
    };
  }, [socket, roomId, isHost, currentIndex]);

  // Emit when song changes
  useEffect(() => {
    if (!socket || !roomId || !isHost || !currentSong) return;
    
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      previousIndexRef.current = currentIndex;
      return;
    }

    if (previousIndexRef.current !== currentIndex) {
      console.log("Host: Song changed to index", currentIndex);
      
      socket.emit("host-change-song", {
        roomId,
        songIndex: currentIndex,
        currentTime: 0,
      });
      
      previousIndexRef.current = currentIndex;
    }
  }, [currentIndex, currentSong, socket, roomId, isHost]);

  const handleCreateRoom = () => {
    if (!socket) {
      return toast.error("Socket not connected. Please refresh.");
    }
    if (selectedSongs.length === 0) {
      return toast.error("Select at least one song");
    }

    const playlist = songs.filter(s => selectedSongs.includes(s._id));
    const newRoomId = generateRoomId();
    
    socket.emit("create-room", {
      roomId: newRoomId,
      playlist,
      userId: user?.clerkId,
      userName: user?.fullName,
    });
  };

  const handleJoinRoom = () => {
    if (!socket) {
      return toast.error("Socket not connected. Please refresh.");
    }
    if (!roomIdInput.trim()) {
      return toast.error("Enter a room ID");
    }

    socket.emit("join-room", {
      roomId: roomIdInput.trim(),
      userId: user?.clerkId,
      userName: user?.fullName,
    });
  };

  const handleEndRoom = () => {
    socket.emit("end-room", { roomId, userId: user.clerkId });
    resetRoom();
    clearQueue();
    navigate("/");
  };

  const handleLeaveRoom = () => {
    if (roomId) {
      socket.emit("leave-room", { roomId, userId: user.clerkId });
    }
    resetRoom();
    clearQueue();
    setIsPlaying(false);
  };

  const handleSyncWithHost = () => {
    if (!socket || !roomId || isHost) return;
    
    setIsSyncing(true);
    socket.emit("request-sync", { roomId });
    
    setTimeout(() => {
      if (isSyncing) {
        setIsSyncing(false);
        toast.error("Sync timeout. Try again.");
      }
    }, 5000);
  };

  const toggleSongSelection = (songId) => {
    setSelectedSongs(prev =>
      prev.includes(songId)
        ? prev.filter(id => id !== songId)
        : [...prev, songId]
    );
  };

  // Calculate if out of sync
  const isOutOfSync = !isHost && (
    currentIndex !== hostPosition.songIndex || 
    Math.abs((getAudioElement()?.currentTime || 0) - hostPosition.time) > 3
  );

  // Not in room - show lobby
  if (!roomId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <Radio className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
            <h1 className="text-4xl font-bold text-white mb-2">Live Playlist Streaming</h1>
            <p className="text-zinc-400">Stream your playlist live with friends</p>
          </div>

          <div className="bg-zinc-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">Join Existing Room</h3>
            <input
              type="text"
              placeholder="Enter Room ID (e.g. ABC123)"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
              className="w-full bg-zinc-700 text-white rounded px-4 py-3 mb-4"
              onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            
            <button
              onClick={handleJoinRoom}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-semibold transition"
            >
              Join Room
            </button>
          </div>

          <div className="text-center my-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-zinc-900 text-zinc-400">OR</span>
              </div>
            </div>
          </div>

          <div id="create-section" className="bg-zinc-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-2">Create New Livestream</h2>
            <p className="text-zinc-400 mb-4">Select songs for your livestream playlist:</p>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-8 h-8 text-emerald-400 animate-spin" />
              </div>
            ) : songs.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">
                No songs available. Upload some songs first!
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {songs.map(song => (
                    <div
                      key={song._id}
                      onClick={() => toggleSongSelection(song._id)}
                      className={`flex items-center gap-4 p-3 rounded cursor-pointer transition ${
                        selectedSongs.includes(song._id)
                          ? "bg-emerald-600/20 border border-emerald-500"
                          : "bg-zinc-700 hover:bg-zinc-600"
                      }`}
                    >
                      <img src={song.imageUrl} alt={song.title} className="w-12 h-12 rounded" />
                      <div className="flex-1">
                        <p className="text-white font-medium">{song.title}</p>
                        <p className="text-zinc-400 text-sm">{song.artist}</p>
                      </div>
                      {selectedSongs.includes(song._id) && (
                        <Music className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleCreateRoom}
                  disabled={selectedSongs.length === 0}
                  className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                >
                  <Radio className="w-5 h-5" />
                  Start Livestream ({selectedSongs.length} songs)
                </button>
                <p className="text-xs text-zinc-500 text-center mt-2">
                  Room ID will be generated automatically
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // In room - show livestream
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-zinc-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <h1 className="text-2xl font-bold text-white">
                  {isHost ? "Your Livestream" : `${hostName}'s Livestream`}
                </h1>
              </div>
              <div className="flex items-center gap-4 text-zinc-400">
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {memberCount} {memberCount === 1 ? "listener" : "listeners"}
                </span>
                <span className="text-xs bg-zinc-700 px-3 py-1 rounded">
                  Room: {roomId}
                </span>
                {!isHost && isOutOfSync && (
                  <span className="text-xs bg-yellow-600/20 text-yellow-400 px-3 py-1 rounded border border-yellow-600/30">
                    Out of sync
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              {!isHost && (
                <button
                  onClick={handleSyncWithHost}
                  disabled={isSyncing}
                  className={`flex items-center gap-2 ${
                    isOutOfSync 
                      ? 'bg-yellow-600 hover:bg-yellow-700' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  } disabled:bg-zinc-700 text-white px-4 py-2 rounded-lg transition`}
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                  {isOutOfSync ? 'Resync' : 'Sync'}
                </button>
              )}
              
              {isHost ? (
                <button
                  onClick={handleEndRoom}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                  End Room
                </button>
              ) : (
                <button
                  onClick={handleLeaveRoom}
                  className="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                  Leave
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Current Song */}
        {currentSong && (
          <div className="bg-zinc-800 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-6">
              <img
                src={currentSong.imageUrl}
                alt={currentSong.title}
                className="w-24 h-24 rounded-lg shadow-lg"
              />
              <div className="flex-1">
                <p className="text-sm text-zinc-400 mb-1">Now Playing</p>
                <h2 className="text-2xl font-bold text-white mb-1">{currentSong.title}</h2>
                <p className="text-zinc-400">{currentSong.artist}</p>
              </div>
            </div>
          </div>
        )}

        {/* Playlist */}
        <div className="bg-zinc-800 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">Playlist ({playlist.length} songs)</h3>
          <div className="space-y-2">
            {playlist.map((song, index) => {
              const isPast = !isHost && index < hostPosition.songIndex;
              const isCurrent = index === currentIndex;
              const isHostLive = !isHost && index === hostPosition.songIndex;
              
              return (
                <div
                  key={song._id}
                  className={`flex items-center gap-4 p-3 rounded transition ${
                    isCurrent
                      ? "bg-emerald-600/20 border border-emerald-500"
                      : isPast
                      ? "bg-zinc-700/50 opacity-60"
                      : "bg-zinc-700"
                  }`}
                >
                  <span className="text-zinc-400 w-8">{index + 1}</span>
                  <img src={song.imageUrl} alt={song.title} className="w-12 h-12 rounded" />
                  <div className="flex-1">
                    <p className="text-white font-medium">{song.title}</p>
                    <p className="text-zinc-400 text-sm">{song.artist}</p>
                  </div>
                  {isCurrent && isPlaying && (
                    <div className="flex gap-1">
                      <div className="w-1 h-4 bg-emerald-400 animate-pulse" />
                      <div className="w-1 h-4 bg-emerald-400 animate-pulse" style={{ animationDelay: '0.075s' }} />
                      <div className="w-1 h-4 bg-emerald-400 animate-pulse" style={{ animationDelay: '0.15s' }} />
                    </div>
                  )}
                  {isHostLive && !isCurrent && (
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/30">
                      LIVE
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {!isHost && (
          <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-400 text-sm">
              💡 <strong>Livestream Rules:</strong>
            </p>
            <ul className="text-blue-400 text-sm mt-2 space-y-1 ml-4">
              <li>✓ You can rewind to previous songs or earlier moments</li>
              <li>✗ You cannot skip ahead of what the host is playing</li>
              <li>🔄 Click <strong>Sync</strong> to jump back to the host's current position</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}