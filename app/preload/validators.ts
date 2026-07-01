import type { SyncCompletedWire, SyncProgressWire } from '../shared/ipcTypes';

function rejectUnknown(value: Record<string, unknown>, allowed: string[], name: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) throw new Error(`${name}.${unknown[0]} is not allowed`);
}

function assertInteger(value: unknown, name: string): asserts value is number {
  assertNumber(value, name);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
}

export function validateSyncProgressWire(value: unknown): SyncProgressWire {
  assertObject(value, 'sync progress');
  rejectUnknown(value, ['scope', 'sectionId', 'completed', 'total', 'percent', 'feedId'], 'sync progress');
  if (!['feed', 'section', 'all'].includes(String(value.scope))) throw new Error('sync progress.scope is invalid');
  assertInteger(value.completed, 'sync progress.completed');
  assertInteger(value.total, 'sync progress.total');
  assertInteger(value.percent, 'sync progress.percent');
  if (value.sectionId !== undefined) assertInteger(value.sectionId, 'sync progress.sectionId');
  if (value.feedId !== undefined) assertInteger(value.feedId, 'sync progress.feedId');
  return value as unknown as SyncProgressWire;
}

export function validateSyncCompletedWire(value: unknown): SyncCompletedWire {
  assertObject(value, 'sync completion');
  rejectUnknown(value, ['source', 'feedId', 'sectionIds', 'status', 'newItems'], 'sync completion');
  if (value.source !== 'scheduler') throw new Error('sync completion.source is invalid');
  if (!['ok', 'not_modified', 'error'].includes(String(value.status))) throw new Error('sync completion.status is invalid');
  assertInteger(value.feedId, 'sync completion.feedId');
  assertInteger(value.newItems, 'sync completion.newItems');
  assertArray(value.sectionIds, 'sync completion.sectionIds');
  value.sectionIds.forEach((sectionId, index) => assertInteger(sectionId, `sync completion.sectionIds[${index}]`));
  return value as unknown as SyncCompletedWire;
}
// app/preload/validators.ts

export function assertObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${name} must be an object`);
  }
}

export function assertNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${name} must be a number`);
  }
}

export function assertArray(value: unknown, name: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }
}

