import { useAuthStore } from '../store/authStore';

export type S3Category =
  | 'pulse-media'
  | 'spark-media'
  | 'books-media'
  | 'chat-media'
  | 'voice-notes'
  | 'world-media'
  | 'profile-pictures';

/**
 * Constructs S3 upload paths conforming to the secure Cognito sub nesting convention:
 * {category}/{userId}/{entityId}/{fileName}
 * or {category}/{userId}/{fileName} for non-entity categories.
 * 
 * Always resolves to the real, authenticated Cognito userId (sub) from the session.
 */
export function getS3UploadPath(
  category: S3Category,
  entityId?: string,
  fileName?: string
): string {
  const user = useAuthStore.getState().user;
  const userId = user?.userId;

  if (!userId) {
    throw new Error(`Cannot construct S3 path: No authenticated Cognito session found for S3 category ${category}.`);
  }

  // Fallback for missing fileName
  const cleanFileName = fileName
    ? fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    : `file_${Date.now()}`;
  
  const cleanEntityId = entityId
    ? entityId.replace(/[^a-zA-Z0-9._-]/g, '_')
    : '';

  // Non-entity categories are nested directly under the userId:
  // e.g., voice-notes/{userId}/{fileName} or profile-pictures/{userId}/{fileName}
  if (category === 'voice-notes' || category === 'profile-pictures') {
    return `${category}/${userId}/${cleanFileName}`;
  }

  // Entity categories include the sub-entity ID:
  // e.g., pulse-media/{userId}/{postId}/{fileName}
  if (!cleanEntityId) {
    return `${category}/${userId}/${cleanFileName}`;
  }

  return `${category}/${userId}/${cleanEntityId}/${cleanFileName}`;
}
