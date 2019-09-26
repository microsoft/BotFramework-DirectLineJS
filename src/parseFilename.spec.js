// @jest-environment node

import parseFilename from './parseFilename';

test('Parsing "abc.gif"', () => {
  const actual = parseFilename('abc.gif');

  expect(actual).toHaveProperty('extname', '.gif');
  expect(actual).toHaveProperty('name', 'abc');
});

test('Parsing "abc.def.gif"', () => {
  const actual = parseFilename('abc.def.gif');

  expect(actual).toHaveProperty('extname', '.gif');
  expect(actual).toHaveProperty('name', 'abc.def');
});

test('Parsing ".gitignore"', () => {
  const actual = parseFilename('.gitignore');

  expect(actual).toHaveProperty('extname', '.gitignore');
  expect(actual).toHaveProperty('name', '');
});


test('Parsing "Dockerfile"', () => {
  const actual = parseFilename('Dockerfile');

  expect(actual).toHaveProperty('extname', '');
  expect(actual).toHaveProperty('name', 'Dockerfile');
});
