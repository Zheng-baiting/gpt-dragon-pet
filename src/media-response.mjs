// The host has already resolved/validated the file. Honour Chromium's byte range
// requests when reopening a video, rather than returning the entire file as a
// response to a partial read. Kept standalone for the project runtime patch.
export function mediaResponse(data, range, headers = {}, method = 'GET') {
  const size = data.length;
  headers = { ...headers, 'accept-ranges': 'bytes', 'cache-control': 'no-store' };
  let start = 0, end = size - 1, status = 200;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match && (match[1] || match[2])) {
      if (match[1]) {
        start = Number(match[1]);
        if (match[2]) end = Math.min(Number(match[2]), end);
      } else start = Math.max(0, size - Number(match[2]));
      if (Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end && start < size) {
        status = 206;
        headers['content-range'] = `bytes ${start}-${end}/${size}`;
      } else return new Response(null, { status: 416, headers: { ...headers, 'content-range': `bytes */${size}` } });
    }
    // Malformed/unsupported multi-ranges are ignored, returning a complete 200.
  }
  headers['content-length'] = String(end - start + 1);
  return new Response(method === 'HEAD' ? null : new Uint8Array(data.subarray(start, end + 1)), { status, headers });
}
