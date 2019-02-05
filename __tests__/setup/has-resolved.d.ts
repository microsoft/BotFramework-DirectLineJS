declare module 'has-resolved' {
  const hasResolved: (promise: Promise<{}> | Promise<{}>[]) => Promise<boolean>;

  export default hasResolved;
}
