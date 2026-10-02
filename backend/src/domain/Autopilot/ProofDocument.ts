import type { CheckpointName } from '../Checkpoint/Checkpoint.js'

const PREAMBLE =
  'The orchestrator wrote this proof, not the agent. It ran the commands listed below itself, inside the story worktree, and recorded what they returned. Nothing here rests on the word of the agent that did the work.'

const INDENT = '    '

export function checkedProofPathOf(storyReference: string, name: CheckpointName): string {
  return `.claude/evidence/${storyReference}/${name}.checked.md`
}

export function criterionProofPathOf(storyReference: string, criterionReference: string): string {
  const safe = criterionReference.replace(/[^A-Za-z0-9._-]/g, '_')
  return `.claude/evidence/${storyReference}/criteria/${safe}.checked.md`
}

export function quoted(output: string): readonly string[] {
  const body = output.trim() === '' ? '(no output)' : output.trim()
  return body.split(/\r?\n/).map((line) => `${INDENT}${line}`)
}

export function proofDocument(title: string, sections: Readonly<Record<string, readonly string[]>>): string {
  const body = Object.entries(sections).flatMap(([heading, lines]) => ['', `## ${heading}`, '', ...lines])
  return [`# ${title}`, '', PREAMBLE, ...body, ''].join('\n')
}
