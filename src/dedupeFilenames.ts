import parseFilename from './parseFilename';

export default function dedupeFilenames(array: string[]) {
    const nextArray: string[] = [];

    array.forEach(value => {
        const { extname, name } = parseFilename(value);
        let count = 0;
        let nextValue = value;

        while (nextArray.includes(nextValue)) {
            nextValue = [name, `(${ (++count) })`].filter(segment => segment).join(' ') + extname;
        }

        nextArray.push(nextValue);
    });

    return nextArray;
}
