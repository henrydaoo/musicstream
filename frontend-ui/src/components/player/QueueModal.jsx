import Modal from "../common/Modal";
import { usePlayerStore } from "../../store/usePlayerStore";
import { Play, X, Radio, Lock, History, Clock } from "lucide-react";
import { formatTime } from "../../utils/formatTime";
import { useRoomStore } from "../../store/useRoomStore";
import { calculateLiveState, isPastSong, isLiveSong, isFutureSong } from "../../utils/liveUtils";

const QueueModal = ({ isOpen, onClose }) => {
  const { queue, currentIndex, currentSong, setQueue, clearQueue } = usePlayerStore();
  
  const { roomId, roomState } = useRoomStore();
  const isLiveMode = !!roomId;

  // Tính toán vị trí Live thực tế
  let liveState = null;
  if (isLiveMode && roomState?.startTime && roomState?.playlist) {
    liveState = calculateLiveState(roomState.startTime, roomState.playlist);
  }

  const handlePlaySong = (index) => {
    if (isLiveMode) {
      // Trong Live Mode, chỉ cho phép chọn bài cũ (Past Songs)
      if (liveState && isPastSong(index, liveState.currentIndex)) {
        setQueue(queue, index);
      }
      return;
    }
    
    // Normal mode
    setQueue(queue, index);
  };

  const handleRemoveFromQueue = (index) => {
    if (isLiveMode) return;

    const newQueue = queue.filter((_, i) => i !== index);
    const newIndex = index < currentIndex ? currentIndex - 1 : currentIndex;
    setQueue(newQueue, Math.min(newIndex, newQueue.length - 1));
  };

  const handleClearQueue = () => {
    if (isLiveMode) return;
    clearQueue();
  };

  const getSongStatus = (index) => {
    if (!isLiveMode || !liveState) return 'normal';
    
    if (isPastSong(index, liveState.currentIndex)) return 'past';
    if (isLiveSong(index, liveState.currentIndex)) return 'live';
    if (isFutureSong(index, liveState.currentIndex)) return 'future';
    
    return 'normal';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isLiveMode ? "Live Queue" : "Queue"}>
      <div className="space-y-4">
        
        {/* Live Mode Warning */}
        {isLiveMode && (
          <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="bg-red-500/20 p-2 rounded-lg">
                <Radio className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-red-400 font-semibold text-sm mb-1">Live Session Active</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Past songs are playable. Live & future songs are locked to maintain sync.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Now Playing */}
        {currentSong && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Now Playing
            </h3>
            <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
              isLiveMode 
                ? 'bg-red-500/5 border-red-500/30' 
                : 'bg-green-500/10 border-green-500/30'
            }`}>
              <img
                src={currentSong.imageUrl}
                alt={currentSong.title}
                className="w-14 h-14 rounded shadow-lg"
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-white truncate flex items-center gap-2">
                  {currentSong.title}
                  {isLiveMode && (
                    <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse font-bold">
                      LIVE
                    </span>
                  )}
                </h4>
                <p className="text-sm text-zinc-400 truncate">
                  {currentSong.artistName}
                </p>
              </div>
              <span className="text-sm text-zinc-400 font-mono">
                {formatTime(currentSong.duration)}
              </span>
            </div>
          </div>
        )}

        {/* Queue List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Queue ({queue.length} songs)
            </h3>
            
            {queue.length > 0 && !isLiveMode && (
              <button
                onClick={handleClearQueue}
                className="text-xs text-red-400 hover:text-red-300 transition font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          {queue.length > 0 ? (
            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {queue.map((song, index) => {
                // Skip current song (already shown above)
                if (index === currentIndex) return null;

                const status = getSongStatus(index);
                const isPast = status === 'past';
                const isLive = status === 'live';
                const isFuture = status === 'future';
                const isClickable = !isLiveMode || isPast;

                return (
                  <div
                    key={`${song._id}-${index}`}
                    onClick={() => isClickable && handlePlaySong(index)}
                    className={`flex items-center gap-3 p-2.5 rounded-lg group transition-all ${
                      isFuture 
                        ? 'opacity-40 cursor-not-allowed' 
                        : isPast
                        ? 'hover:bg-zinc-800 cursor-pointer'
                        : isLive
                        ? 'cursor-not-allowed opacity-70'
                        : 'hover:bg-zinc-800 cursor-pointer'
                    }`}
                  >
                    {/* Icon/Action Button */}
                    <div className="flex-shrink-0 w-8 flex items-center justify-center">
                      {isFuture && (
                        <Lock className="w-4 h-4 text-zinc-600" />
                      )}
                      {isPast && (
                        <History className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                      {isLive && (
                        <Radio className="w-4 h-4 text-red-400" />
                      )}
                      {!isLiveMode && (
                        <Play className="w-4 h-4 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>

                    {/* Album Art */}
                    <img
                      src={song.imageUrl}
                      alt={song.title}
                      className={`w-11 h-11 rounded shadow ${
                        isFuture ? 'grayscale' : ''
                      }`}
                    />

                    {/* Song Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-medium truncate text-sm flex items-center gap-2 ${
                        isFuture ? 'text-zinc-500' : 'text-white'
                      }`}>
                        {song.title}
                        {isLive && (
                          <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded-full animate-pulse font-bold">
                            LIVE
                          </span>
                        )}
                      </h4>
                      <p className={`text-xs truncate ${
                        isFuture ? 'text-zinc-600' : 'text-zinc-400'
                      }`}>
                        {song.artistName}
                      </p>
                    </div>

                    {/* Duration */}
                    <span className={`text-xs font-mono ${
                      isFuture ? 'text-zinc-600' : 'text-zinc-400'
                    }`}>
                      {formatTime(song.duration)}
                    </span>

                    {/* Remove Button (Normal Mode Only) */}
                    {!isLiveMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromQueue(index);
                        }}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4 text-red-400 hover:text-red-300" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="bg-zinc-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-zinc-400 text-sm">Queue is empty</p>
              <p className="text-zinc-600 text-xs mt-1">Add songs to get started</p>
            </div>
          )}
        </div>

        {/* Legend for Live Mode */}
        {isLiveMode && queue.length > 0 && (
          <div className="pt-4 border-t border-zinc-800">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <History className="w-3 h-3 text-blue-400" />
                <span className="text-zinc-400">Past (Playable)</span>
              </div>
              <div className="flex items-center gap-2">
                <Radio className="w-3 h-3 text-red-400" />
                <span className="text-zinc-400">Live Now</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-3 h-3 text-zinc-600" />
                <span className="text-zinc-500">Future (Locked)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default QueueModal;