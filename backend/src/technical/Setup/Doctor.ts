export type Check = {
  label: string
  isOk: boolean
  hint: string
}

export type CommandRunner = (command: string, args: readonly string[]) => Promise<boolean>
export type SecretProbe = (name: string) => boolean
export type HealthProbe = (url: string) => Promise<boolean>

export type DoctorInput = {
  run: CommandRunner
  hasSecret: SecretProbe
  isHealthy: HealthProbe
  secrets: readonly string[]
  healthUrl: string
}

export async function diagnose({ run, hasSecret, isHealthy, secrets, healthUrl }: DoctorInput): Promise<readonly Check[]> {
  const checks: Check[] = [
    {
      label: 'docker is installed',
      isOk: await run('docker', ['--version']),
      hint: 'install Docker from https://docs.docker.com/get-docker/',
    },
    {
      label: 'docker compose v2 is available',
      isOk: await run('docker', ['compose', 'version']),
      hint: 'update Docker, compose v2 ships as a plugin',
    },
    {
      label: 'the docker daemon answers',
      isOk: await run('docker', ['info']),
      hint: 'start Docker, or add your user to the docker group',
    },
  ]
  for (const name of secrets) {
    checks.push({
      label: `secret ${name} exists`,
      isOk: hasSecret(name),
      hint: 'run forge-ops init to generate it',
    })
  }
  checks.push({
    label: `the instance answers on ${healthUrl}`,
    isOk: await isHealthy(healthUrl),
    hint: 'start it with forge-ops up, then check docker compose logs',
  })
  return checks
}
