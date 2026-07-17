// =============================================================
//  최소 PNG 크로퍼 (top N 행만 유지) — 의존성 없이 zlib(내장)만 사용
//  headless chrome --screenshot 가 뷰포트보다 캔버스를 길게 출력하며
//  하단에 흰 여백을 남기는 문제를 해결하기 위해 상단 height 행만 크롭한다.
// =============================================================
import fs from "node:fs";
import zlib from "node:zlib";

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// CRC32 (PNG)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** PNG 파일을 상단 cropH 행으로 잘라 같은 경로(또는 out)에 저장 */
export function cropTop(file, cropH, out = file) {
  const d = fs.readFileSync(file);
  if (!d.subarray(0, 8).equals(SIG)) throw new Error("PNG 아님");
  let i = 8, w = 0, h = 0, bitDepth = 8, colorType = 6;
  const idat = [];
  while (i < d.length) {
    const len = d.readUInt32BE(i);
    const type = d.toString("latin1", i + 4, i + 8);
    const data = d.subarray(i + 8, i + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    i += 12 + len;
  }
  if (bitDepth !== 8) throw new Error("8bit PNG 만 지원");
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : colorType === 4 ? 2 : 4;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp + 1;
  const keep = Math.min(cropH, h);

  // 언필터 -> 원시 픽셀 (cropH 행까지만 처리)
  const px = Buffer.alloc(keep * w * bpp);
  let prev = Buffer.alloc(w * bpp);
  for (let y = 0; y < keep; y++) {
    const f = raw[y * stride];
    const line = Buffer.from(raw.subarray(y * stride + 1, y * stride + 1 + w * bpp));
    for (let x = 0; x < line.length; x++) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      const v = line[x];
      if (f === 1) line[x] = (v + a) & 255;
      else if (f === 2) line[x] = (v + b) & 255;
      else if (f === 3) line[x] = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) line[x] = (v + paeth(a, b, c)) & 255;
    }
    line.copy(px, y * w * bpp);
    prev = line;
  }

  // 재인코딩 (filter 0)
  const filtered = Buffer.alloc(keep * stride);
  for (let y = 0; y < keep; y++) {
    filtered[y * stride] = 0;
    px.copy(filtered, y * stride + 1, y * w * bpp, (y + 1) * w * bpp);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(keep, 4);
  ihdr[8] = 8; ihdr[9] = colorType; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    SIG,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(filtered, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(out, png);
  return { w, h: keep };
}
