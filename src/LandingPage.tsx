import React from 'react'
import {
  Table2,
  Calculator,
  Merge,
  Columns3,
  Search,
  Paintbrush,
  Download,
  Undo2,
  Pin,
  GripVertical,
  Rows3,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Github,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react'

const FEATURES = [
  { icon: Table2, title: 'Editable Cells', desc: '15+ column types — text, number, date, select, checkbox, rating, currency, percentage, email, URL, phone, image, file, color, progress.' },
  { icon: Calculator, title: 'Formula Engine', desc: 'SUM, AVERAGE, COUNT, IF, CONCATENATE and more. Cross-sheet references with @ syntax. Auto-recalculation.' },
  { icon: Merge, title: 'Cell Merging', desc: 'Merge cells across rows and columns with visual controls. Full colspan and rowspan support.' },
  { icon: Paintbrush, title: 'Rich Formatting', desc: 'Background and text colors, borders, fonts, bold/italic/underline, text alignment, number formatting.' },
  { icon: Search, title: 'Find & Replace', desc: 'Search across all sheets. Replace individual matches or all at once.' },
  { icon: Download, title: 'CSV Export & Import', desc: 'Full CSV support with proper escaping. Export your data or import from existing spreadsheets.' },
  { icon: Undo2, title: 'Undo / Redo', desc: 'Complete action history. Never lose work — step back and forward through every change.' },
  { icon: Pin, title: 'Column Pinning', desc: 'Pin columns to the left or right edge. Sort, group, resize, and reorder columns freely.' },
  { icon: Rows3, title: 'Row Freezing', desc: 'Freeze header rows in place. Pagination with configurable page sizes.' },
  { icon: FileSpreadsheet, title: 'Blank Sheet Mode', desc: 'Start from scratch — build your own spreadsheet with custom columns and data.' },
  { icon: Columns3, title: 'List Mode', desc: 'Read-only tabular display with horizontal wheel scrolling, column formatting, and expandable rows.' },
  { icon: GripVertical, title: 'Row Drag & Drop', desc: 'Reorder rows by dragging. Supports multi-row selection and batch reordering.' },
]

const FAQS: { q: string; a: string }[] = [
  { q: 'Is Jugaaadi Table free to use?', a: 'Yes. Jugaaadi Table is completely free and open source under the MIT license. You can use it in personal and commercial projects without restrictions.' },
  { q: 'Does it support formulas like Excel?', a: 'Yes. The built-in formula engine supports SUM, AVERAGE, COUNT, MIN, MAX, IF, CONCATENATE, and more. You can also reference cells across sheets using the @ syntax (e.g. @Sheet2!A1).' },
  { q: 'Can I merge cells?', a: 'Yes. Jugaaadi Table supports cell merging with both colspan and rowspan. Select multiple cells and use the merge button in the toolbar, or right-click for the context menu.' },
  { q: 'Does it work with Next.js?', a: 'Yes. Jugaaadi Table is a standard React component that works with Next.js, Remix, Vite, Create React App, and any other React framework. Import it and use it like any other component.' },
  { q: 'How many rows can it handle?', a: 'Jugaaadi Table uses virtualization and pagination to handle large datasets efficiently. The demo loads 1,000 rows, but it can handle tens of thousands with pagination enabled.' },
  { q: 'What column types are available?', a: 'Over 15 built-in types: text, number, date, select, multi-select, checkbox, rating, currency, percentage, email, URL, phone, image, file, color, and progress. Each type has custom rendering, editing, and validation.' },
  { q: 'Can I export data to CSV?', a: 'Yes. One-click CSV export with proper value escaping. You can also import CSV files to populate the table.' },
  { q: 'Is it built on TanStack Table?', a: 'Yes. Jugaaadi Table extends TanStack Table v8 with a rich editing layer — formulas, formatting, cell merging, and more — while keeping the full power of TanStack\'s sorting, filtering, grouping, and pagination.' },
]

function CopyInstallButton() {
  const [copied, setCopied] = React.useState(false)
  const cmd = 'npm install @jugaaadi/table'
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(cmd).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      className="group inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 font-mono text-sm text-gray-100 transition hover:bg-gray-800"
      title="Copy install command"
    >
      <span className="text-gray-400">$</span>
      <span>{cmd}</span>
      {copied ? (
        <Check size={14} className="text-emerald-400" />
      ) : (
        <Copy size={14} className="text-gray-500 group-hover:text-gray-300" />
      )}
    </button>
  )
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-4 text-left text-base font-medium text-gray-900 hover:text-sky-600 transition-colors"
        aria-expanded={open}
      >
        {q}
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && <p className="pb-4 text-sm leading-relaxed text-gray-600">{a}</p>}
    </div>
  )
}

export default function LandingPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      {/* Hero */}
      <header className="bg-gradient-to-br from-sky-500 to-sky-600 text-white px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Jugaaadi Table
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-sky-100 max-w-2xl mx-auto">
            A free, open-source React spreadsheet component with formulas, cell merging,
            15+ column types, formatting, and CSV export. Built on TanStack Table v8.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {['Formulas', 'Merge Cells', '15+ Column Types', 'CSV Export', 'Formatting', 'Undo/Redo'].map(
              (badge) => (
                <span
                  key={badge}
                  className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur-sm"
                >
                  {badge}
                </span>
              ),
            )}
          </div>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <CopyInstallButton />
            <div className="flex gap-3">
              <a
                href="https://github.com/MateenKhan/table"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-4 py-2.5 text-sm font-medium backdrop-blur-sm transition hover:bg-white/25"
              >
                <Github size={16} /> GitHub
              </a>
              <a
                href="https://www.npmjs.com/package/@jugaaadi/table"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-4 py-2.5 text-sm font-medium backdrop-blur-sm transition hover:bg-white/25"
              >
                npm <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Demo */}
      <main>
        <section className="px-2 sm:px-4 py-6">
          <h2 className="text-center text-2xl font-semibold text-gray-800 mb-4">
            Interactive Demo
          </h2>
          <div className="mx-auto max-w-[1400px] h-[70vh] min-h-[500px] rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            {children}
          </div>
        </section>

        {/* Features */}
        <section className="px-4 py-12 sm:py-16 bg-gray-50">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl sm:text-3xl font-semibold text-gray-800 mb-10">
              Everything You Need in a React Spreadsheet
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl bg-white p-5 shadow-sm border border-gray-100"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                    <f.icon size={20} />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Install */}
        <section className="px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mb-6">
              Get Started in Seconds
            </h2>
            <div className="space-y-3">
              {[
                { label: 'npm', cmd: 'npm install @jugaaadi/table' },
                { label: 'yarn', cmd: 'yarn add @jugaaadi/table' },
                { label: 'pnpm', cmd: 'pnpm add @jugaaadi/table' },
              ].map(({ label, cmd }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-3 text-left font-mono text-sm text-gray-100"
                >
                  <span className="text-gray-500 select-none w-12 shrink-0">{label}</span>
                  <span className="flex-1">{cmd}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-lg bg-gray-50 border border-gray-200 p-5 text-left">
              <h3 className="text-base font-semibold text-gray-800 mb-3">Basic Usage</h3>
              <pre className="overflow-x-auto rounded bg-gray-900 p-4 text-sm text-gray-100">
{`import { SpreadsheetTable } from '@jugaaadi/table'
import '@jugaaadi/table/style.css'

function App() {
  return (
    <SpreadsheetTable
      data={myData}
      columns={myColumns}
    />
  )
}`}
              </pre>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-4 py-12 sm:py-16 bg-gray-50">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-2xl sm:text-3xl font-semibold text-gray-800 mb-8">
              Frequently Asked Questions
            </h2>
            <div>
              {FAQS.map((faq) => (
                <FAQItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-4 py-8">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">Jugaaadi Table</span>
            <span>·</span>
            <span>MIT License</span>
            <span>·</span>
            <span>Built by <a href="https://github.com/MateenKhan" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">Mateen Khan</a></span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/MateenKhan/table" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 transition-colors">GitHub</a>
            <a href="https://www.npmjs.com/package/@jugaaadi/table" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 transition-colors">npm</a>
            <a href="https://jugaaadi.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 transition-colors">jugaaadi.com</a>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">
          Built with <a href="https://tanstack.com/table" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500">TanStack Table</a> and <a href="https://react.dev" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500">React</a>
        </p>
      </footer>

      {/* FAQPage JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((faq) => ({
              '@type': 'Question',
              name: faq.q,
              acceptedAnswer: {
                '@type': 'Answer',
                text: faq.a,
              },
            })),
          }),
        }}
      />
    </div>
  )
}
