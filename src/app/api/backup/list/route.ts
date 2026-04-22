import { NextResponse } from 'next/server'
import { createClient, createServiceClient, getProfile } from '@/utils/supabase/server'

export type BackupFile = {
  name: string
  path: string
  size: number
}

export type BackupDate = {
  date: string
  files: BackupFile[]
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const profile = await getProfile()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const service = createServiceClient()

  // List top-level folders under backups/
  const { data: folders, error: folderError } = await service.storage
    .from('documenti')
    .list('backups', { limit: 100, sortBy: { column: 'name', order: 'desc' } })

  if (folderError) {
    return NextResponse.json({ error: folderError.message }, { status: 500 })
  }

  const backups: BackupDate[] = []

  for (const folder of folders ?? []) {
    // Each folder.name is a date string like "2026-04-21"
    const { data: files, error: filesError } = await service.storage
      .from('documenti')
      .list(`backups/${folder.name}`, {
        limit: 50,
        sortBy: { column: 'name', order: 'asc' },
      })

    if (filesError || !files) continue

    backups.push({
      date: folder.name,
      files: files.map((f) => ({
        name: f.name,
        path: `backups/${folder.name}/${f.name}`,
        size: f.metadata?.size ?? 0,
      })),
    })
  }

  return NextResponse.json({ backups })
}
