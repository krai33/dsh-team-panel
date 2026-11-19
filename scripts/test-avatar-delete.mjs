import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { TeamPanelAvatarService } from '../lib/host/index.js'

async function library(t) {
  const root = await realpath(tmpdir())
  const dir = await mkdtemp(join(root, 'team-panel-avatar-test-'))
  const assets = join(dir, 'assets')
  t.after(async () => {
    assert.equal(await realpath(dir), dir)
    assert.ok(dir.startsWith(join(root, 'team-panel-avatar-test-')))
    await rm(dir, { recursive: true })
  })
  await mkdir(assets)
  for (const name of ['custom.webp', 'other.png', 'lead.png', 'member.png']) {
    await writeFile(join(assets, name), name)
  }
  const map = join(dir, 'avatars.json')
  const assignments = { child: 'custom.webp', lead: 'custom.webp', other: 'other.png' }
  await writeFile(map, JSON.stringify(assignments))
  return { service: new TeamPanelAvatarService(new Context(), { dataDir: dir }), dir, assets, map, assignments }
}

test('deleting one image clears its assignments and preserves other files and assignments', async t => {
  const { service, assets, map } = await library(t)
  assert.deepEqual((await service.list()).deletableAssets, ['custom.webp', 'other.png'])
  const deletion = service.deleteAvatar({ asset: 'custom.webp' })
  const otherWrite = service.assign({ sessionId: 'new', asset: 'other.png' })
  assert.deepEqual((await deletion).assignments, { other: 'other.png' })
  await otherWrite
  assert.deepEqual((await service.list()).assets, ['lead.png', 'member.png', 'other.png'])
  assert.deepEqual(JSON.parse(await readFile(map)), { other: 'other.png', new: 'other.png' })
  await assert.rejects(readFile(join(assets, 'custom.webp')), { code: 'ENOENT' })
  await assert.rejects(service.deleteAvatar({ asset: 'custom.webp' }), { code: 'teamPanel/unknown-asset' })
})

test('built-in, traversal and symlink targets are refused', async t => {
  const { service, dir, assets, assignments } = await library(t)
  const outside = join(dir, 'outside.png')
  await writeFile(outside, 'outside')
  await symlink(outside, join(assets, 'linked.png'))
  for (const asset of ['lead.png', 'member.png', '../outside.png', '..\\outside.png', '/outside.png']) {
    await assert.rejects(service.deleteAvatar({ asset }), { code: 'teamPanel/invalid-request' })
  }
  await assert.rejects(service.deleteAvatar({ asset: 'linked.png' }), { code: 'teamPanel/unknown-asset' })
  assert.equal(await readFile(outside, 'utf8'), 'outside')
  assert.equal(await readFile(join(assets, 'lead.png'), 'utf8'), 'lead.png')
  assert.deepEqual((await service.list()).assignments, assignments)
})

test('failed map write restores the staged image and does not publish cleared assignments', async t => {
  const { service, assets, map, assignments } = await library(t)
  await mkdir(`${map}.tmp`)
  await assert.rejects(service.deleteAvatar({ asset: 'custom.webp' }), { code: 'teamPanel/storage-error' })
  assert.deepEqual((await service.list()).assignments, assignments)
  assert.deepEqual(JSON.parse(await readFile(map)), assignments)
  assert.equal(await readFile(join(assets, 'custom.webp'), 'utf8'), 'custom.webp')
})

test('re-upload after deletion uses a different cacheable asset URL', async t => {
  const { service } = await library(t)
  const request = { name: 'portrait.png', data: Buffer.from('bytes').toString('base64') }
  const first = await service.upload(request)
  await service.deleteAvatar({ asset: first.asset })
  const second = await service.upload(request)
  assert.notEqual(second.asset, first.asset)
  assert.equal(second.overwritten, false)
})
