export default function getEchoActivity(activity) {
  const {
    channelData: {
      originalActivity
    } = {}
  } = activity;

  return originalActivity;
}
