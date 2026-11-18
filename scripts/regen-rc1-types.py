#!/usr/bin/env python3
"""Regenerate /tmp/rc1-types + tsconfig.client.json paths from the rc.1 release commit.

The client typecheck needs exact 0.2.2-rc.1 sources (published installs ship
only runtime packages for the web UI). Run from anywhere:

    python3 scripts/regen-rc1-types.py
"""
import json
import os
import re
import subprocess
import sys

REPO = '/home/xiwa/gitlab/deepseek-harness'
COMMIT = '2f97f60455'  # release(dsh): 0.2.2-rc.1
OUT = '/tmp/rc1-types'
GROUPS = ['util', 'llm', 'session', 'subagent', 'client', 'api', 'core', 'todo', 'attachment', 'workspace', 'typert']
CORDIS = '/home/xiwa/gitlab/dsh-subagent-model-switch/node_modules/@deepseek-ai/cordis/lib/types/index.d.ts'

os.makedirs(OUT, exist_ok=True)
for group in GROUPS:
    blob = subprocess.run(['git', '-C', REPO, 'archive', f'{COMMIT}:packages/{group}'], capture_output=True)
    if blob.returncode != 0:
        sys.exit(f'git archive failed for {group}')
    subprocess.run(['tar', '-x', '-C', OUT], input=blob.stdout, check=True)

mapping: dict[str, list[str]] = {}

def add(name: str, path: str) -> None:
    mapping.setdefault(name, []).append(path)

def map_pkg(dirpath: str) -> None:
    pj = os.path.join(dirpath, 'package.json')
    src = os.path.join(dirpath, 'src')
    if not (os.path.exists(pj) and os.path.isdir(src)):
        return
    try:
        j = json.load(open(pj))
    except ValueError:
        return
    name = j.get('name', '')
    if not name.startswith('@deepseek-ai/'):
        return
    add(name, os.path.join(src, 'index.ts'))
    exports = j.get('exports', {})
    if isinstance(exports, list):
        exports = {}
    for sub, spec in exports.items():
        if sub in ('.', './package.json'):
            continue
        target = spec.get('default') if isinstance(spec, dict) else spec
        if not isinstance(target, str):
            continue
        if target.startswith('./lib/client'):
            for cand in (os.path.join(src, 'client.ts'), os.path.join(src, 'client', 'index.ts')):
                if os.path.exists(cand):
                    add(name + sub.removeprefix('.'), cand)
                    break
            continue
        for pref in ('./lib/types/', './lib/'):
            if target.startswith(pref):
                rel = re.sub(r'\.(d\.ts|js|mjs|ts)$', '', target[len(pref):])
                cand = os.path.join(src, rel + '.ts')
                if os.path.exists(cand):
                    add(name + sub.removeprefix('.'), cand)
                break

for dirpath, dirnames, filenames in os.walk(OUT):
    if 'node_modules' in dirpath:
        continue
    if 'package.json' in filenames:
        map_pkg(dirpath)

# package.json exports omit ./types for these two; the reference imports use it.
mapping['@deepseek-ai/dsh-subagent/types'] = [os.path.join(OUT, 'subagent/src/projection-types.ts')]
mapping['@deepseek-ai/dsh-tool-todo/types'] = [os.path.join(OUT, 'tool-todo/src/types.ts')]
mapping['@deepseek-ai/cordis'] = [CORDIS]

cfg = {
    'compilerOptions': {
        'target': 'ES2023', 'module': 'NodeNext', 'moduleResolution': 'NodeNext',
        'lib': ['ES2023', 'DOM', 'DOM.Iterable'], 'jsx': 'react-jsx',
        'strict': True, 'noImplicitAny': True, 'skipLibCheck': True, 'noEmit': True,
        'allowImportingTsExtensions': True, 'verbatimModuleSyntax': True,
        'typeRoots': ['./node_modules/@types'],
        'paths': mapping,
    },
    'include': ['src/client/**/*.ts', 'src/client/**/*.tsx'],
}
json.dump(cfg, open('tsconfig.client.json', 'w'), indent=2)
print(f'{len(mapping)} paths -> tsconfig.client.json')
