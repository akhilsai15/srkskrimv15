import { apiClient } from '../apiClient';
import { getConfig } from '../runtimeConfig';
import { getS3UploadPath, S3Category } from '../s3Paths';

export interface S3UploadResult {
  url: string;       // CloudFront CDN URL of the uploaded asset
  s3Key: string;     // Constructed S3 Key/Path
}

/**
 * Robust, production-ready utility to upload a File or Blob directly to S3 via presigned PUT.
 * 1. Resolves S3 path/key based on category & sub-entities using getS3UploadPath
 * 2. Requests a presigned PUT URL from the backend API (apiClient.post('/media/presigned-url'))
 * 3. PUTs raw binary file data directly to the S3 bucket using the presigned URL
 * 4. Resolves to the correct, non-hardcoded CloudFront CDN URL from runtimeConfig.
 */
export async function uploadToS3(
  file: File | Blob,
  category: S3Category,
  entityId?: string,
  fileName?: string
): Promise<S3UploadResult> {
  const config = await getConfig();
  
  // 1. Get S3 path using getS3UploadPath
  const s3Key = getS3UploadPath(category, entityId, fileName || (file instanceof File ? file.name : undefined));
  
  // 2. Fetch presigned URL from skrimchat-api
  const response = await apiClient.post<{ uploadUrl: string }>('/media/presigned-url', {
    path: s3Key,
    contentType: file.type || 'application/octet-stream',
  });
  
  const { uploadUrl } = response;
  if (!uploadUrl) {
    throw new Error('Failed to retrieve presigned URL from media backend API.');
  }
  
  // 3. Upload raw binary data via PUT to presigned URL
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
  });
  
  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload file bytes directly to S3 storage bucket. Status: ${uploadResponse.status} ${uploadResponse.statusText}`);
  }
  
  // 4. Construct the CDN distribution URL using non-hardcoded cloudfrontDomain
  const cdnDomain = config.cloudfrontDomain.replace(/^https?:\/\//, '');
  const url = `https://${cdnDomain}/${s3Key}`;
  
  return { url, s3Key };
}
