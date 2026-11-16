'use client'

import { toast } from 'sonner'
import { Settings } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SectionCard } from './ui-bits'
import { useSettings, useUpdateSettings } from './hooks'
import { COMMON_CURRENCIES, currencySymbol } from '@/lib/format'

function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames(undefined, { type: 'currency' }).of(code) ?? code
  } catch {
    return code
  }
}

export function SettingsCard() {
  const { data } = useSettings()
  const update = useUpdateSettings()
  const current = data?.currency ?? 'USD'
  const options = COMMON_CURRENCIES.includes(current) ? COMMON_CURRENCIES : [current, ...COMMON_CURRENCIES]

  return (
    <SectionCard title="Settings" action={<Settings className="h-4 w-4 text-gray-300" />}>
      <div className="max-w-sm space-y-1.5">
        <Label htmlFor="currency">Currency</Label>
        <Select
          value={current}
          disabled={update.isPending}
          onValueChange={async (currency) => {
            try {
              await update.mutateAsync({ currency })
              toast.success(`Currency set to ${currency}`)
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Could not save currency')
            }
          }}
        >
          <SelectTrigger id="currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((code) => (
              <SelectItem key={code} value={code}>
                {code} · {currencySymbol(code)} · {currencyName(code)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-400">
          Changes how amounts are shown. Existing amounts are not converted between currencies.
        </p>
      </div>
    </SectionCard>
  )
}
