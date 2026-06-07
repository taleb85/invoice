import { describe, expect, it } from 'vitest'
import { normalizeStorageFileUrl, parseSupabasePublicStorageUrl } from '@/lib/open-document-url'

describe('normalizeStorageFileUrl', () => {
  it('removes embedded newlines from storage URLs', () => {
    const broken =
      'https://example.supabase.co\n/storage/v1/object/public/documenti/email_auto_abc.pdf'
    expect(normalizeStorageFileUrl(broken)).toBe(
      'https://example.supabase.co/storage/v1/object/public/documenti/email_auto_abc.pdf',
    )
  })
})

describe('parseSupabasePublicStorageUrl', () => {
  it('parses public URLs with embedded newlines', () => {
    const broken =
      'https://example.supabase.co\n/storage/v1/object/public/documenti/email_auto_abc.pdf'
    expect(parseSupabasePublicStorageUrl(broken)).toEqual({
      bucket: 'documenti',
      objectPath: 'email_auto_abc.pdf',
    })
  })
})
