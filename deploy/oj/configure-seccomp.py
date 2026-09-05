#!/usr/bin/env python3
"""Derive the executor policy from a pinned Moby allowlist, without disabling it."""
import hashlib
import json
import pathlib

folder = pathlib.Path(__file__).resolve().parent
base = (folder / 'docker-seccomp.base.json').read_bytes()
profile = json.loads(base)
# Check canonical JSON so repository formatters can change indentation without
# changing the reviewed upstream policy or breaking the deployment.
canonical = json.dumps(profile, sort_keys=True, separators=(',', ':')).encode()
assert hashlib.sha256(canonical).hexdigest() == '9da637d2ab0a204fcbd91bd88f1be9e004a3acab61c571a9f5b8870e588a17d2'
# pivot_root is required to construct an inner sandbox. The submitted process's
# independent seccomp.yaml denies it again after the namespace is ready.
for group in profile['syscalls']:
    group['names'] = [name for name in group['names'] if name != 'clone3']
profile['syscalls'] = [group for group in profile['syscalls'] if group['names']]
profile['syscalls'].extend([
    {'names': ['pivot_root'], 'action': 'SCMP_ACT_ALLOW', 'includes': {'caps': ['CAP_SYS_ADMIN']}},
    # clone3's pointed-to flags cannot be inspected by classic seccomp BPF.
    # ENOSYS makes libc and go-judge use clone, whose namespace flags can be
    # inspected by the submitted-process filter. No cgroup fallback is enabled.
    {'names': ['clone3'], 'action': 'SCMP_ACT_ERRNO', 'errnoRet': 38},
])
(folder / 'docker-seccomp.json').write_text(json.dumps(profile, indent=2) + '\n')
