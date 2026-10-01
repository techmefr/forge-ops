export const LEGACY_STARTER_PROMPTS: readonly string[] = [
  "Read the epic and its links (the project's speckit, graphify). Write the story spec with /speckit.specify: goal, acceptance criteria, out of scope. List the open questions and wait for the answers before concluding.",
  'Start from the approved spec. Propose a plan in short steps, each testable, with the files touched. Flag the risks and the dependencies on other stories.',
  'Follow the approved plan. Write the failing test first, then the code, one commit per step (conventional commits). Run the targeted tests before handing back.',
  'Read the diff as a reviewer: bugs, security, readability, missing tests. One line per finding, with file and line. Do not change the code.',
  'Rebase on the integration branch and run the full gate again. Open the MR as a draft with a symptom / cause / what changes description.',
]
