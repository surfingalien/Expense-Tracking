// Receipt images live in a *private* Vercel Blob store under
// receipts/<userId>/..., and are only served back through an API route that
// checks the expense belongs to the signed-in user.
import { del, get, put } from '@vercel/blob'

export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)
}

export function receiptPrefix(userId: string): string {
  return `receipts/${encodeURIComponent(userId)}/`
}

/** True when `path` is a receipt pathname owned by this user. */
export function isOwnReceiptPath(userId: string, path: unknown): path is string {
  return typeof path === 'string' && path.startsWith(receiptPrefix(userId)) && !path.includes('..') && path.length < 300
}

export async function storeReceipt(userId: string, jpeg: Buffer): Promise<string> {
  const blob = await put(`${receiptPrefix(userId)}receipt.jpg`, jpeg, {
    access: 'private',
    contentType: 'image/jpeg',
    addRandomSuffix: true,
  })
  return blob.pathname
}

/** Returns an HTTP response with the receipt image, or null if missing. */
export async function receiptResponse(stored: string): Promise<Response | null> {
  // Legacy rows stored a compressed data URL directly in the database.
  const dataUrl = stored.match(/^data:(image\/[a-z+]+);base64,(.+)$/)
  if (dataUrl) {
    return new Response(Buffer.from(dataUrl[2], 'base64'), {
      headers: { 'Content-Type': dataUrl[1], 'Cache-Control': 'private, max-age=3600' },
    })
  }
  const result = await get(stored, { access: 'private' })
  if (!result || result.statusCode !== 200) return null
  return new Response(result.stream, {
    headers: { 'Content-Type': result.blob.contentType, 'Cache-Control': 'private, max-age=3600' },
  })
}

export async function deleteReceipt(stored: string | null | undefined): Promise<void> {
  if (!stored || stored.startsWith('data:') || !blobConfigured()) return
  try {
    await del(stored)
  } catch (err) {
    console.warn('Failed to delete receipt blob', err)
  }
}

/** URL the client uses to display an expense's receipt. */
export function receiptUrl(expenseId: string, stored: string | null): string | null {
  return stored ? `/api/expenses/${expenseId}/receipt` : null
}
