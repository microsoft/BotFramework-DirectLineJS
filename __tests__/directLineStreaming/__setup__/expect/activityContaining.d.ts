import '@jest/types';

declare global {
  namespace jest {
    interface Expect {
      activityContaining(messageText: string, mergeActivity?: { id?: string; type?: string }): any;
    }
  }
}
