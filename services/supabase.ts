
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.45.0';

const supabaseUrl = 'https://owupzzlazpmchbeuzbjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93dXB6emxhenBtY2hiZXV6YmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODQ0NzYsImV4cCI6MjA4MzM2MDQ3Nn0.ia4i-SLiHs-Y_8POEt4gbL_lI5VcNLKq82JEPpZLg9w';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const syncRoomState = async (roomId: string, state: any) => {
  const { error } = await supabase
    .from('rooms')
    .upsert({ id: roomId, ...state, updated_at: new Date().toISOString() });
  if (error) console.error('Supabase Sync Error:', error);
};

export const sendChatMessage = async (roomId: string, userId: string, userName: string, text: string) => {
  const { error } = await supabase
    .from('messages')
    .insert({ room_id: roomId, user_id: userId, user_name: userName, text: text });
  if (error) console.error('Chat Error:', error);
};

export const uploadRoomFile = async (roomId: string, fileData: any) => {
  const { error } = await supabase
    .from('files')
    .insert({ room_id: roomId, ...fileData });
  if (error) console.error('File Upload Error:', error);
};

export const deleteRoomFile = async (fileId: string) => {
  const { error } = await supabase
    .from('files')
    .delete()
    .eq('id', fileId);
  if (error) console.error('File Delete Error:', error);
};
