var https = require('https');

const express = require('express')
const app = express()
var bodyParser = require('body-parser')

const { parse } = require('querystring');

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');
app.set('views', __dirname);
app.use(express.static('./assets'));
app.use(bodyParser.json())


const port = 3000
const PaytmChecksum = require('./PaytmChecksum');
const Config = require('./config');
var orderId = "Ord_" + Date.now();
var custId =  "Cust_No" + Date.now() + Math.floor(Math.random() * 100) + 1;
var amount;

app.post('/', (req, res) => {
    var paytmParams = {};
    amount = req.body.amount;
    paytmParams.body = {
        "requestType": "Payment",
        "mid": Config.MID,
        "websiteName": Config.WEBSITE,
        "orderId": orderId,
        "callbackUrl": "http://localhost:3000/callback",
        "txnAmount": {
            "value": amount,
            "currency": "INR",
        },
        "userInfo": {
            "custId": custId,
        },
    };

    PaytmChecksum.generateSignature(JSON.stringify(paytmParams.body), Config.MKEY).then(function (checksum) {
        paytmParams.head = {
            "signature": checksum
        };

        var post_data = JSON.stringify(paytmParams);

        var options = {

            /* for Staging */
            hostname: Config.ENV,
            port: 443,
            path: '/theia/api/v1/initiateTransaction?mid=' + Config.MID + '&orderId=' + orderId,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': post_data.length
            }
        };

        var response = "";
        var post_req = https.request(options, function (post_res) {
            post_res.on('data', function (chunk) {
                response += chunk;
            });

            post_res.on('end', function () {
                var obj = JSON.parse(response);
                var data = { env: Config.ENV, mid: Config.MID, amount: res.amount, orderid: orderId, txntoken: obj.body.txnToken }

                res.render(__dirname + '/index.html', { data: data });
            });
        });
        post_req.write(post_data);
        post_req.end();
    });
});
app.post('/callback', (req, res) => {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {

        var postbodyjson = parse(body);
        postbodyjson = JSON.parse(JSON.stringify(postbodyjson));

        var checksum = postbodyjson.CHECKSUMHASH;
        delete postbodyjson['CHECKSUMHASH'];

        var verifyChecksum = PaytmChecksum.verifySignature(postbodyjson, Config.MKEY, checksum);
        if (verifyChecksum) {
            res.render(__dirname + '/callback.html', { verifySignature: "true", data: postbodyjson });
        }
        else {
            res.render(__dirname + '/callback.html', { verifySignature: "false", data: postbodyjson });
        }

    });

})

app.get('/txnstatus', (req, res) => {
    var paytmParams = {};
    /* body parameters */
    paytmParams.body = {
        "mid": Config.MID,
        /* Enter your order id which needs to be check status for */
        "orderId": orderId,
    };
    PaytmChecksum.generateSignature(JSON.stringify(paytmParams.body), Config.MKEY).then(function (checksum) {
        /* head parameters */
        paytmParams.head = {
            "signature": checksum
        };
        /* prepare JSON string for request */
        var post_data = JSON.stringify(paytmParams);

        var options = {
            hostname: Config.ENV,
            port: 443,
            path: '/v3/order/status',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': post_data.length
            }
        };
        var response = "";
        var post_req = https.request(options, function (post_res) {
            post_res.on('data', function (chunk) {
                response += chunk;
            });

            post_res.on('end', function () {
                var obj = JSON.parse(response);
                res.render(__dirname + '/txnstatus.html', { data: obj.body, msg: obj.body.resultInfo.resultMsg });
            });
        });
        post_req.write(post_data);
        post_req.end();
    });

})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
});