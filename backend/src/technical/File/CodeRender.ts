import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import githubLight from '@shikijs/themes/github-light'
import githubDark from '@shikijs/themes/github-dark'
import bash from '@shikijs/langs/bash'
import css from '@shikijs/langs/css'
import html from '@shikijs/langs/html'
import javascript from '@shikijs/langs/javascript'
import json from '@shikijs/langs/json'
import jsx from '@shikijs/langs/jsx'
import markdown from '@shikijs/langs/markdown'
import python from '@shikijs/langs/python'
import sql from '@shikijs/langs/sql'
import tsx from '@shikijs/langs/tsx'
import typescript from '@shikijs/langs/typescript'
import vue from '@shikijs/langs/vue'
import yaml from '@shikijs/langs/yaml'

export const EXTENSION_LANGUAGE: Readonly<Record<string, string>> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  vue: 'vue',
  html: 'html',
  svg: 'html',
  css: 'css',
  json: 'json',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  md: 'markdown',
  py: 'python',
  yml: 'yaml',
  yaml: 'yaml',
}

export type CodeRendering = {
  html: string
  known: boolean
  timedOut: boolean
}

export type CodeRenderer = {
  renderedOf: (text: string, path: string) => Promise<CodeRendering>
}

export type CodeRendererInput = {
  timeoutMs?: number
  highlighterOf?: () => Promise<HighlighterCore>
}

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapedOf(text: string): string {
  return text.replace(/[&<>"']/g, (sign) => ESCAPES[sign] ?? sign)
}

export function languageOfPath(path: string): string | null {
  const extension = (path.split('.').pop() ?? '').toLowerCase()
  return EXTENSION_LANGUAGE[extension] ?? null
}

let highlighter: Promise<HighlighterCore> | null = null

function loadedHighlighter(): Promise<HighlighterCore> {
  if (highlighter === null) {
    highlighter = createHighlighterCore({
      themes: [githubLight, githubDark],
      langs: [bash, css, html, javascript, json, jsx, markdown, python, sql, tsx, typescript, vue, yaml],
      engine: createJavaScriptRegexEngine(),
    })
  }
  return highlighter
}

async function timedOut<T>(promise: Promise<T>, timeoutMs: number): Promise<T | 'timed-out'> {
  return Promise.race([
    promise,
    new Promise<'timed-out'>((resolveTimeout) => {
      setTimeout(() => resolveTimeout('timed-out'), timeoutMs)
    }),
  ])
}

const DEFAULT_TIMEOUT_MS = 1500

export function createCodeRenderer({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  highlighterOf = loadedHighlighter,
}: CodeRendererInput = {}): CodeRenderer {
  return {
    async renderedOf(text, path) {
      const language = languageOfPath(path)
      if (language === null) {
        return { html: escapedOf(text), known: false, timedOut: false }
      }

      const rendered = await timedOut(
        highlighterOf().then((core) =>
          core.codeToHtml(text, {
            lang: language,
            themes: { light: 'github-light', dark: 'github-dark' },
            defaultColor: false,
          }),
        ),
        timeoutMs,
      )

      if (rendered === 'timed-out') {
        return { html: escapedOf(text), known: true, timedOut: true }
      }
      return { html: rendered, known: true, timedOut: false }
    },
  }
}
