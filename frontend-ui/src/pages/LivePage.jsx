import { useEffect, useState } from "react";
import { useSocket } from "../contexts/SocketContext";
import { usePlayerStore } from "../store/usePlayerStore";
import { useRoomStore } from "../store/useRoomStore";
import { useAuthStore } from "../store/useAuthStore";
import { calculateLiveState } from "../utils/liveUtils";
import { Play, Users, LogOut, Copy, Music2, Radio, Clock, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

const LivePage = () => {
  const socket = useSocket();
  const { user } = useAuthStore();
  const { queue, currentSong } = usePlayerStore(); 
  
  const { roomId, isHost, roomState, setRoomId, setIsHost, setRoomData, resetRoom } = useRoomStore();
  
  const [joinInput, setJoinInput] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // HOST: Tạo phòng thành công
    socket.on("room_created", ({ roomId }) => {
      console.log("✅ Room created:", roomId);
      setRoomId(roomId);
      setIsHost(true);
      
      const startTime = Date.now();
      
      setRoomData({
        playlist: queue,
        startTime: startTime,
        status: 'playing'
      });

      // QUAN TRỌNG: Reset bài hát về đầu
      usePlayerStore.setState({
        currentIndex: 0,
        currentSong: queue[0],
        currentTime: 0,
        isPlaying: true
      });

      toast.success("🔴 Live Session Started!");
    });

    // LISTENER: Join thành công
    socket.on("sync_state", (data) => {
      console.log("✅ Sync state received:", data);
      
      setRoomData(data); 
      
      // Tính toán vị trí Live hiện tại
      const liveState = calculateLiveState(data.startTime, data.playlist);
      
      if (liveState && liveState.status === 'playing') {
        console.log("🎵 Auto-playing from live position:", {
          songIndex: liveState.currentIndex,
          position: liveState.position
        });

        // Update playlist và set vào bài đang Live
        usePlayerStore.setState({
          queue: data.playlist || [],
          currentIndex: liveState.currentIndex,
          currentSong: data.playlist[liveState.currentIndex],
          currentTime: liveState.position,
          isPlaying: true
        });
      } else {
        // Fallback: Nếu chưa Live hoặc đã kết thúc
        usePlayerStore.setState({
          queue: data.playlist || [],
          currentIndex: 0,
          currentSong: data.playlist[0],
          currentTime: 0,
          isPlaying: false
        });
      }
      
      toast.success("✨ Joined Live Room!");
    });

    // Kết thúc phòng
    socket.on("room_ended", () => {
      console.log("⚠️ Room ended");
      toast("Host has ended the session", { icon: "👋" });
      handleLeaveRoom();
    });

    socket.on("error", ({ message }) => {
      console.error("❌ Socket error:", message);
      toast.error(message);
    });

    return () => {
      socket.off("room_created");
      socket.off("sync_state");
      socket.off("room_ended");
      socket.off("error");
    };
  }, [socket, queue, setRoomId, setIsHost, setRoomData]);

  const handleCreateRoom = () => {
    if (!queue || queue.length === 0) {
      toast.error("Queue is empty! Play some songs first.");
      return;
    }
    
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    console.log("🔴 Creating room:", newRoomId);
    socket.emit("create_room", {
      roomId: newRoomId,
      hostId: user?.id || "unknown",
      playlist: queue
    });
  };

  const handleJoinRoom = () => {
    if (!joinInput.trim()) {
      toast.error("Please enter a Room ID");
      return;
    }
    
    const roomIdToJoin = joinInput.toUpperCase();
    console.log("🔗 Joining room:", roomIdToJoin);
    
    socket.emit("join_room", { 
      roomId: roomIdToJoin, 
      userId: user?.id || "guest" 
    });
    
    // Set room ID trước để UI chuyển sang IN-ROOM
    setRoomId(roomIdToJoin);
    setIsHost(false);
  };

  const handleLeaveRoom = () => {
    if (roomId) {
      if (isHost) {
        console.log("🛑 Ending live:", roomId);
        socket.emit("end_live", { roomId });
      } else {
        console.log("👋 Leaving room:", roomId);
        socket.emit("leave_room", { roomId });
      }
    }
    resetRoom();
    usePlayerStore.setState({ isPlaying: false });
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    toast.success("Room ID copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Debug logs
  useEffect(() => {
    console.log("🔍 LivePage State:", { roomId, isHost, hasRoomState: !!roomState });
  }, [roomId, isHost, roomState]);

  // IN-ROOM VIEW
  if (roomId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-black to-black p-6">
        <div className="max-w-2xl mx-auto pt-12">
          
          {/* Live Badge */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-3 bg-red-600 px-6 py-2 rounded-full">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-white font-bold text-sm uppercase tracking-wider">Live</span>
            </div>
          </div>

          {/* Main Card */}
          <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 p-6 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">
                    {isHost ? "Hosting Session" : "Listening to"}
                  </p>
                  <h1 className="text-2xl font-bold text-white">Live Room</h1>
                </div>
                <Radio className="text-green-500 w-8 h-8" />
              </div>
            </div>

            {/* Room ID Section */}
            <div className="p-6 border-b border-zinc-800">
              <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">
                Room Code
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-black/40 rounded-lg px-4 py-3 border border-zinc-700">
                  <span className="text-2xl font-mono font-bold text-white tracking-widest">
                    {roomId}
                  </span>
                </div>
                <button 
                  onClick={handleCopyRoomId}
                  className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg transition-colors group"
                >
                  {copied ? (
                    <Sparkles className="w-5 h-5 text-green-500" />
                  ) : (
                    <Copy className="w-5 h-5 text-zinc-400 group-hover:text-white" />
                  )}
                </button>
              </div>
            </div>

            {/* Status Info */}
            <div className="p-6 border-b border-zinc-800">
              <div className="flex items-start gap-3 text-sm">
                <Clock className="w-5 h-5 text-zinc-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-zinc-300 leading-relaxed">
                    {isHost 
                      ? "You're broadcasting your queue. Everyone hears the same thing at the same time. Music plays automatically—no manual controls." 
                      : "You're synced to the host's timeline. You can explore past songs or stay live with the current track."}
                  </p>
                </div>
              </div>
            </div>

            {/* Currently Playing */}
            {currentSong && (
              <div className="p-6 border-b border-zinc-800">
                <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-3">
                  Now Playing
                </label>
                <div className="flex items-center gap-4">
                  <img 
                    src={currentSong.imageUrl} 
                    alt={currentSong.title}
                    className="w-16 h-16 rounded-lg shadow-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold truncate">{currentSong.title}</h3>
                    <p className="text-zinc-400 text-sm truncate">{currentSong.artistName}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Queue Info */}
            <div className="p-6 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider">Total Songs</p>
                  <p className="text-2xl font-bold text-white">{queue.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400 uppercase tracking-wider">Mode</p>
                  <p className="text-sm font-semibold text-green-500">Strict Sync</p>
                </div>
              </div>
            </div>

            {/* Debug Info (Remove in production) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="p-6 border-b border-zinc-800 bg-yellow-900/10">
                <p className="text-xs text-yellow-400 font-mono">
                  Debug: roomId={roomId}, isHost={isHost.toString()}, hasState={!!roomState}
                </p>
              </div>
            )}

            {/* Action Button */}
            <div className="p-6">
              <button 
                onClick={handleLeaveRoom}
                className="w-full bg-white hover:bg-zinc-100 text-black font-bold py-3.5 rounded-full transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg"
              >
                <LogOut className="w-5 h-5" />
                {isHost ? "End Session" : "Leave Room"}
              </button>
            </div>

          </div>

          {/* Footer Note */}
          <div className="mt-6 text-center">
            <p className="text-xs text-zinc-500">
              {isHost 
                ? "Share the room code with friends to let them join" 
                : "Stay synced to experience music together"}
            </p>
          </div>

        </div>
      </div>
    );
  }

  // LOBBY VIEW
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-black to-black p-6">
      <div className="max-w-4xl mx-auto pt-12">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-green-600/20 text-green-500 px-4 py-2 rounded-full mb-4">
            <Radio className="w-4 h-4" />
            <span className="text-sm font-semibold">Live Sessions</span>
          </div>
          <h1 className="text-5xl font-bold text-white mb-3">
            Listen Together
          </h1>
          <p className="text-zinc-400 text-lg">
            Create a room or join friends for synchronized music streaming
          </p>
        </div>

        {/* Debug Panel */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
            <p className="text-xs text-yellow-400 font-mono">
              Socket: {socket ? '✅ Connected' : '❌ Disconnected'} | 
              User: {user?.id || 'Guest'} | 
              Queue: {queue?.length || 0} songs
            </p>
          </div>
        )}

        {/* Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Join Room Card */}
          <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-zinc-800 p-8 hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-600/20 p-3 rounded-xl">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Join Room</h2>
                <p className="text-sm text-zinc-400">Enter a code to listen</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">
                  Room Code
                </label>
                <input
                  type="text"
                  placeholder="ABC123"
                  className="w-full bg-black/40 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 font-mono uppercase text-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  maxLength={6}
                />
              </div>

              <button 
                onClick={handleJoinRoom}
                disabled={!joinInput.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold py-3.5 rounded-full transition-all transform hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-lg"
              >
                Join Session
              </button>
            </div>

            <div className="mt-6 p-3 bg-blue-600/10 rounded-lg border border-blue-600/20">
              <p className="text-xs text-blue-400 leading-relaxed">
                <strong>Listener Mode:</strong> Explore past songs freely or sync to the live track
              </p>
            </div>
          </div>

          {/* Create Room Card */}
          <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-zinc-800 p-8 hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-red-600/20 p-3 rounded-xl">
                <Radio className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Go Live</h2>
                <p className="text-sm text-zinc-400">Start broadcasting</p>
              </div>
            </div>

            {/* Queue Preview */}
            <div className="mb-6">
              <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">
                Current Queue
              </label>
              {currentSong ? (
                <div className="bg-black/40 border border-zinc-700 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <img 
                      src={currentSong.imageUrl} 
                      alt={currentSong.title}
                      className="w-12 h-12 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate text-sm">
                        {currentSong.title}
                      </p>
                      <p className="text-zinc-400 text-xs">
                        {queue.length} {queue.length === 1 ? 'song' : 'songs'}
                      </p>
                    </div>
                    <Music2 className="w-5 h-5 text-zinc-600" />
                  </div>
                </div>
              ) : (
                <div className="bg-black/40 border border-zinc-700 rounded-lg p-4 text-center">
                  <Music2 className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">No songs in queue</p>
                </div>
              )}
            </div>

            <button 
              onClick={handleCreateRoom}
              disabled={!currentSong}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold py-3.5 rounded-full transition-all transform hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
            >
              <Radio className="w-5 h-5" />
              Start Broadcasting
            </button>

            <div className="mt-6 p-3 bg-red-600/10 rounded-lg border border-red-600/20">
              <p className="text-xs text-red-400 leading-relaxed">
                <strong>Host Mode:</strong> Music will restart from the beginning to ensure perfect sync
              </p>
            </div>
          </div>

        </div>

        {/* Info Section */}
        <div className="mt-12 bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6">
          <h3 className="text-lg font-bold text-white mb-4">How Live Sessions Work</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="bg-green-600/20 w-10 h-10 rounded-lg flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-green-500" />
              </div>
              <h4 className="text-white font-semibold mb-1">Absolute Timeline</h4>
              <p className="text-sm text-zinc-400">
                Everyone follows the same timeline from the moment the host starts
              </p>
            </div>
            <div>
              <div className="bg-blue-600/20 w-10 h-10 rounded-lg flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <h4 className="text-white font-semibold mb-1">Full History Access</h4>
              <p className="text-sm text-zinc-400">
                Listeners can explore and replay any past songs at their own pace
              </p>
            </div>
            <div>
              <div className="bg-purple-600/20 w-10 h-10 rounded-lg flex items-center justify-center mb-3">
                <Radio className="w-5 h-5 text-purple-500" />
              </div>
              <h4 className="text-white font-semibold mb-1">Quick Sync</h4>
              <p className="text-sm text-zinc-400">
                Jump back to live whenever you want with one tap
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LivePage;