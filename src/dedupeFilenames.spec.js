// @jest-environment node

import dedupeFilenames from './dedupeFilenames';

test('Deduping "abc.gif", "def.gif"', () => {
  const actual = dedupeFilenames(['abc.gif', 'def.gif']);

  expect(actual).toEqual(['abc.gif', 'def.gif']);
});

test('Deduping "abc.gif", "abc.gif"', () => {
  const actual = dedupeFilenames(['abc.gif', 'abc.gif']);

  expect(actual).toEqual(['abc.gif', 'abc (1).gif']);
});

test('Deduping "abc.def.gif", "abc.def.gif"', () => {
  const actual = dedupeFilenames(['abc.def.gif', 'abc.def.gif']);

  expect(actual).toEqual(['abc.def.gif', 'abc.def (1).gif']);
});

test('Deduping ".gitignore", ".gitignore"', () => {
  const actual = dedupeFilenames(['.gitignore', '.gitignore']);

  expect(actual).toEqual(['.gitignore', '(1).gitignore']);
});

test('Deduping "Dockerfile", "Dockerfile"', () => {
  const actual = dedupeFilenames(['Dockerfile', 'Dockerfile']);

  expect(actual).toEqual(['Dockerfile', 'Dockerfile (1)']);
});
