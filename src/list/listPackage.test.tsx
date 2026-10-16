/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import css from './list.css?raw'
import pkg from '../../package.json'

const sources = import.meta.glob<string>(['./*.ts', './*.tsx', '!./*.test.*'], {
  query: '?raw',
  import: 'default',
  eager: true,
})
const LIST_DEPS = ['@tanstack/react-table']

describe('list.css', () => {
  it('scopes every class selector under the jtl- prefix', () => {
    const classes = [...css.matchAll(/\.([a-zA-Z_-][\w-]*)/g)].map((match) => match[1])
    expect(classes.length).toBeGreaterThan(20)
    expect(classes.filter((name) => !name.startsWith('jtl-'))).toEqual([])
    expect(css).not.toMatch(/@tailwind|(^|[\s,}])(html|body|:root)\b/)
  })

  it('themes through custom properties with dark mode by media query and by hook', () => {
    expect(css).toMatch(/--jtl-bg:/)
    expect(css).toMatch(/var\(--jtl-/)
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)/)
    expect(css).toMatch(/\[data-theme='dark'\]/)
    expect(css).toMatch(/\.jtl-dark/)
  })

  it('gives controls a 44px hit area on coarse pointers', () => {
    const coarse = css.slice(css.indexOf('@media (pointer: coarse)'))
    expect(coarse).toMatch(/min-height: 44px/)
    expect(coarse).toMatch(/min-width: 44px/)
    for (const name of ['.jtl-btn', '.jtl-input', '.jtl-select']) expect(coarse).toContain(name)
  })
})

describe('dependencies', () => {
  it('installs only what ListTable needs', () => {
    expect(Object.keys(pkg.dependencies).sort()).toEqual(LIST_DEPS)
  })

  it('keeps the spreadsheet libraries as optional peers', () => {
    for (const name of ['lucide-react', 'framer-motion', 'date-fns', 'react-colorful', 'react-day-picker', 'react-dropzone', 'lz-string', '@tanstack/match-sorter-utils']) {
      expect((pkg.peerDependencies as Record<string, string>)[name]).toBeTruthy()
      expect((pkg as { peerDependenciesMeta?: Record<string, { optional?: boolean }> }).peerDependenciesMeta?.[name]?.optional).toBe(true)
    }
  })

  it('imports nothing in the list source beyond its own dependencies', () => {
    const allowed = new Set(['react', 'react/jsx-runtime', ...LIST_DEPS])
    const imports = Object.values(sources).flatMap((text) =>
      [...text.matchAll(/from '([^']+)'/g)].map((match) => match[1]),
    )
    expect(imports.length).toBeGreaterThan(10)
    expect(imports.filter((name) => !name.startsWith('./') && !allowed.has(name))).toEqual([])
  })
})
