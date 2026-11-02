export async function* nonEmptyLinesOf(stdout: AsyncIterable<string | Buffer>): AsyncGenerator<string> {
  let rest = ''
  for await (const chunk of stdout) {
    const parts = `${rest}${chunk.toString()}`.split('\n')
    rest = parts.pop() ?? ''
    for (const line of parts) {
      if (line.trim() !== '') {
        yield line
      }
    }
  }
}
