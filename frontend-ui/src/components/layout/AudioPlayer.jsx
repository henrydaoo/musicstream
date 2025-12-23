import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useRoomStore } from "../../store/useRoomStore";
import { useAdaptiveStreaming } from "../../hooks/useAdaptiveStreaming";
import { calculateLiveState, isPastSong, isLiveSong, canSeekTo, isUserInSync } from "../../utils/liveUtils";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  ListMusic,
  MoreHorizontal,
  Radio,
} from "lucide-react";
import { formatTime } from "../../utils/formatTime";
import QueueModal from "../player/QueueModal";
import AudioVisualizer from "../player/AudioVisualizer";
import VisualizerControls from "../player/VisualizerControls";
import QualitySelector from "../player/QualitySelector";
import { useAudioContext } from "../../contexts/AudioContext";
import { recommendationService } from "../../services/recommendationService";

const AudioPlayer = () => {
  const audioRef = useRef(null);
  const preloadAudioRef = useRef(null);
  const navigate = useNavigate();
  const [showQueue, setShowQueue] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [visualizerType, setVisualizerType] = useState("bars");
  const [showVisualizer, setShowVisualizer] = useState(true);
  const [isLoadingQuality, setIsLoadingQuality] = useState(false);
  const { initializeAudioContext, isInitialized } = useAudioContext();
  const hasTrackedPlayRef = useRef(false);
  const hasTrackedCompleteRef = useRef(false);
  const lastSongIdRef = useRef(null);

  // Live Mode
  const { roomId, isHost, roomState } = useRoomStore();
  const isLiveMode = !!roomId;
  const [liveState, setLiveState] = useState(null);
  const [showSyncButton, setShowSyncButton] = useState(false);
  const syncIntervalRef = useRef(null);

  const {
    currentSong,
    isPlaying,
    volume,
    currentTime,
    duration,
    repeat,
    shuffle,
    queue,
    currentIndex,
    togglePlay,
    playNext,
    playPrevious,
    setVolume,
    setCurrentTime,
    toggleRepeat,
    toggleShuffle,
    setIsPlaying,
  } = usePlayerStore();

  // Adaptive streaming hook
  const {
    audioUrl,
    quality,
    autoQuality,
    networkSpeed,
    changeQuality,
    toggleAutoQuality,
    getQualityLabel,
    getNetworkLabel,
    hasStreamingUrls,
  } = useAdaptiveStreaming(currentSong);

  // Calculate Live State
  useEffect(() => {
    if (!isLiveMode || !roomState?.startTime || !roomState?.playlist) {
      setLiveState(null);
      return;
    }

    const updateLiveState = () => {
      const state = calculateLiveState(roomState.startTime, roomState.playlist);
      setLiveState(state);
    };

    updateLiveState();
    const interval = setInterval(updateLiveState, 1000);

    return () => clearInterval(interval);
  }, [isLiveMode, roomState]);

  // Auto-sync for Host or Check sync for Listener
  useEffect(() => {
    if (!isLiveMode || !liveState || liveState.status !== 'playing') return;

    if (isHost) {
      // HOST: Force sync to live position
      const syncToLive = () => {
        const audio = audioRef.current;
        if (!audio) return;

        const targetIndex = liveState.currentIndex;
        const targetPosition = liveState.position;

        // Switch song if needed
        if (currentIndex !== targetIndex) {
          usePlayerStore.setState({
            currentIndex: targetIndex,
            currentSong: queue[targetIndex],
            currentTime: 0
          });
        }

        // Sync time if drift > 1 second
        const drift = Math.abs(audio.currentTime - targetPosition);
        if (drift > 1) {
          audio.currentTime = targetPosition;
          setCurrentTime(targetPosition);
        }

        // Ensure playing
        if (audio.paused && queue[targetIndex]) {
          audio.play().catch(e => console.error("Autoplay failed:", e));
          setIsPlaying(true);
        }
      };

      syncToLive();
      syncIntervalRef.current = setInterval(syncToLive, 2000);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    } else {
      // LISTENER: Check if out of sync
      const checkSync = () => {
        const audio = audioRef.current;
        if (!audio) return;

        const isInSync = isUserInSync(
          audio.currentTime,
          liveState.position,
          currentIndex,
          liveState.currentIndex,
          3 // 3 second tolerance
        );

        setShowSyncButton(!isInSync);
      };

      checkSync();
      const interval = setInterval(checkSync, 1000);

      return () => clearInterval(interval);
    }
  }, [isLiveMode, isHost, liveState, currentIndex, queue]);

  // Sync to Live Function (for Listener)
  const handleSyncToLive = () => {
    if (!liveState || liveState.status !== 'playing') return;

    const audio = audioRef.current;
    if (!audio) return;

    console.log("🔄 Syncing to live:", {
      fromIndex: currentIndex,
      toIndex: liveState.currentIndex,
      toPosition: liveState.position
    });

    // Jump to live song and position
    usePlayerStore.setState({
      currentIndex: liveState.currentIndex,
      currentSong: queue[liveState.currentIndex],
      isPlaying: true,
      currentTime: liveState.position
    });

    // Set audio time after a brief delay to ensure song loaded
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.currentTime = liveState.position;
        audioRef.current.play().catch(e => console.error("Play failed:", e));
      }
    }, 100);

    setShowSyncButton(false);
  };

  // Keyboard shortcut: Space for Play/Pause
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (!isHost) {
          togglePlay();
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [togglePlay, isHost]);

  // Handle play/pause
  useEffect(() => {
    if (audioRef.current && audioUrl && !isLoadingQuality) {
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.error("Play error:", e);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, audioUrl, isLoadingQuality]);

  // Initialize audio context when audio element is ready
  useEffect(() => {
    if (audioRef.current && !isInitialized) {
      initializeAudioContext(audioRef.current);
    }
  }, [audioRef.current, isInitialized, initializeAudioContext]);

  // Handle volume change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Update audio source when URL changes (quality switch or song change)
  useEffect(() => {
    if (!audioRef.current || !audioUrl) return;

    if (audioRef.current.src === audioUrl) return;

    const savedTime = currentTime;
    const wasPlaying = isPlaying;

    setIsLoadingQuality(true);

    if (!preloadAudioRef.current) {
      preloadAudioRef.current = document.createElement("audio");
    }
    const preloadAudio = preloadAudioRef.current;
    preloadAudio.src = audioUrl;
    preloadAudio.preload = "auto";

    const handleCanPlay = () => {
      audioRef.current.src = audioUrl;
      audioRef.current.currentTime = savedTime || 0;
      audioRef.current.load();
      
      if (wasPlaying) {
        audioRef.current.play().catch(e => console.error("Play error:", e));
      }
      
      setIsLoadingQuality(false);
      preloadAudio.removeEventListener("canplay", handleCanPlay);
    };

    preloadAudio.addEventListener("canplay", handleCanPlay);
    preloadAudio.load();

    return () => {
      preloadAudio.removeEventListener("canplay", handleCanPlay);
    };
  }, [audioUrl]);

  // Reset tracking when song changes
  useEffect(() => {
    if (currentSong && currentSong._id !== lastSongIdRef.current) {
      hasTrackedPlayRef.current = false;
      hasTrackedCompleteRef.current = false;
      lastSongIdRef.current = currentSong._id;
    }
  }, [currentSong?._id]);

  // Handle time update with tracking logic
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;

    const time = audioRef.current.currentTime;
    setCurrentTime(time);

    if (
      !currentSong ||
      !isPlaying ||
      (currentSong && currentSong?._id !== lastSongIdRef.current)
    )
      return;

    // Track play after 3 seconds of listening
    if (time > 3 && !hasTrackedPlayRef.current) {
      recommendationService.trackPlay(currentSong._id);
      hasTrackedPlayRef.current = true;
    }

    // Track completion when user listens to 80%+ of song
    if (duration > 0 && !hasTrackedCompleteRef.current) {
      const completionPercentage = (time / duration) * 100;
      if (completionPercentage >= 80) {
        recommendationService.trackComplete(currentSong._id);
        hasTrackedCompleteRef.current = true;
      }
    }
  };

  // Track skip when moving to next song before 50% completion
  const handleNext = () => {
    if (isHost) return;

    if (currentSong && duration > 0) {
      const completionPercentage = (currentTime / duration) * 100;
      if (completionPercentage < 50 && hasTrackedPlayRef.current) {
        recommendationService.trackSkip(currentSong._id);
      }
    }

    // Live Mode logic
    if (isLiveMode && liveState) {
      const nextIndex = currentIndex + 1;
      // Chỉ cho phép Next nếu bài tiếp theo là bài cũ hoặc bài Live
      if (nextIndex <= liveState.currentIndex && nextIndex < queue.length) {
        playNext();
      }
    } else {
      playNext();
    }
  };

  const handlePrevious = () => {
    if (isHost) return;

    if (currentSong && duration > 0) {
      const completionPercentage = (currentTime / duration) * 100;
      if (
        completionPercentage < 50 &&
        hasTrackedPlayRef.current &&
        currentTime > 3
      ) {
        recommendationService.trackSkip(currentSong._id);
      }
    }

    // Live Mode: Luôn cho phép Previous (để quay lại bài cũ)
    if (currentIndex > 0) {
      playPrevious();
    }
  };

  // Handle song end
  const handleEnded = () => {
    if (isHost) {
      // Host: Auto next (nhạc tự chạy)
      if (currentIndex < queue.length - 1) {
        playNext();
      } else {
        setIsPlaying(false);
      }
      return;
    }

    // Listener
    if (repeat) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      // Trong Live Mode: Tự động chuyển sang bài tiếp theo nếu có thể
      if (isLiveMode && liveState && currentIndex < liveState.currentIndex) {
        playNext();
      } else if (!isLiveMode) {
        playNext();
      } else {
        // Đã đến cuối phần có thể nghe -> dừng
        setIsPlaying(false);
      }
    }
  };

  // Handle seek with Live Mode restrictions
  const handleSeek = (e) => {
    if (isHost) return;

    const targetTime = parseFloat(e.target.value);

    // Live Mode: Kiểm tra quyền seek
    if (isLiveMode && liveState) {
      if (!canSeekTo(targetTime, currentIndex, liveState.currentIndex, liveState.position)) {
        console.warn("⚠️ Cannot seek forward in live song");
        return;
      }
    }

    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handlePlayPause = () => {
    if (isHost) return;
    togglePlay();
  };

  if (!currentSong) {
    return null;
  }

  const progress = (currentTime / (duration || 1)) * 100;
  
  // Tính vị trí Live trên thanh progress (màu đỏ)
  const liveProgress = liveState && isLiveSong(currentIndex, liveState.currentIndex)
    ? (liveState.position / (duration || 1)) * 100
    : 100;

  // Kiểm tra xem có thể bấm Next không
  const canClickNext = !isHost && (!isLiveMode || (liveState && currentIndex < liveState.currentIndex));

return (
    <div className="fixed bottom-0 left-0 right-0 bg-dark-secondary border-t border-dark-tertiary z-50">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedMetadata={(e) => {
          if (audioRef.current) {
            usePlayerStore.setState({ duration: e.target.duration });
          }
        }}
        crossOrigin="anonymous"
      />

      {/* Visualizer */}
      <div className={`h-24 bg-dark border-b border-dark-tertiary ${showVisualizer ? "block" : "hidden"}`}>
        <AudioVisualizer type={visualizerType} />
      </div>

      <div className="px-3 sm:px-4 py-2 sm:py-3">
        {/* Progress Bar */}
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-[10px] sm:text-xs text-gray-400 w-10 sm:w-12 text-right">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 relative">
            {/* Live Position Indicator */}
            {isLiveMode && liveState && isLiveSong(currentIndex, liveState.currentIndex) && (
              <div
                className="absolute top-1/2 -translate-y-1/2 h-1 bg-red-600/30 rounded-full pointer-events-none z-10"
                style={{ width: `${liveProgress}%` }}
              />
            )}
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              disabled={isHost}
              className="w-full progress-slider"
              style={{
                "--progress": `${progress}%`,
                cursor: isHost ? 'not-allowed' : 'pointer',
                opacity: isHost ? 0.5 : 1
              }}
            />
          </div>
          <span className="text-[10px] sm:text-xs text-gray-400 w-10 sm:w-12">
            {formatTime(duration)}
          </span>
        </div>

        {/* Desktop Controls */}
        <div className="hidden lg:flex items-center justify-between">
      {/* Song Info */}
      <div className="flex items-center space-x-4 flex-1">
        <img
          src={currentSong.imageUrl}
          alt={currentSong.title}
          className="w-14 h-14 rounded-lg cursor-pointer hover:opacity-80 transition"
          onClick={() => navigate("/visualizer")}
          title="Open Fullscreen Visualizer"
        />
        <div className="min-w-0">
          <h4 className="font-semibold">{currentSong.title}</h4>
          <p className="text-sm text-gray-400">{currentSong.artistName}</p>
          {hasStreamingUrls && (
            <p className="text-xs text-gray-500">
              Quality: {getQualityLabel()}
              {autoQuality && ` (${getNetworkLabel()})`}
            </p>
          )}
        </div>
        {/* Live Badge */}
        {isLiveMode && (
          <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse font-bold whitespace-nowrap">
            {isHost ? 'HOSTING' : 'LIVE'}
          </span>
        )}
      </div>

      {/* Controls - Center */}
      <div className="flex items-center space-x-4">
        <button
          onClick={toggleShuffle}
          disabled={isHost}
          className={`${
            shuffle ? "text-primary" : "text-gray-400"
          } hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <Shuffle size={20} />
        </button>

        <button
          onClick={handlePrevious}
          disabled={isHost || currentIndex === 0}
          className="text-gray-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <SkipBack size={24} />
        </button>

        <button
          onClick={handlePlayPause}
          disabled={isHost}
          className="w-12 h-12 flex items-center justify-center bg-white rounded-full hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isPlaying ? (
            <Pause size={24} className="text-black" />
          ) : (
            <Play size={24} className="text-black ml-1" />
          )}
        </button>

        <button
          onClick={handleNext}
          disabled={!canClickNext}
          className="text-gray-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
          title={!canClickNext && isLiveMode ? "Cannot skip to future songs" : ""}
        >
          <SkipForward size={24} />
        </button>

        <button
          onClick={toggleRepeat}
          disabled={isHost}
          className={`${
            repeat ? "text-primary" : "text-gray-400"
          } hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <Repeat size={20} />
        </button>

        <button
          onClick={() => setShowQueue(true)}
          className="text-gray-400 hover:text-white transition"
          title="Queue"
        >
          <ListMusic size={20} />
        </button>
      </div>

      {/* Volume & Sync & Controls */}
      <div className="flex items-center space-x-4 flex-1 justify-end">
        {/* Sync Button (Listener only) */}
        {!isHost && isLiveMode && showSyncButton && (
          <button
            onClick={handleSyncToLive}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-sm font-semibold transition-all animate-pulse whitespace-nowrap"
          >
            <Radio className="w-4 h-4" />
            Sync to Live
          </button>
        )}

        <VisualizerControls
          type={visualizerType}
          setType={setVisualizerType}
          isVisible={showVisualizer}
          setIsVisible={setShowVisualizer}
        />

        <QualitySelector
          quality={quality}
          autoQuality={autoQuality}
          networkSpeed={networkSpeed}
          onQualityChange={changeQuality}
          onToggleAuto={toggleAutoQuality}
          getQualityLabel={getQualityLabel}
          getNetworkLabel={getNetworkLabel}
          hasStreamingUrls={hasStreamingUrls}
        />

        <div className="flex items-center space-x-2">
          <Volume2 size={20} className="text-gray-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="volume-slider"
            style={{
              "--volume": `${volume * 100}%`,
            }}
          />
        </div>
      </div>
    </div>

        {/* Mobile Controls */}
       <div className="lg:hidden">
      <div className="flex items-center justify-center gap-2 relative">
        {/* Album Art - Left */}
        <img
          src={currentSong.imageUrl}
          alt={currentSong.title}
          className="absolute left-0 w-12 h-12 rounded-lg cursor-pointer hover:opacity-80 transition"
          onClick={() => navigate("/visualizer")}
          title={`${currentSong.title} - ${currentSong.artistName}`}
        />

        {/* Main Controls - Center */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={handlePrevious}
            disabled={isHost || currentIndex === 0}
            className="text-gray-400 hover:text-white transition p-2 disabled:opacity-30"
          >
            <SkipBack size={22} />
          </button>

          <button
            onClick={handlePlayPause}
            disabled={isHost}
            className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center bg-white rounded-full hover:scale-105 transition disabled:opacity-50"
          >
            {isPlaying ? (
              <Pause size={22} className="text-black" />
            ) : (
              <Play size={22} className="text-black ml-0.5" />
            )}
          </button>

          <button
            onClick={handleNext}
            disabled={!canClickNext}
            className="text-gray-400 hover:text-white transition p-2 disabled:opacity-30"
          >
            <SkipForward size={22} />
          </button>
        </div>

        {/* More Options - Right */}
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="absolute right-0 text-gray-400 hover:text-white transition p-2"
        >
          <MoreHorizontal size={22} />
        </button>
      </div>

      {/* Sync Button Mobile */}
      {!isHost && isLiveMode && (
        <div className="mt-3">
          <button
            onClick={handleSyncToLive}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-full text-sm font-semibold transition-all animate-pulse"
          >
            <Radio className="w-4 h-4" />
            Sync to Live
          </button>
        </div>
      )}

      {/* Mobile Expanded Controls */}
      {showMobileMenu && (
        <div className="mt-3 pt-3 border-t border-dark-tertiary space-y-3">
          <div className="flex items-center justify-around">
            <button
              onClick={toggleShuffle}
              disabled={isHost}
              className={`flex flex-col items-center space-y-1 ${
                shuffle ? "text-primary" : "text-gray-400"
              } hover:text-white transition p-2 disabled:opacity-30`}
            >
              <Shuffle size={20} />
              <span className="text-[10px]">Shuffle</span>
            </button>

            <button
              onClick={toggleRepeat}
              disabled={isHost}
              className={`flex flex-col items-center space-y-1 ${
                repeat ? "text-primary" : "text-gray-400"
              } hover:text-white transition p-2 disabled:opacity-30`}
            >
              <Repeat size={20} />
              <span className="text-[10px]">Repeat</span>
            </button>

            <button
              onClick={() => setShowQueue(true)}
              className="flex flex-col items-center space-y-1 text-gray-400 hover:text-white transition p-2"
            >
              <ListMusic size={20} />
              <span className="text-[10px]">Queue</span>
            </button>

            <button
              onClick={() => setShowVisualizer(!showVisualizer)}
              className="flex flex-col items-center space-y-1 text-gray-400 hover:text-white transition p-2"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M3 3h2v14H3V3zm4 4h2v10H7V7zm4-2h2v12h-2V5zm4 4h2v8h-2V9z" />
              </svg>
              <span className="text-[10px]">Visualizer</span>
            </button>
          </div>

          <div className="flex items-center space-x-3 bg-dark-tertiary rounded-lg p-3">
            <button
              onClick={() => setVolume(volume === 0 ? 0.5 : 0)}
              className="text-gray-400 hover:text-white transition"
            >
              {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 volume-slider"
              style={{
                "--volume": `${volume * 100}%`,
              }}
            />
            <span className="text-xs text-gray-400 w-10 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>

          {hasStreamingUrls && (
            <div className="bg-dark-tertiary rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-300">
                  Audio Quality
                </span>
                <span className="text-xs text-gray-400">
                  {getQualityLabel()}
                </span>
              </div>

              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-400">Auto Quality</span>
                <button
                  onClick={toggleAutoQuality}
                  className={`relative w-11 h-6 rounded-full transition ${
                    autoQuality ? "bg-primary" : "bg-gray-600"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transform transition ${
                      autoQuality ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {!autoQuality && (
                <div className="flex gap-2">
                  <button
                    onClick={() => changeQuality("low")}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      quality === "low"
                        ? "bg-primary text-black"
                        : "bg-dark-secondary text-gray-300 hover:bg-dark-hover"
                    }`}
                  >
                    Low
                  </button>
                  <button
                    onClick={() => changeQuality("medium")}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      quality === "medium"
                        ? "bg-primary text-black"
                        : "bg-dark-secondary text-gray-300 hover:bg-dark-hover"
                    }`}
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => changeQuality("high")}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      quality === "high"
                        ? "bg-primary text-black"
                        : "bg-dark-secondary text-gray-300 hover:bg-dark-hover"
                    }`}
                  >
                    High
                  </button>
                </div>
              )}

              {autoQuality && (
                <div className="text-xs text-gray-400 text-center">
                  Network: {getNetworkLabel()}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setShowMobileMenu(false)}
            className="w-full py-2 text-sm text-gray-400 hover:text-white transition"
          >
            Close
          </button>
        </div>
      )}
    </div>
      </div>

      <QueueModal isOpen={showQueue} onClose={() => setShowQueue(false)} />
    </div>
);
}

export default AudioPlayer;