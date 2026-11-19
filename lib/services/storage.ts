/**
 * @file lib/services/storage.ts
 * @description Server-side utility to decode Base64 images and upload them to Supabase Storage bucket.
 */

import { supabase } from "@/lib/supabase";
import pRetry from "p-retry";

const STORAGE_BUCKET_NAME = "gluvok";
const CACHE_CONTROL = "3600";

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/bmp",
]);
export const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "bmp"]);
export const PUBLIC_URL_INDICATOR = "/public/gluvok/";

/**
 * Uploads an array of browser/Node File objects to the Supabase Storage bucket.
 *
 * @param files Array of File objects to upload
 * @param factoryId Active factory ID for directory partitioning
 * @returns Array of public URLs for all uploaded images
 */
export async function uploadFilesToStorage(
  files: File[],
  factoryId: number | string,
): Promise<string[]> {
  if (!files || files.length === 0) return [];

  const parsedFactoryId = Number(factoryId);
  if (!Number.isSafeInteger(parsedFactoryId) || parsedFactoryId <= 0) {
    throw new Error("Valid factoryId is required for image uploads");
  }

  const factoryPrefix = String(parsedFactoryId);
  const uploadedUrls: string[] = [];

  for (const file of files) {
    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error(`File "${file.name}" exceeds maximum allowed size of 10MB`);
    }

    const fileExt = file.name ? file.name.split(".").pop()?.toLowerCase() || "" : "";
    const mimeType = file.type ? file.type.toLowerCase() : "";

    if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error(
        `Invalid image file type "${file.type || "unknown"}". Allowed types: JPEG, PNG, WebP, GIF, HEIC, BMP`,
      );
    }

    if (!fileExt || !ALLOWED_EXTENSIONS.has(fileExt)) {
      throw new Error(
        `Invalid image file extension ".${fileExt}". Allowed extensions: jpg, jpeg, png, webp, gif, heic, bmp`,
      );
    }

    const uniqueId = `${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
    const filePath = `${factoryPrefix}/${uniqueId}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type || "image/jpeg",
        cacheControl: CACHE_CONTROL,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError);
      throw new Error("Failed to upload image to storage");
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(filePath);
    if (data?.publicUrl) {
      uploadedUrls.push(data.publicUrl);
    }
  }

  return uploadedUrls;
}

/**
 * Options for configuring retry behavior during storage deletion rollback.
 */
export interface DeleteStorageImagesOptions {
  retries?: number;
  minTimeout?: number;
  factor?: number;
}

/**
 * Deletes an array of image URLs or storage paths from the Supabase Storage bucket.
 * Uses p-retry with exponential backoff to handle transient storage network issues.
 *
 * @param urlsOrPaths Array of public URLs or relative paths to remove
 * @param factoryId Optional factory ID to enforce tenancy boundary scoping
 * @param options Optional retry options (retries, minTimeout, factor)
 * @returns Number of removed images
 */
export async function deleteStorageImages(
  urlsOrPaths: string[],
  factoryId?: number | string,
  options?: DeleteStorageImagesOptions,
): Promise<number> {
  if (!urlsOrPaths || urlsOrPaths.length === 0) return 0;

  const factoryPrefix = factoryId !== undefined ? `${factoryId}/` : undefined;
  const targetPaths: string[] = [];

  for (const item of urlsOrPaths) {
    if (typeof item !== "string" || !item) continue;

    let relativePath: string | null = null;
    if (item.includes(PUBLIC_URL_INDICATOR)) {
      relativePath = item.split(PUBLIC_URL_INDICATOR)[1] || null;
    } else if (!item.startsWith("http://") && !item.startsWith("https://")) {
      relativePath = item;
    }

    if (relativePath) {
      if (!factoryPrefix || relativePath.startsWith(factoryPrefix)) {
        targetPaths.push(relativePath);
      }
    }
  }

  if (targetPaths.length === 0) return 0;

  const retries = options?.retries ?? 3;
  const minTimeout = options?.minTimeout ?? 200;
  const factor = options?.factor ?? 2;

  try {
    await pRetry(
      async () => {
        const { error: removeError } = await supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .remove(targetPaths);

        if (removeError) {
          throw new Error(removeError.message || "Failed to delete images from storage");
        }
      },
      {
        retries,
        minTimeout,
        factor,
        onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
          console.warn(
            `[deleteStorageImages] Attempt ${attemptNumber} failed (${retriesLeft} retries left): ${error.message}`,
          );
        },
      },
    );
  } catch (err) {
    console.error("Supabase storage deletion error after retries:", err);
    throw new Error("Failed to delete images from storage");
  }

  return targetPaths.length;
}

/**
 * Uploads an array of base64 image strings to the Supabase Storage bucket.
 * Non-base64 images (e.g. existing https URLs) are returned untouched.
 *
 * @param images Array of image strings (data URIs, raw base64, or existing URLs)
 * @param factoryId Active factory ID for directory partitioning
 * @returns Array of public URLs for all uploaded images
 */
export async function uploadBase64ImagesToStorage(
  images: string[],
  factoryId: number | string,
): Promise<string[]> {
  if (!images || images.length === 0) return [];

  const parsedFactoryId = Number(factoryId);
  if (!Number.isSafeInteger(parsedFactoryId) || parsedFactoryId <= 0) {
    throw new Error("Valid factoryId is required for image uploads");
  }

  const factoryPrefix = String(parsedFactoryId);

  return Promise.all(
    images.map(async (img) => {
      if (!img || typeof img !== "string") return "";

      // Check if image is already a public web URL
      if (img.startsWith("http://") || img.startsWith("https://")) {
        return img;
      }

      // Check for base64 data URI or raw base64
      let mimeType = "image/jpeg";
      let ext = "jpg";
      let base64Content = img;

      if (img.startsWith("data:image/")) {
        const matches = img.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          const rawExt = mimeType.split("/")[1] || "jpg";
          ext = rawExt === "jpeg" ? "jpg" : rawExt;
          base64Content = matches[2];
        }
      }

      try {
        const buffer = Buffer.from(base64Content, "base64");
        const uniqueId = `${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
        const filePath = `${factoryPrefix}/${uniqueId}.${ext}`;

        const { error } = await supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .upload(filePath, buffer, {
            contentType: mimeType,
            cacheControl: CACHE_CONTROL,
            upsert: false,
          });

        if (error) {
          console.error("Failed to upload base64 image to Supabase storage:", error);
          return img;
        }

        const { data } = supabase.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(filePath);
        return data?.publicUrl || img;
      } catch (err) {
        console.error("Error processing base64 image upload:", err);
        return img;
      }
    }),
  );
}
