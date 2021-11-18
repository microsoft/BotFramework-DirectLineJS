const fetch = require('./fetch');
const auth = require('./auth');

var express = require('express');
var app = express();
var cors = require('cors');
var corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}
var server = app.listen(3000);

app.use(express.static('public'));

app.get('/token', cors(corsOptions), function (req, res, next) {
    auth.getToken(auth.tokenRequest)
        .then(token => {
            res.json({ token });
        })
        .catch(e => {
            console.log(e);
        })
});

app.get('/token/refresh', cors(corsOptions), function (req, res, next) {
    auth.getToken(auth.tokenRequest)
    .then(token => {
        res.json({ token });
    })
    .catch(e => {
        console.log(e);
    })
        
});