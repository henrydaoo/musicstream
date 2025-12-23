/**
 * Tính toán trạng thái Live dựa trên thời gian tuyệt đối
 * @param {number} startTime - Timestamp bắt đầu Live (ms)
 * @param {Array} playlist - Danh sách bài hát
 * @returns {Object} - Trạng thái hiện tại của Live
 */
export const calculateLiveState = (startTime, playlist) => {
  if (!startTime || !playlist || playlist.length === 0) return null;

  const now = Date.now();
  const elapsedTotalSeconds = (now - startTime) / 1000;

  // Chưa đến giờ bắt đầu
  if (elapsedTotalSeconds < 0) {
    return {
      currentSong: playlist[0],
      currentIndex: 0,
      position: 0,
      status: 'waiting',
      delay: Math.abs(elapsedTotalSeconds)
    };
  }

  let accumulatedDuration = 0;

  for (let i = 0; i < playlist.length; i++) {
    const song = playlist[i];
    const songDuration = song.duration || 0;

    if (elapsedTotalSeconds < accumulatedDuration + songDuration) {
      const currentPosition = elapsedTotalSeconds - accumulatedDuration;
      return {
        currentSong: song,
        currentIndex: i,
        position: currentPosition,
        status: 'playing',
        timeLeft: songDuration - currentPosition,
        totalElapsed: elapsedTotalSeconds
      };
    }

    accumulatedDuration += songDuration;
  }

  // Đã hết playlist
  return {
    status: 'ended',
    totalElapsed: elapsedTotalSeconds
  };
};

/**
 * Kiểm tra xem một bài hát có phải là "bài cũ" (đã phát xong) không
 * @param {number} songIndex - Index của bài cần kiểm tra
 * @param {number} currentLiveIndex - Index bài đang Live
 * @returns {boolean}
 */
export const isPastSong = (songIndex, currentLiveIndex) => {
  return songIndex < currentLiveIndex;
};

/**
 * Kiểm tra xem một bài hát có phải là "bài đang Live" không
 * @param {number} songIndex - Index của bài cần kiểm tra
 * @param {number} currentLiveIndex - Index bài đang Live
 * @returns {boolean}
 */
export const isLiveSong = (songIndex, currentLiveIndex) => {
  return songIndex === currentLiveIndex;
};

/**
 * Kiểm tra xem một bài hát có phải là "bài tương lai" (chưa phát) không
 * @param {number} songIndex - Index của bài cần kiểm tra
 * @param {number} currentLiveIndex - Index bài đang Live
 * @returns {boolean}
 */
export const isFutureSong = (songIndex, currentLiveIndex) => {
  return songIndex > currentLiveIndex;
};

/**
 * Tính thời gian tích lũy đến một bài cụ thể
 * @param {Array} playlist - Danh sách bài hát
 * @param {number} targetIndex - Index bài muốn tính
 * @returns {number} - Tổng thời gian (giây)
 */
export const getAccumulatedTime = (playlist, targetIndex) => {
  let accumulated = 0;
  for (let i = 0; i < targetIndex && i < playlist.length; i++) {
    accumulated += playlist[i].duration || 0;
  }
  return accumulated;
};

/**
 * Kiểm tra xem người dùng có đang ở chế độ "Live" (đồng bộ) không
 * @param {number} userPosition - Vị trí hiện tại của user (giây)
 * @param {number} livePosition - Vị trí thực tế của Live (giây)
 * @param {number} userSongIndex - Index bài user đang nghe
 * @param {number} liveSongIndex - Index bài đang Live
 * @param {number} tolerance - Độ sai lệch cho phép (giây)
 * @returns {boolean}
 */
export const isUserInSync = (userPosition, livePosition, userSongIndex, liveSongIndex, tolerance = 2) => {
  if (userSongIndex !== liveSongIndex) return false;
  return Math.abs(userPosition - livePosition) <= tolerance;
};

/**
 * Kiểm tra xem có thể seek tới vị trí này không (Listener)
 * @param {number} targetTime - Thời gian muốn seek tới
 * @param {number} currentIndex - Index bài đang nghe
 * @param {number} liveIndex - Index bài đang Live
 * @param {number} livePosition - Vị trí thực tế của Live (giây)
 * @returns {boolean}
 */
export const canSeekTo = (targetTime, currentIndex, liveIndex, livePosition) => {
  // Nếu đang nghe bài cũ -> Cho phép seek thoải mái
  if (isPastSong(currentIndex, liveIndex)) {
    return true;
  }
  
  // Nếu đang nghe bài Live -> Chỉ cho phép seek NGƯỢC (không được vượt quá livePosition)
  if (isLiveSong(currentIndex, liveIndex)) {
    return targetTime <= livePosition;
  }
  
  // Nếu là bài tương lai -> Không cho phép
  return false;
};