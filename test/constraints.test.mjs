import test from 'node:test';
import assert from 'node:assert/strict';
import {applyConstraintInput} from '../src/constraints.js';

test('maps the four allowed follow-up constraints and preserves prior constraints', () => {
  assert.deepEqual(applyConstraintInput('分析仓库', {}, '必须免费，只要本地，不要 shell 权限，再给三个'), {
    query: '分析仓库',
    constraints: {free: true, localOnly: true, noShell: true},
    more: 3,
    mapped: ['free', 'localOnly', 'noShell', 'more:3'],
  });
});

test('appends unmapped follow-up text to query without inventing constraints', () => {
  assert.deepEqual(applyConstraintInput('分析仓库', {free: true}, '最好支持 Rust'), {
    query: '分析仓库\n最好支持 Rust', constraints: {free: true}, more: undefined, mapped: [],
  });
});

test('maps English and Japanese forms and rejects out-of-range more counts', () => {
  assert.equal(applyConstraintInput('task', {}, 'free only, local only, no shell, 4 more').more, 4);
  assert.deepEqual(applyConstraintInput('タスク', {}, '無料、ローカルのみ、シェル権限なし').constraints, {free: true, localOnly: true, noShell: true});
  assert.equal(applyConstraintInput('task', {}, '再给 99 个').more, undefined);
});
