export default function activityTimestampComparer({ timestamp: x }, { timestamp: y }) {
  return new Date(x).getTime() - new Date(y).getTime();
}
