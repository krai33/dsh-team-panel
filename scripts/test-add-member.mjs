import assert from 'node:assert/strict'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { TeamPanelAvatarService } from '../lib/host/index.js'

async function service(t, config = {}) {
  const root = await realpath(tmpdir())
  const dir = await mkdtemp(join(root, 'team-panel-add-test-'))
  t.after(async () => {
    assert.equal(await realpath(dir), dir)
    assert.ok(dir.startsWith(join(root, 'team-panel-add-test-')))
    await rm(dir, { recursive: true })
  })
  return new TeamPanelAvatarService(new Context(), { dataDir: dir, ...config })
}

function stub(svc) {
  const calls = []
  svc.ctx = {
    agents: { get: id => (id === 'lead' ? { id: 'lead' } : undefined) },
    subagents: {
      startActivation: async (spec) => {
        calls.push(spec)
        return { childId: 'child-1' }
      },
    },
  }
  return calls
}

test('addMember maps the depth tier to the configured preset and spawns under the lead', async t => {
  const svc = await service(t, { depthPresets: { '2': 'deep-2' } })
  const calls = stub(svc)
  const created = await svc.addMember({ sessionId: 'lead', prompt: 'audit the assets\nsecond line', depth: 2 })
  assert.deepEqual(created, { childId: 'child-1' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].provider, 'spawn')
  assert.equal(calls[0].delivery, 'parent')
  assert.equal(calls[0].label, 'audit the assets')
  assert.equal(calls[0].request.agentPreset, 'deep-2')
  assert.deepEqual(calls[0].request.prompt, [{ type: 'text', text: 'audit the assets\nsecond line' }])
  assert.equal(calls[0].request.parent.id, 'lead')
})

test('depth 1 without a mapping inherits the parent preset; labels and provider are configurable', async t => {
  const svc = await service(t, { spawnProvider: 'fork', depthPresets: { '1': 'basic' } })
  const calls = stub(svc)
  await svc.addMember({ sessionId: 'lead', prompt: 'x', depth: 1 })
  assert.equal(calls[0].provider, 'fork')
  assert.equal(calls[0].request.agentPreset, 'basic')
  const unconfigured = await service(t)
  const plain = stub(unconfigured)
  await unconfigured.addMember({ sessionId: 'lead', prompt: 'x', label: 'Seat PM', depth: 1 })
  assert.equal(plain[0].label, 'Seat PM')
  assert.equal(plain[0].request.agentPreset, undefined)
})

test('an unmapped depth above 1 is refused before any spawn', async t => {
  const svc = await service(t, { depthPresets: { '2': 'deep-2' } })
  const calls = stub(svc)
  await assert.rejects(svc.addMember({ sessionId: 'lead', prompt: 'x', depth: 3 }), { code: 'teamPanel/depth-unconfigured' })
  assert.equal(calls.length, 0)
})

test('request validation refuses bad input before resolving the lead', async t => {
  const svc = await service(t)
  const calls = stub(svc)
  await assert.rejects(svc.addMember({ sessionId: '', prompt: 'x' }), { code: 'teamPanel/invalid-request' })
  await assert.rejects(svc.addMember({ sessionId: 'lead', prompt: '' }), { code: 'teamPanel/invalid-request' })
  await assert.rejects(svc.addMember({ sessionId: 'lead', prompt: 'x', depth: 0 }), { code: 'teamPanel/invalid-request' })
  await assert.rejects(svc.addMember({ sessionId: 'lead', prompt: 'x', depth: 1.5 }), { code: 'teamPanel/invalid-request' })
  assert.equal(calls.length, 0)
})

test('a lead without a live Agent is refused with not-live', async t => {
  const svc = await service(t)
  const calls = stub(svc)
  await assert.rejects(svc.addMember({ sessionId: 'other', prompt: 'x' }), { code: 'teamPanel/not-live' })
  assert.equal(calls.length, 0)
})
