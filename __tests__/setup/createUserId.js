export default function createUserId() {
  return `dl_${ Math.random().toString(36).substr(2, 5) }`;
}
