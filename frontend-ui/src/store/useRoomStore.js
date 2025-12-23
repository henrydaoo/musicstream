import { create } from "zustand";

export const useRoomStore = create((set, get) => ({
  roomId: null,
  isHost: false,
  playlist: [],    // Danh sách bài hát cố định
  startTime: null, // Thời điểm bắt đầu tuyệt đối
  status: 'idle',  // idle | playing | ended
  
  setRoomId: (id) => set({ roomId: id }),
  setIsHost: (isHost) => set({ isHost }),
  
  // Khi join room thành công
  setRoomData: ({ playlist, startTime, status }) => set({ 
    playlist, 
    startTime, 
    status: status || 'playing' 
  }),
  
  // Getter để lấy roomState (cho AudioPlayer)
  get roomState() {
    const state = get();
    if (!state.roomId) return null;
    
    return {
      playlist: state.playlist,
      startTime: state.startTime,
      status: state.status
    };
  },
  
  resetRoom: () => set({ 
    roomId: null, 
    isHost: false, 
    playlist: [],
    startTime: null,
    status: 'idle'
  }),
}));