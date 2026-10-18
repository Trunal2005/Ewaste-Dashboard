import fs from 'fs'
import path from 'path'
import os from 'os'
import { put, head, del, get, BlobNotFoundError } from '@vercel/blob'

export interface StorageAdapter {
  save(buffer: Buffer, internalId: string, originalName: string): Promise<string>
  read(internalId: string): Promise<Buffer>
  exists(internalId: string): Promise<boolean>
  delete(internalId: string): Promise<void>
  getFilePath(internalId: string): string | null
  getUrl(internalId: string): Promise<string | null>
  isCloud(): boolean
}

export function hasBlobStorageConfigured(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
    (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID) ||
    (process.env.VERCEL && (process.env.BLOB_STORE_ID || process.env.VERCEL_OIDC_TOKEN))
  )
}

export class LocalDiskStorageAdapter implements StorageAdapter {
  private uploadsDir: string

  constructor(uploadsDir: string) {
    this.uploadsDir = uploadsDir
    try {
      if (!fs.existsSync(this.uploadsDir)) {
        fs.mkdirSync(this.uploadsDir, { recursive: true })
      }
    } catch {
      // In serverless read-only filesystem environments, catch EROFS gracefully
    }
  }

  isCloud(): boolean {
    return false
  }

  getFilePath(internalId: string): string {
    const safeId = path.basename(internalId)
    return path.join(this.uploadsDir, safeId)
  }

  async save(buffer: Buffer, internalId: string, _originalName: string): Promise<string> {
    const targetPath = this.getFilePath(internalId)
    await fs.promises.writeFile(targetPath, buffer)
    return internalId
  }

  async read(internalId: string): Promise<Buffer> {
    const targetPath = this.getFilePath(internalId)
    return await fs.promises.readFile(targetPath)
  }

  async exists(internalId: string): Promise<boolean> {
    const targetPath = this.getFilePath(internalId)
    return fs.existsSync(targetPath)
  }

  async delete(internalId: string): Promise<void> {
    const targetPath = this.getFilePath(internalId)
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath)
    }
  }

  async getUrl(_internalId: string): Promise<string | null> {
    return null
  }
}

export class VercelBlobStorageAdapter implements StorageAdapter {
  private cacheDir: string

  constructor() {
    this.cacheDir = path.join(os.tmpdir(), 'ewem-uploads-cache')
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true })
      }
    } catch {
      // Ignore EROFS
    }
  }

  isCloud(): boolean {
    return true
  }

  private getBlobPath(internalId: string): string {
    const safeId = path.basename(internalId)
    return `uploads/${safeId}`
  }

  private getLocalCachePath(internalId: string): string {
    const safeId = path.basename(internalId)
    return path.join(this.cacheDir, safeId)
  }

  getFilePath(internalId: string): string | null {
    const local = this.getLocalCachePath(internalId)
    return fs.existsSync(local) ? local : null
  }

  async save(buffer: Buffer, internalId: string, _originalName: string): Promise<string> {
    const blobPath = this.getBlobPath(internalId)
    const localCache = this.getLocalCachePath(internalId)

    // Write to local cache in /tmp for immediate read availability
    try {
      await fs.promises.writeFile(localCache, buffer)
    } catch {
      // Ignore cache write failures
    }

    // Upload to Vercel Blob with PRIVATE access to protect academic documents
    await put(blobPath, buffer, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
    })

    return internalId
  }

  async getUrl(internalId: string): Promise<string | null> {
    // For private blobs, do NOT expose raw URLs or public CDN links.
    // Authorized downloads are routed through backend streaming endpoints.
    return `/api/files/${encodeURIComponent(internalId)}/download`
  }

  async exists(internalId: string): Promise<boolean> {
    const localCache = this.getLocalCachePath(internalId)
    if (fs.existsSync(localCache)) return true

    const blobPath = this.getBlobPath(internalId)
    try {
      const details = await head(blobPath)
      if (details && details.url) return true
    } catch (err: any) {
      if (err instanceof BlobNotFoundError || err?.name === 'BlobNotFoundError') {
        // continue to try get
      }
    }

    try {
      const result = await get(blobPath, { access: 'private' })
      return Boolean(result && result.stream)
    } catch {
      return false
    }
  }

  async read(internalId: string): Promise<Buffer> {
    const localCache = this.getLocalCachePath(internalId)
    if (fs.existsSync(localCache)) {
      try {
        return await fs.promises.readFile(localCache)
      } catch {
        // Fall back to fetching from blob
      }
    }

    const blobPath = this.getBlobPath(internalId)
    try {
      const result = await get(blobPath, { access: 'private' })
      if (!result || !result.stream) {
        throw new Error(`Private blob not found: ${blobPath}`)
      }

      const reader = result.stream.getReader()
      const chunks: Uint8Array[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) chunks.push(value)
      }
      const buffer = Buffer.concat(chunks)

      // Cache locally in /tmp for fast subsequent reads within lambda container
      try {
        await fs.promises.writeFile(localCache, buffer)
      } catch {
        // Ignore cache write failure
      }

      return buffer
    } catch (err: any) {
      if (err instanceof BlobNotFoundError || err?.name === 'BlobNotFoundError') {
        throw new Error(`Blob not found: ${blobPath}`)
      }
      throw err
    }
  }

  async delete(internalId: string): Promise<void> {
    const localCache = this.getLocalCachePath(internalId)
    if (fs.existsSync(localCache)) {
      await fs.promises.unlink(localCache).catch(() => {})
    }

    const blobPath = this.getBlobPath(internalId)
    try {
      await del(blobPath)
    } catch {
      // Ignore not found error on delete
    }
  }
}

/**
 * Creates the appropriate storage adapter depending on the runtime environment.
 * If Vercel Blob credentials (token or OIDC) are configured, uses Vercel Blob Storage with private access.
 * Otherwise, falls back to local disk storage.
 */
export function createStorageAdapter(uploadsDir?: string): StorageAdapter {
  if (hasBlobStorageConfigured()) {
    return new VercelBlobStorageAdapter()
  }
  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  const defaultDir = isVercel
    ? path.join(os.tmpdir(), 'ewem-uploads')
    : path.resolve(process.cwd(), 'uploads')
  const dir = uploadsDir || process.env.UPLOADS_DIR || defaultDir
  return new LocalDiskStorageAdapter(dir)
}
