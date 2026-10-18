import fs from 'fs'
import path from 'path'
import os from 'os'
import { put, head, del, BlobNotFoundError } from '@vercel/blob'

export interface StorageAdapter {
  save(buffer: Buffer, internalId: string, originalName: string): Promise<string>
  read(internalId: string): Promise<Buffer>
  exists(internalId: string): Promise<boolean>
  delete(internalId: string): Promise<void>
  getFilePath(internalId: string): string | null
  getUrl(internalId: string): Promise<string | null>
}

export class LocalDiskStorageAdapter implements StorageAdapter {
  private uploadsDir: string

  constructor(uploadsDir: string) {
    this.uploadsDir = uploadsDir
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true })
    }
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
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true })
    }
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

    // Write to local cache in /tmp
    await fs.promises.writeFile(localCache, buffer).catch(() => {})

    // Upload to Vercel Blob
    await put(blobPath, buffer, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
    })

    return internalId
  }

  async getUrl(internalId: string): Promise<string | null> {
    const blobPath = this.getBlobPath(internalId)
    try {
      const details = await head(blobPath)
      return details ? details.url : null
    } catch (err: any) {
      if (err instanceof BlobNotFoundError || err?.name === 'BlobNotFoundError') {
        return null
      }
      return null
    }
  }

  async exists(internalId: string): Promise<boolean> {
    const localCache = this.getLocalCachePath(internalId)
    if (fs.existsSync(localCache)) return true

    const blobPath = this.getBlobPath(internalId)
    try {
      const details = await head(blobPath)
      return Boolean(details && details.url)
    } catch (err: any) {
      return false
    }
  }

  async read(internalId: string): Promise<Buffer> {
    const localCache = this.getLocalCachePath(internalId)
    if (fs.existsSync(localCache)) {
      return await fs.promises.readFile(localCache)
    }

    const blobPath = this.getBlobPath(internalId)
    const details = await head(blobPath)
    if (!details || !details.url) {
      throw new Error(`Blob not found: ${blobPath}`)
    }

    const res = await fetch(details.url)
    if (!res.ok) {
      throw new Error(`Failed to download blob from URL: ${details.url} (Status ${res.status})`)
    }

    const arrayBuf = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuf)

    // Cache locally for fast subsequent reads
    await fs.promises.writeFile(localCache, buffer).catch(() => {})

    return buffer
  }

  async delete(internalId: string): Promise<void> {
    const localCache = this.getLocalCachePath(internalId)
    if (fs.existsSync(localCache)) {
      await fs.promises.unlink(localCache).catch(() => {})
    }

    const blobPath = this.getBlobPath(internalId)
    try {
      await del(blobPath)
    } catch (err) {
      // Ignore not found error on delete
    }
  }
}

/**
 * Creates the appropriate storage adapter depending on the runtime environment.
 * If BLOB_READ_WRITE_TOKEN is defined, uses Vercel Blob Storage.
 * Otherwise, falls back to local disk storage.
 */
export function createStorageAdapter(uploadsDir?: string): StorageAdapter {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return new VercelBlobStorageAdapter()
  }
  const dir = uploadsDir || process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads')
  return new LocalDiskStorageAdapter(dir)
}
