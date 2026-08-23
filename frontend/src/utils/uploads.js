// Upload rules, checked on the device before anything is sent.
//
// The server enforces all of this again (it must — a client can lie), but
// finding out that a 40MB photo is too big *after* uploading it over mobile
// data is a bad way to learn. These limits mirror backend/app/api/v1/endpoints/upload.py.

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_TYPES = {
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'image/bmp': 'BMP',
  'application/pdf': 'PDF',
};

// Listing types explicitly (rather than image/*) means the picker itself hides
// formats the server would reject, such as HEIC and TIFF.
export const ACCEPT_ATTR = Object.keys(ACCEPTED_TYPES).join(',');

export const isPdf = (file) => file.type === 'application/pdf';

export const formatBytes = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const fingerprint = (file) => file.name + ':' + file.size + ':' + file.lastModified;

/** Split a picked file list into what can be sent and what can't, with reasons. */
export function validateFiles(picked, existing = []) {
  const accepted = [];
  const rejected = [];
  const seen = new Set(existing.map(fingerprint));

  for (const file of picked) {
    if (!ACCEPTED_TYPES[file.type]) {
      rejected.push({
        name: file.name,
        reason: file.name.toLowerCase().endsWith('.heic')
          ? 'iPhone HEIC photos aren’t supported — share it as a photo, or save it as JPEG first'
          : 'that file type can’t be read — use a photo or a PDF',
      });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      rejected.push({
        name: file.name,
        reason: 'too large at ' + formatBytes(file.size) + ' (limit is ' + formatBytes(MAX_FILE_BYTES) + ')',
      });
      continue;
    }
    const key = fingerprint(file);
    if (seen.has(key)) {
      rejected.push({ name: file.name, reason: 'already added' });
      continue;
    }
    seen.add(key);
    accepted.push(file);
  }

  return { accepted, rejected };
}

/** One sentence a person can act on, or '' when everything was fine. */
export function describeRejections(rejected) {
  if (!rejected.length) return '';
  if (rejected.length === 1) return rejected[0].name + ': ' + rejected[0].reason;
  return rejected.length + ' files were skipped — ' + rejected[0].name + ': ' + rejected[0].reason;
}
