
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://owupzzlazpmchbeuzbjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93dXB6emxhenBtY2hiZXV6YmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODQ0NzYsImV4cCI6MjA4MzM2MDQ3Nn0.ia4i-SLiHs-Y_8POEt4gbL_lI5VcNLKq82JEPpZLg9w';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let syncTimeout: any = null;

export const syncRoomState = async (roomId: string, state: any) => {
  if (state.shared_code !== undefined) {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
      try {
        await supabase
          .from('rooms')
          .update({ ...state, updated_at: new Date().toISOString() })
          .eq('id', roomId);
      } catch (e) {
        console.error("Shared code sync error:", e);
      }
    }, 1200);
  } else {
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ ...state, updated_at: new Date().toISOString() })
        .eq('id', roomId);
      if (error) console.error('Supabase Sync Error:', error);
    } catch (e) {
      console.error("General sync error:", e);
    }
  }
};

export const sendChatMessage = async (roomId: string, userId: string, userName: string, text: string) => {
  try {
    const { error } = await supabase
      .from('messages')
      .insert({ room_id: roomId, user_id: userId, user_name: userName, text: text });
    if (error) throw error;
  } catch (err) {
    console.error('Chat Error:', err);
  }
};

export const uploadRoomFile = async (roomId: string, fileData: any) => {
  try {
    const { error } = await supabase
      .from('files')
      .insert({ room_id: roomId, ...fileData });
    if (error) throw error;
  } catch (err) {
    console.error('File Upload Error:', err);
  }
};

export const deleteRoomFile = async (fileId: string) => {
  try {
    const { error } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);
    if (error) throw error;
  } catch (err) {
    console.error('File Delete Error:', err);
  }
};
