const dl = require('./node-example');

async function listen() {
  for (let promise of dl) {
    const result = await promise;
    console.log('got result', result);
  }
}

listen().then(done => console.log('done'));
const a = {
  'type': 'message',
  'text': 'hi',
  'from': {'id': '8pfJR7avDHc', 'name': 'You'},
  'locale': 'en',
  'textFormat': 'plain',
  'timestamp': new Date(),
  'channelData': {'clientActivityId': '1542231431860.0442380222941936.0'},
  'entities': [ {
    'type': 'ClientCapabilities',
    'requiresBotState': true,
    'supportsTts': true,
    'supportsListening': true
  } ]
};

dl.postActivity(a).then(id => console.log(id));