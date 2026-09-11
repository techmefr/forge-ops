import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

const LANGUAGES: Readonly<Record<string, string>> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  vue: 'xml',
  html: 'xml',
  svg: 'xml',
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

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

let registered = false

function register(): void {
  if (registered) {
    return
  }
  hljs.registerLanguage('typescript', typescript)
  hljs.registerLanguage('javascript', javascript)
  hljs.registerLanguage('xml', xml)
  hljs.registerLanguage('css', css)
  hljs.registerLanguage('json', json)
  hljs.registerLanguage('sql', sql)
  hljs.registerLanguage('bash', bash)
  hljs.registerLanguage('markdown', markdown)
  hljs.registerLanguage('python', python)
  hljs.registerLanguage('yaml', yaml)
  registered = true
}

export function escapedOf(text: string): string {
  return text.replace(/[&<>"']/g, (sign) => ESCAPES[sign] ?? sign)
}

export function languageOfPath(path: string): string | null {
  const extension = (path.split('.').pop() ?? '').toLowerCase()
  return LANGUAGES[extension] ?? null
}

export function highlightedOf(text: string, language: string | null): string {
  if (language === null) {
    return escapedOf(text)
  }
  register()
  try {
    return hljs.highlight(text, { language, ignoreIllegals: true }).value
  } catch {
    return escapedOf(text)
  }
}
