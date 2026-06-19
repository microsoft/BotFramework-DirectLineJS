export default async function fetchAsBase64(url) {
  const res = await fetch(url);

  if (res.ok) {
    const buffer = await res.buffer();

    return buffer.toString('base64');
  } else {
    throw new Error(`Server returned ${ res.status } while fetching as buffer`);
  }
}
