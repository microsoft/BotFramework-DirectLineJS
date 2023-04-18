(expect as any).activityContaining = (messageText: string, mergeActivity: { id?: string; type?: string } = {}) =>
  expect.objectContaining({
    id: expect.any(String),
    text: messageText,
    timestamp: expect.any(String),
    type: 'message',

    ...mergeActivity
  });
