import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const raw = formData.get('avatar');

    if (!raw) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!(raw instanceof File)) {
      return NextResponse.json({ error: 'Invalid file format' }, { status: 400 });
    }

    const file = raw;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Max size: 5MB' },
        { status: 400 }
      );
    }

    // Delete old avatar files before uploading new one
    const listResult = await supabase.storage
      .from('avatars')
      .list(user.id);

    if (listResult.error) {
      console.error('Failed to list old avatars:', listResult.error);
      // Continue with upload even if listing fails
    } else {
      const existingFiles = listResult.data;

      if (existingFiles && existingFiles.length > 0) {
        const filePaths = existingFiles.map(f => `${user.id}/${f.name}`);
        const removeResult = await supabase.storage
          .from('avatars')
          .remove(filePaths);

        if (removeResult.error) {
          console.error('Failed to remove old avatars:', removeResult.error);
          // Continue with upload even if removal fails
        }
      }
    }

    // Determine file extension
    let extension = 'bin';
    if (file.name.includes('.')) {
      const popped = file.name.split('.').pop() || '';
      extension = popped.trim() || 'bin';
    }
    
    // If extension is still 'bin' or empty, derive from MIME type
    if (extension === 'bin' || !extension.trim()) {
      const mimeMap: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
      };
      extension = mimeMap[file.type] || 'bin';
    }

    const fileName = `${user.id}/avatar-${Date.now()}.${extension}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        cacheControl: '31536000',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    if (updateError) {
      // Clean up uploaded file on profile update failure
      try {
        await supabase.storage
          .from('avatars')
          .remove([fileName]);
      } catch (cleanupError) {
        console.error('Failed to cleanup avatar after profile update failure:', cleanupError);
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Avatar uploaded successfully',
      avatarUrl: publicUrl,
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch current avatar URL
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();

    // Delete file from storage if exists
    if (profile?.avatar_url) {
      try {
        const url = new URL(profile.avatar_url);
        const pathParts = url.pathname.split('/');
        const idx = pathParts.indexOf('avatars');
        
        if (idx >= 0) {
          const fileName = pathParts.slice(idx + 1).join('/');
          
          if (fileName) {
            await supabase.storage
              .from('avatars')
              .remove([fileName]);
          }
        }
      } catch (storageError) {
        console.error('Failed to delete avatar file:', storageError);
        // Continue to update profile even if storage deletion fails
      }
    }

    // Update profile to remove avatar URL
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Avatar removed successfully' });
  } catch (error) {
    console.error('Avatar delete error:', error);
    return NextResponse.json({ error: 'Failed to remove avatar' }, { status: 500 });
  }
}
