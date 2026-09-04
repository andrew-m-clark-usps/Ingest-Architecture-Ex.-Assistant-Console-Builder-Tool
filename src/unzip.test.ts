import { describe, expect, it } from 'vitest'
import { readZipEntries } from './unzip.js'
import { buildStoredZip } from './testZipFixture.js'

describe('readZipEntries', () => {
  it('round-trips a stored (uncompressed) entry read from the central directory', async () => {
    const data = new TextEncoder().encode('hello from a stored entry')
    const zip = buildStoredZip([{ name: 'greeting.txt', data }])

    const entries = await readZipEntries(zip)

    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe('greeting.txt')
    expect(new TextDecoder().decode(entries[0].data)).toBe('hello from a stored entry')
  })

  it('reads multiple entries in central-directory order', async () => {
    const zip = buildStoredZip([
      { name: 'a.txt', data: new TextEncoder().encode('A') },
      { name: 'b.txt', data: new TextEncoder().encode('B') },
    ])

    const entries = await readZipEntries(zip)

    expect(entries.map((e) => e.name)).toEqual(['a.txt', 'b.txt'])
  })

  it('refuses a buffer with no end-of-central-directory record', async () => {
    const notAZip = new TextEncoder().encode('this is not a zip file at all')
    await expect(readZipEntries(notAZip)).rejects.toThrow(/end-of-central-directory/)
  })
})
