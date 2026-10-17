import fs from 'fs'
import path from 'path'

export interface StorageAdapter {
  save(buffer: Buffer, internalId: string, originalName: string): Promise<string>
  read(internalId: string): Promise<Buffer>
  exists(internalId: string): Promise<boolean>
  delete(internalId: string): Promise<void>
  getFilePath(internalId: string): string
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
    // Sanitize internalId to avoid directory traversal
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
}
