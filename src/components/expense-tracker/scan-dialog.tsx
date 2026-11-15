'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Loader2,
  RefreshCcw,
  Save,
  ScanLine,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useCategories, useCreateExpense, useScanReceipt } from './hooks'
import {
  ExpenseFormFields,
  ItemsList,
  ReceiptPreview,
  toPayload,
  validateForm,
  type ExpenseFormValue,
} from './expense-form'
import { toISODate } from '@/lib/period'
import { formatCurrency } from '@/lib/format'
import type { ExpenseItem, ScanResult } from '@/lib/types'

type Step = 'upload' | 'scanning' | 'review'

async function fileToDataURL(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif|bmp)$/i.test(file.type)) {
    throw new Error('Unsupported file type. Use a PNG, JPEG, WebP, GIF or BMP image.')
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image is too large (max 10MB)')
  }
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Could not read the file'))
    r.readAsDataURL(file)
  })

  // Downscale large photos client-side to keep uploads fast
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Could not load the image'))
      i.src = raw
    })
    const max = 1600
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    if (scale < 1) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/jpeg', 0.9)
      }
    }
  } catch {
    // fall back to the raw data URL
  }
  return raw
}

export function ScanDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const [step, setStep] = useState<Step>('upload')
  const [image, setImage] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [value, setValue] = useState<ExpenseFormValue>({
    amount: '',
    merchant: '',
    date: toISODate(new Date()),
    categoryId: '',
    description: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: catData } = useCategories()
  const categories = catData?.categories ?? []
  const scanMutation = useScanReceipt()
  const createMutation = useCreateExpense()

  function reset() {
    setStep('upload')
    setImage(null)
    setResult(null)
    setErrors({})
    setValue({ amount: '', merchant: '', date: toISODate(new Date()), categoryId: '', description: '' })
  }

  async function handleFile(file: File | null | undefined) {
    if (!file) return
    try {
      const dataUrl = await fileToDataURL(file)
      setImage(dataUrl)
      setStep('scanning')
      const res = await scanMutation.mutateAsync(dataUrl)
      const scan = res as ScanResult
      setResult(scan)
      setValue({
        amount: scan.total != null ? String(Math.round(scan.total * 100) / 100) : '',
        merchant: scan.merchant === 'Unknown merchant' ? '' : scan.merchant,
        date: scan.date || toISODate(new Date()),
        categoryId: scan.categoryId || categories[0]?.id || '',
        description: '',
      })
      setStep('review')
      if (scan.confidence !== 'high') {
        toast('Please review the extracted fields', {
          description: 'Image quality was limited, so double-check the amount and merchant before saving.',
        })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scanning failed')
      setStep('upload')
      setImage(null)
    }
  }

  async function handleSave() {
    const errs = validateForm(value)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    try {
      const items = result?.items?.length ? result.items : null
      const itemsJson = items ? JSON.stringify(items) : null
      await createMutation.mutateAsync(
        toPayload(value, { items: itemsJson, receiptImage: result?.thumbnail ?? image, source: 'scan' }),
      )
      toast.success(`Receipt saved — ${formatCurrency(Number(value.amount))}`)
      onOpenChange(false)
      reset()
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the expense')
    }
  }

  const items: ExpenseItem[] = result?.items ?? []
  const saving = createMutation.isPending

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-emerald-600" /> Scan receipt
          </DialogTitle>
          <DialogDescription>
            {step === 'review'
              ? 'AI extracted the details below — review, adjust and save.'
              : 'Upload or drop a photo of a receipt. AI reads the merchant, date, items and total automatically.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload receipt image"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                void handleFile(e.dataTransfer.files?.[0])
              }}
              className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-gray-50/70 hover:border-emerald-400 hover:bg-emerald-50/50'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <UploadCloud className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Click to upload or drag & drop</p>
                <p className="mt-1 text-xs text-gray-500">PNG, JPEG, WebP, GIF or BMP — up to 10MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
            </div>
          </div>
        )}

        {step === 'scanning' && (
          <div className="flex flex-col items-center gap-4 py-10">
            {image && (
              <img src={image} alt="Receipt being scanned" className="max-h-40 rounded-lg border border-gray-200 object-contain" />
            )}
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              Extracting receipt data with AI…
            </div>
            <p className="text-xs text-gray-400">This usually takes a few seconds</p>
          </div>
        )}

        {step === 'review' && result && (
          <div className="max-h-[62vh] space-y-4 overflow-y-auto pr-1">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="secondary" className="gap-1 bg-emerald-50 text-emerald-700">
                <Sparkles className="h-3 w-3" /> Extracted with AI
              </Badge>
              <Badge variant="outline" className={result.confidence === 'high' ? 'text-emerald-700' : 'text-amber-600'}>
                {result.confidence === 'high' ? 'High confidence' : result.confidence === 'medium' ? 'Medium confidence' : 'Low confidence'}
                {result.confidence !== 'high' && <AlertTriangle className="h-3 w-3" />}
              </Badge>
            </div>

            {result.thumbnail && <ReceiptPreview image={result.thumbnail} />}
            {items.length > 0 && <ItemsList items={items} />}

            <ExpenseFormFields value={value} onChange={setValue} categories={categories} errors={errors} disabled={saving} />
          </div>
        )}

        <div className="flex justify-between gap-2">
          {step === 'review' ? (
            <Button variant="outline" onClick={reset} disabled={saving}>
              <RefreshCcw className="h-4 w-4" /> Scan another
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            {step === 'review' && (
              <Button onClick={handleSave} disabled={saving} className="min-w-32">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save expense
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
