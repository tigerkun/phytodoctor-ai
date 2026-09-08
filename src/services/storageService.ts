import { supabase } from '../lib/supabase';

export const StorageService = {
  /**
   * Uploads a plant photo File or Blob to the Supabase 'plant-photos' bucket.
   * Path structure: `${userId}/${crypto.randomUUID()}.${fileExt}`
   * Returns the publicly accessible URL string or null if failed.
   */
  async uploadPlantPhoto(
    file: File | Blob,
    userId: string,
    fallbackExt = 'jpg'
  ): Promise<string | null> {
    if (!supabase) {
      console.warn('[StorageService] Supabase client is not configured.');
      return null;
    }

    try {
      let activeUserId = (userId || '').replace(/^sb_/, '').trim();
      if (!activeUserId || activeUserId === 'local_user') {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          activeUserId = session.user.id;
        }
      }

      let fileExt = fallbackExt;
      if (typeof File !== 'undefined' && file instanceof File && file.name) {
        const parts = file.name.split('.');
        if (parts.length > 1) {
          fileExt = parts.pop() || fallbackExt;
        }
      } else if (file.type) {
        const subtype = file.type.split('/')[1];
        if (subtype) {
          fileExt = subtype.replace('+xml', '');
        }
      }

      const cleanExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const fileName = `${crypto.randomUUID()}.${cleanExt}`;
      const filePath = `${activeUserId}/${fileName}`;


      const contentType = file.type || `image/${cleanExt === 'jpg' ? 'jpeg' : cleanExt}`;

      const { data, error } = await supabase.storage
        .from('plant-photos')
        .upload(filePath, file, {
          contentType,
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('[StorageService] Upload failed:', error.message);
        return null;
      }

      const { data: publicData } = supabase.storage
        .from('plant-photos')
        .getPublicUrl(data.path);

      return publicData.publicUrl;
    } catch (err: any) {
      console.error('[StorageService] Unexpected upload error:', err?.message || err);
      return null;
    }
  },

  /**
   * Helper to upload a base64 Data URL (e.g. from camera/canvas) to Supabase Storage.
   */
  async uploadPlantPhotoFromDataUrl(
    dataUrl: string,
    userId: string
  ): Promise<string | null> {
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      if (dataUrl && dataUrl.startsWith('http')) return dataUrl;
      return null;
    }

    try {
      const [header, base64] = dataUrl.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mime });
      const ext = mime.split('/')[1] || 'jpg';
      return await this.uploadPlantPhoto(blob, userId, ext);
    } catch (err: any) {
      console.error('[StorageService] Failed to convert data URL to blob:', err?.message || err);
      return null;
    }
  }
};
