import JSZip from 'jszip'
import { exportPptxBuffer } from '../src/export/pptx'
import { defaultSettings, type Deck } from '../src/model/types'

const deck: Deck = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'PPT Master contract smoke',
  subtitle: 'Native editable output',
  theme: 'obsidian',
  archetype: 'pitch',
  slides: [
    {
      id: 'slide-1',
      type: 'title',
      title: 'Native by construction',
      subtitle: 'Every object is a real PowerPoint object',
      notes: 'Open by naming the claim, then move to the objects.',
    },
    {
      id: 'slide-2',
      type: 'bullets',
      title: 'What survives the export',
      bullets: [
        { text: 'Editable text runs' },
        { text: 'Native shapes and rules' },
        { text: 'Speaker notes on every slide' },
      ],
      notes: 'These are text runs inside the slide XML, not a picture.',
    },
  ],
  settings: defaultSettings(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const buffer = await exportPptxBuffer(deck)
const zip = await JSZip.loadAsync(buffer)
const files = Object.keys(zip.files)
const slides = files.filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).length
const notes = files.filter((f) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f)).length
const media = files.filter((f) => f.startsWith('ppt/media/')).length
const slideXml = await zip.file('ppt/slides/slide2.xml')!.async('string')
const noteXml = await zip.file('ppt/notesSlides/notesSlide2.xml')!.async('string')

console.log(
  JSON.stringify({
    bytes: buffer.length,
    zip: buffer[0] === 0x50 && buffer[1] === 0x4b,
    slides,
    notes,
    media,
    editableText: slideXml.includes('Editable text runs'),
    nativeNoteText: noteXml.includes('not a picture'),
    contentTypes: files.includes('[Content_Types].xml'),
    presentation: files.includes('ppt/presentation.xml'),
  })
)
