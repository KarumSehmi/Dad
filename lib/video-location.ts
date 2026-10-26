// Runs in the browser. Phones record where a video was filmed inside the file,
// as text like "+51.5074-000.1278/". This finds that text in an MP4 or MOV
// file's metadata and turns the numbers into zeros, without changing the
// file's size or layout and without reading the video itself, which can be
// hundreds of megabytes. Anything that isn't an MP4 or MOV file, or doesn't
// look as expected, is returned unchanged.

// An MP4 or MOV file is a series of "boxes": a 4-byte size, a 4-character
// type, then the contents. The metadata lives in the "moov" box, in "udta"
// and "meta" boxes either directly inside it or inside a "trak" box.

type Box = { type: string; start: number; end: number; headerSize: number };

/** Coordinates in ISO 6709 form: signed latitude and longitude, maybe altitude. */
const COORDINATES = /[+-]\d{2,6}(?:\.\d+)?[+-]\d{3,7}(?:\.\d+)?(?:[+-]\d+(?:\.\d+)?)?/g;
const BOX_TYPE = /^[\x20-\x7e\xa9]{4}$/;
/** The moov box is usually well under 1 MB; much bigger means something unusual. */
const MAX_MOOV_BYTES = 64 * 1024 * 1024;

function text(bytes: Uint8Array, start: number, end: number): string {
  // One character per byte, so positions in the text match positions in the file.
  return new TextDecoder("latin1").decode(bytes.subarray(start, end));
}

/**
 * Reads the box header at `offset`, where `room` is how many bytes are left
 * in the enclosing box (or file). Returns null if it doesn't look like one.
 */
function readHeader(bytes: Uint8Array, offset: number, room: number) {
  if (offset + 8 > bytes.length) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let size = view.getUint32(offset);
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > bytes.length) return null;
    size = Number(view.getBigUint64(offset + 8));
    headerSize = 16;
  } else if (size === 0) {
    size = room; // Runs to the end.
  }
  const type = text(bytes, offset + 4, offset + 8);
  if (!BOX_TYPE.test(type) || size < headerSize || size > room) return null;
  return { type, size, headerSize };
}

function* children(bytes: Uint8Array, parent: Box): Generator<Box> {
  let offset = parent.start + parent.headerSize;
  for (;;) {
    const header = readHeader(bytes, offset, parent.end - offset);
    if (!header) return;
    yield { type: header.type, start: offset, end: offset + header.size, headerSize: header.headerSize };
    offset += header.size;
  }
}

/** Zeroes every coordinate written as text within the box. */
function zeroCoordinates(bytes: Uint8Array, box: Box): boolean {
  let changed = false;
  for (const match of text(bytes, box.start, box.end).matchAll(COORDINATES)) {
    const start = box.start + match.index;
    for (let i = start; i < start + match[0].length; i++) {
      // Digits 1-9 become 0; signs and decimal points stay.
      if (bytes[i] >= 0x31 && bytes[i] <= 0x39) {
        bytes[i] = 0x30;
        changed = true;
      }
    }
  }
  return changed;
}

function scrub(bytes: Uint8Array, parent: Box): boolean {
  let changed = false;
  for (const box of children(bytes, parent)) {
    if (box.type === "trak") {
      changed = scrub(bytes, box) || changed;
    } else if (box.type === "udta" || box.type === "meta") {
      changed = zeroCoordinates(bytes, box) || changed;
      // Some phones store the location as numbers instead, in a "loci" box.
      for (const inner of children(bytes, box)) {
        if (inner.type === "loci") {
          bytes.fill(0, inner.start + inner.headerSize, inner.end);
          changed = true;
        }
      }
    }
  }
  return changed;
}

export async function stripVideoLocation(file: Blob): Promise<Blob> {
  try {
    // Step through the top-level boxes, reading only their headers, to find moov.
    let offset = 0;
    for (let i = 0; i < 1000 && offset < file.size; i++) {
      const head = new Uint8Array(await file.slice(offset, offset + 16).arrayBuffer());
      const header = readHeader(head, 0, file.size - offset);
      if (!header) break;
      if (header.type === "moov") {
        if (header.size > MAX_MOOV_BYTES) break;
        const moov = new Uint8Array(await file.slice(offset, offset + header.size).arrayBuffer());
        if (!scrub(moov, { type: "moov", start: 0, end: moov.length, headerSize: header.headerSize })) break;
        return new Blob([file.slice(0, offset), moov, file.slice(offset + header.size)], { type: file.type });
      }
      offset += header.size;
    }
  } catch {
    // Unreadable; send the file as it is.
  }
  return file;
}
