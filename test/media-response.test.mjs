import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaResponse } from '../src/media-response.mjs';

test('video responses honour complete, open, suffix, unsatisfied and HEAD byte requests', async () => {
  const data = new Uint8Array([0, 1, 2, 3, 4]);
  for (const [range, status, contentRange, expected] of [
    [null, 200, null, [0, 1, 2, 3, 4]], ['bytes=1-3', 206, 'bytes 1-3/5', [1, 2, 3]],
    ['bytes=3-', 206, 'bytes 3-4/5', [3, 4]], ['bytes=-2', 206, 'bytes 3-4/5', [3, 4]],
    ['bytes=5-', 416, 'bytes */5', []], ['bytes=3-1', 416, 'bytes */5', []],
    ['bytes=0-1,3-4', 200, null, [0, 1, 2, 3, 4]],
  ]) {
    const result = mediaResponse(data, range);
    assert.equal(result.status, status);
    assert.equal(result.headers.get('content-range'), contentRange);
    assert.deepEqual([...new Uint8Array(await result.arrayBuffer())], expected);
  }
  const head = mediaResponse(data, 'bytes=2-', {}, 'HEAD');
  assert.equal(head.status, 206);
  assert.equal(head.headers.get('content-length'), '3');
  assert.equal((await head.arrayBuffer()).byteLength, 0);
});
