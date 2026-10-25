import assert from 'node:assert/strict';
import {checkConsumer} from '@hanamesh/devkit/contract';
import {readFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const root = fileURLToPath(new URL('.', import.meta.url));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const run = process.env.HANAMESH_RUN_DIR ?? join(tmpdir(), 'hanamesh-recommender-devkit');
const devkitSpec = 'git+https://github.com/yzsnstotz/hanamesh-server-shared.git#semver:^0.2.0&path:/packages/devkit';
const forbiddenSiblings = ['hanamesh-core', 'hanamesh-usage', '@hanamesh/core', '@hanamesh/usage', '@hanamesh/dsh-app-host'];
const required = ['dist/dsh.js', 'dist/client-ui.js', 'profile/cordis.patch.yml', 'docs/CONTEXT.md', 'README.md', 'LICENSE', 'AGENTS.md', 'docs/DEVKIT_SUPPLY.md'];

function validateManifest(manifest, patch) {
  assert.equal(manifest.name, '@hanamesh/recommender');
  assert.equal(manifest.license, 'MIT');
  assert.equal(Object.hasOwn(manifest, 'private'), false);
  assert.match(manifest.version, /^0\.1\.\d+-rc\.\d+$/u);
  assert.equal(manifest.dsh.bundle.patch, './profile/cordis.patch.yml');
  assert.equal((patch.match(/^\s*- id:/gm) ?? []).length, 1);
  assert.match(patch, /id: hanamesh-recommender/);
  for (const name of forbiddenSiblings) {
    assert.equal(Object.hasOwn(manifest.dependencies ?? {}, name) || Object.hasOwn(manifest.peerDependencies ?? {}, name), false, `forbidden dependency ${name}`);
  }
  assert.equal(Object.hasOwn(manifest.dependencies ?? {}, '@hanamesh/devkit'), false);
  assert.equal(Object.hasOwn(manifest.peerDependencies ?? {}, '@hanamesh/devkit'), false);
  assert.equal(Object.hasOwn(manifest.optionalDependencies ?? {}, '@hanamesh/devkit'), false);
  assert.equal(manifest.devDependencies['@hanamesh/devkit'], devkitSpec);
}

function validateSupplyRecord(record) {
  assert.ok(record.includes(devkitSpec));
  assert.ok(record.includes('SEE LICENSE IN LICENSE'));
  assert.ok(record.includes('Development toolchain, preflight, mutation runner and pack verifier only'));
}

function validateSource(source, file) {
  assert.equal(/voyage|jev|api[_-]key/iu.test(source), false, `provider material in ${file}`);
  for (const name of forbiddenSiblings) {
    assert.equal(source.includes(`from '${name}`) || source.includes(`from "${name}`), false, `forbidden import in ${file}`);
  }
}

export default {
  'check-toolchain': {root, compiler: false, pins: {node: '24.13.1', pnpm: '10.33.0'}},
  preflight: {root, validate: async () => {
    validateManifest(pkg, await readFile(join(root, 'profile/cordis.patch.yml'), 'utf8'));
    validateSupplyRecord(await readFile(join(root, 'docs/DEVKIT_SUPPLY.md'), 'utf8'));
    const sourceFiles = (await readdir(join(root, 'src'))).filter(file => file.endsWith('.js'));
    for (const file of sourceFiles) validateSource(await readFile(join(root, 'src', file), 'utf8'), `src/${file}`);
    const fixture = JSON.parse(await readFile(new URL(import.meta.resolve('@hanamesh/devkit/contract/fixtures/consumer.json')), 'utf8'));
    checkConsumer({consumerRoot: root, requirement: fixture});
  }},
  mutations: {root, evidenceDir: join(run, '_evidence/mutations'), temporaryRoot: tmpdir(), cases: [
    {id: 'free-constraint', file: 'src/constraints.js', from: 'constraints.free=true', to: 'constraints.free=false', test: 'test/constraints.test.mjs', name: 'free constraint is not applied'},
    {id: 'history-cap', file: 'src/history.js', from: 'slice(-20)', to: 'slice(-21)', test: 'test/history.test.mjs', name: 'history exceeds 20 records'},
    {id: 'origin-forwarding', file: 'src/remote.js', from: 'origin:originHeader', to: "origin:'http://127.0.0.1:1'", test: 'test/mock-remote.test.mjs', name: 'forwarded Origin is replaced'},
    {id: 'uninstalled-plugin', file: 'src/routes.js', from: "if(state.installed&&input.kind==='plugin')", to: "if(input.kind==='plugin')", test: 'test/routes.test.mjs', name: 'invoke claims an uninstalled plugin is enabled'},
    {id: 'missing-seat-method', file: 'src/market.js', from: '!packageName)return undefined;', to: '!packageName)return false;', test: 'test/routes.test.mjs', name: 'a seat without isInstalled answers false instead of deferring to the Loader'},
    {id: 'details-seat', file: 'src/routes.js', from: "if(market.has('open')&&Object.keys", to: 'if(false&&Object.keys', test: 'test/routes.test.mjs', name: 'details ignores the market seat'},
  ]},
  'verify-pack': {root, tarball: `artifacts/${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`, required,
    forbidden: /(?:^package\/(?:test|scripts|vendor|node_modules|artifacts)\/)|(?:^package\/\.env$)/u,
    validate: async ({entries, read}) => {
      validateManifest(JSON.parse(read('package.json')), read('profile/cordis.patch.yml').toString());
      validateSupplyRecord(read('docs/DEVKIT_SUPPLY.md').toString());
      for (const file of entries.filter(file => /^package\/dist\/.*\.js$/u.test(file))) {
        validateSource(read(file.slice('package/'.length)).toString(), file);
      }
    }},
};
