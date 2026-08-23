import { validateFiles, describeRejections, MAX_FILE_BYTES, formatBytes } from './uploads';

const file = (name, type, size = 1024, lastModified = 1) => ({ name, type, size, lastModified });

test('a normal photo and a PDF are both accepted', () => {
  const { accepted, rejected } = validateFiles([
    file('scan.jpg', 'image/jpeg'),
    file('report.pdf', 'application/pdf'),
  ]);
  expect(accepted).toHaveLength(2);
  expect(rejected).toHaveLength(0);
});

test('a file the server would reject is stopped before it is uploaded', () => {
  const { accepted, rejected } = validateFiles([file('clip.mov', 'video/quicktime')]);
  expect(accepted).toHaveLength(0);
  expect(rejected[0].reason).toMatch(/can’t be read/);
});

test('an oversized file is rejected with its actual size', () => {
  const { rejected } = validateFiles([file('huge.jpg', 'image/jpeg', MAX_FILE_BYTES + 1)]);
  expect(rejected[0].reason).toMatch(/too large at 10\.0 MB/);
  expect(rejected[0].reason).toMatch(/limit is 10\.0 MB/);
});

test('a file exactly at the limit is allowed through', () => {
  const { accepted } = validateFiles([file('edge.jpg', 'image/jpeg', MAX_FILE_BYTES)]);
  expect(accepted).toHaveLength(1);
});

test('HEIC gets an explanation a phone user can act on', () => {
  const { rejected } = validateFiles([file('IMG_0042.HEIC', 'image/heic')]);
  expect(rejected[0].reason).toMatch(/iPhone HEIC/);
});

test('the same file added twice is only kept once', () => {
  const dup = file('scan.jpg', 'image/jpeg');
  const { accepted, rejected } = validateFiles([dup, { ...dup }]);
  expect(accepted).toHaveLength(1);
  expect(rejected[0].reason).toBe('already added');
});

test('a file already in the batch is not added again', () => {
  const existing = [file('scan.jpg', 'image/jpeg')];
  const { accepted, rejected } = validateFiles([file('scan.jpg', 'image/jpeg')], existing);
  expect(accepted).toHaveLength(0);
  expect(rejected[0].reason).toBe('already added');
});

test('files with the same name but different content are both kept', () => {
  const { accepted } = validateFiles([
    file('photo.jpg', 'image/jpeg', 1000, 1),
    file('photo.jpg', 'image/jpeg', 2000, 2),
  ]);
  expect(accepted).toHaveLength(2);
});

test('good files still go through when a bad one is in the same selection', () => {
  const { accepted, rejected } = validateFiles([
    file('good.png', 'image/png'),
    file('bad.tiff', 'image/tiff'),
  ]);
  expect(accepted.map(f => f.name)).toEqual(['good.png']);
  expect(rejected).toHaveLength(1);
});

test('the message names the file and what to do', () => {
  const { rejected } = validateFiles([file('x.tiff', 'image/tiff')]);
  expect(describeRejections(rejected)).toMatch(/^x\.tiff: /);
  expect(describeRejections([])).toBe('');
});

test('sizes read the way a person expects', () => {
  expect(formatBytes(512)).toBe('512 B');
  expect(formatBytes(2048)).toBe('2 KB');
  expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
});
