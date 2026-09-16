import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAdminPin,
  isValidAdminPin,
  checkBruteForceLockout,
  recordFailedLoginAttempt,
  resetFailedLoginAttempts
} from '../src/utils/securityUtils.ts';

describe('admin security utilities', () => {
  beforeEach(() => {
    process.env.ADMIN_PIN = 'mina2026';
    delete process.env.VITE_ADMIN_PIN;
    resetFailedLoginAttempts();
  });

  it('uses the configured admin pin when provided', () => {
    process.env.VITE_ADMIN_PIN = 'mbo-2026';
    assert.equal(getAdminPin(), 'mbo-2026');
    assert.equal(isValidAdminPin('mbo-2026'), true);
    assert.equal(isValidAdminPin('mina2026'), false);
  });

  it('locks after repeated failures', () => {
    const first = recordFailedLoginAttempt();
    const second = recordFailedLoginAttempt();
    const third = recordFailedLoginAttempt();
    const fourth = recordFailedLoginAttempt();
    const fifth = recordFailedLoginAttempt();

    assert.equal(first.attemptsLeft, 4);
    assert.equal(second.attemptsLeft, 3);
    assert.equal(third.attemptsLeft, 2);
    assert.equal(fourth.attemptsLeft, 1);
    assert.equal(fifth.isLocked, true);
    assert.equal(checkBruteForceLockout().isLocked, true);
  });
});
