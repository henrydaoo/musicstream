/**
 * Live Mode Utilities - Fixed Version
 * Handles timeline calculation and sync logic for live streaming
 */

/**
 * Calculate current live state based on absolute timeline
 * @param {number} startTime - Unix timestamp when live started
 * @param {Array} playlist - Array of songs with duration
 * @returns {Object} Current live state
 */
export const calculateLiveState = (startTime, playlist) => {
  if (!startTime || !playlist || playlist.length === 0) {
    return { status: 'idle', currentIndex: 0, position: 0 };
  }

  const now = Date.now();
  const elapsed = (now - startTime) / 1000; // seconds since start

  let accumulatedTime = 0;
  
  for (let i = 0; i < playlist.length; i++) {
    const songDuration = playlist[i].duration || 0;
    
    if (elapsed < accumulatedTime + songDuration) {
      // Current song
      return {
        status: 'playing',
        currentIndex: i,
        position: elapsed - accumulatedTime, // Position within current song
        totalElapsed: elapsed
      };
    }
    
    accumulatedTime += songDuration;
  }

  // All songs finished
  return {
    status: 'ended',
    currentIndex: playlist.length - 1,
    position: playlist[playlist.length - 1]?.duration || 0,
    totalElapsed: elapsed
  };
};

/**
 * Check if a song index is in the past (already played)
 */
export const isPastSong = (songIndex, liveIndex) => {
  return songIndex < liveIndex;
};

/**
 * Check if a song index is currently live
 */
export const isLiveSong = (songIndex, liveIndex) => {
  return songIndex === liveIndex;
};

/**
 * Check if a song index is in the future (not yet played)
 */
export const isFutureSong = (songIndex, liveIndex) => {
  return songIndex > liveIndex;
};

/**
 * Check if user can seek to a specific position
 * Rules:
 * - Can seek freely in past songs
 * - Can seek backward in current live song
 * - Cannot seek forward in current live song
 * - Cannot seek in future songs
 */
export const canSeekTo = (targetTime, currentIndex, liveIndex, livePosition) => {
  if (currentIndex < liveIndex) {
    // Past song - can seek anywhere
    return true;
  }
  
  if (currentIndex === liveIndex) {
    // Live song - can only seek backward
    return targetTime <= livePosition;
  }
  
  // Future song - cannot seek
  return false;
};

/**
 * Check if user is in sync with live timeline
 * @param {number} userTime - User's current playback position
 * @param {number} livePosition - Live position
 * @param {number} userIndex - User's current song index
 * @param {number} liveIndex - Live song index
 * @param {number} tolerance - Acceptable time difference in seconds
 */
export const isUserInSync = (userTime, livePosition, userIndex, liveIndex, tolerance = 3) => {
  // Must be on same song
  if (userIndex !== liveIndex) {
    return false;
  }
  
  // Check time difference
  const timeDiff = Math.abs(userTime - livePosition);
  return timeDiff <= tolerance;
};

/**
 * Calculate what song should be playing at a given timestamp
 * Used for initial sync when joining
 */
export const getSongAtTimestamp = (startTime, playlist, timestamp = Date.now()) => {
  const elapsed = (timestamp - startTime) / 1000;
  let accumulatedTime = 0;
  
  for (let i = 0; i < playlist.length; i++) {
    const songDuration = playlist[i].duration || 0;
    
    if (elapsed < accumulatedTime + songDuration) {
      return {
        index: i,
        position: elapsed - accumulatedTime,
        song: playlist[i]
      };
    }
    
    accumulatedTime += songDuration;
  }
  
  // Ended
  return {
    index: playlist.length - 1,
    position: playlist[playlist.length - 1]?.duration || 0,
    song: playlist[playlist.length - 1],
    ended: true
  };
};