const {DirectLine} = require('../lib/node');

const directLine = new DirectLine({secret: process.env.DIRECT_LINE_SECRET});
module.exports = directLine;