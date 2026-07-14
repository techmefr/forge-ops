import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const NPM_REGISTRY_BASE_URL = 'https://registry.npmjs.org'

interface INpmPackageMeta {
  'dist-tags': { latest: string }
}

export interface IDocFreshnessResult {
  packageName: string
  installedVersion: string | null
  latestVersion: string
  isUpToDate: boolean
}

async function fetchLatestVersion(packageName: string): Promise<string> {
  const response = await fetch(`${NPM_REGISTRY_BASE_URL}/${encodeURIComponent(packageName)}`)
  if (!response.ok) {
    throw new Error(`Registre npm indisponible pour ${packageName}: ${response.status}`)
  }
  const meta = (await response.json()) as INpmPackageMeta
  return meta['dist-tags'].latest
}

function readInstalledVersion(packageName: string, packageJson: Record<string, unknown>): string | null {
  const dependencies = packageJson.dependencies as Record<string, string> | undefined
  const devDependencies = packageJson.devDependencies as Record<string, string> | undefined
  const declared = dependencies?.[packageName] ?? devDependencies?.[packageName]
  if (declared === undefined) {
    return null
  }
  return declared.replace(/^[^0-9]*/, '')
}

export async function checkDocFreshness(
  packageName: string,
  packageJson: Record<string, unknown>,
): Promise<IDocFreshnessResult> {
  const [latestVersion, installedVersion] = await Promise.all([
    fetchLatestVersion(packageName),
    Promise.resolve(readInstalledVersion(packageName, packageJson)),
  ])
  return {
    packageName,
    installedVersion,
    latestVersion,
    isUpToDate: installedVersion !== null && installedVersion === latestVersion,
  }
}

export function registerCheckDocFreshness(server: McpServer, packageJson: Record<string, unknown>): void {
  server.registerTool(
    'check_doc_freshness',
    {
      title: 'Verifier la fraicheur d une dependance',
      description:
        'Compare la version installee d un package a la derniere version publiee sur le registre npm, pour eviter de coder contre une doc obsolete',
      inputSchema: {
        packageName: z.string().min(1),
      },
    },
    async (args) => {
      try {
        const result = await checkDocFreshness(args.packageName, packageJson)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: message }],
          isError: true,
        }
      }
    },
  )
}
