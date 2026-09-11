export type RotationReportInput = {
  tokenPath: string
}

export function buildRotationReport({ tokenPath }: RotationReportInput): readonly string[] {
  return [
    `Nouveau jeton du board ecrit dans ${tokenPath}, lisible par son proprietaire uniquement.`,
    'Invalide : toutes les sessions du board ouvertes, il faut se reconnecter.',
    'Invalide : tous les hooks Claude Code installes, leur secret est derive du jeton du board.',
    'Reinstaller le hook : npm run hook:install',
    'Les hooks sont lus au demarrage : redemarre ensuite la session Claude Code.',
    'Relancer le board pour qu il lise le nouveau jeton : npm run forge',
    'Ce jeton est gitignore : ne jamais le committer, ne jamais le passer dans une url.',
  ]
}
