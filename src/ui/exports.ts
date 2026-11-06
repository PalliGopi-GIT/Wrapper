import { store } from '../store'
import { api } from '../app/api'
import { toast } from './dom'
import { downloadPptx } from '../export/pptx'
import { downloadPdf, printPdf } from '../export/pdf'
import { downloadPngs, downloadMarkdown } from '../export/png'
import { downloadStandaloneHtml } from '../export/html'
import { saveProject } from '../export/project'

export type ExportKind =
  | 'pptx'
  | 'pptx-server'
  | 'pdf-print'
  | 'pdf-download'
  | 'png'
  | 'html'
  | 'markdown'
  | 'project'

export const EXPORT_LABELS: Record<ExportKind, string> = {
  pptx: 'PowerPoint',
  'pptx-server': 'PowerPoint (server)',
  'pdf-print': 'PDF',
  'pdf-download': 'PDF (direct)',
  png: 'PNG images',
  html: 'Standalone HTML',
  markdown: 'Markdown + notes',
  project: 'Project file',
}

export async function runExport(kind: ExportKind) {
  const deck = store.deck
  if (!deck.slides.length) {
    toast('There are no slides to export.', 'err')
    return
  }
  const label = EXPORT_LABELS[kind]
  toast(`Preparing ${label}…`, 'info', 1800)
  try {
    switch (kind) {
      case 'pptx':
        await downloadPptx(deck)
        toast('PowerPoint saved — native, editable shapes.')
        break
      case 'pptx-server': {
        const result = await api<{ downloadUrl: string; meta: { slides: number } }>(
          '/exports/pptx',
          {
            method: 'POST',
            body: JSON.stringify({ deckId: deck.id, deck }),
          }
        )
        const link = document.createElement('a')
        link.href = result.downloadUrl
        link.download = ''
        document.body.appendChild(link)
        link.click()
        link.remove()
        toast(`PowerPoint rendered on the server — ${result.meta.slides} slides.`)
        break
      }
      case 'pdf-print':
        await printPdf(deck)
        toast('Print dialog opened — choose “Save as PDF”.')
        break
      case 'pdf-download':
        await downloadPdf(deck)
        toast('PDF downloaded.')
        break
      case 'png':
        await downloadPngs(deck)
        toast('PNG bundle downloaded.')
        break
      case 'html':
        await downloadStandaloneHtml(deck)
        toast('Standalone deck downloaded.')
        break
      case 'markdown':
        downloadMarkdown(deck)
        toast('Markdown downloaded.')
        break
      case 'project':
        saveProject(deck)
        toast('Project file saved.')
        break
    }
  } catch (e) {
    console.error(e)
    toast((e as Error).message || `Could not export ${label}.`, 'err', 5000)
  }
}
