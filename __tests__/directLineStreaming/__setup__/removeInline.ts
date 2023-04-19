export default function removeInline<T>(array: Array<T>, item: T): Array<T> {
  const index = array.indexOf(item);

  ~index && array.splice(index, 1);

  return array;
}
