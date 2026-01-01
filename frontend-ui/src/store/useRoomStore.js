import { create } from "zustand";

export const useRoomStore = create((set, get) => ({
  roomId: null,
  isHost: false,
  playlist: [],
  startTime: null,
  status: 'idle',
  
  setRoomId: (id) => set({ roomId: id }),
  
  setIsHost: (isHost) => set({ isHost }),
  
  // When successfully joining/creating room
  setRoomData: ({ playlist, startTime, status }) => set({ 
    playlist, 
    startTime, 
    status: status || 'playing' 
  }),
  
  // Reset room (leave/end)
  resetRoom: () => set({ 
    roomId: null, 
    isHost: false, 
    playlist: [],
    startTime: null,
    status: 'idle'
  }),
  
  // Getter for roomState
  get roomState() {
    const state = get();
    if (!state.roomId) return null;
    
    return {
      playlist: state.playlist,
      startTime: state.startTime,
      status: state.status
    };
  },
}));