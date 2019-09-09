export default function createUserId() {
  return `u-${ Math.random().toString(36).substr(2, 5) }`;
}
