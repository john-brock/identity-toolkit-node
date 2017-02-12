/**
 * Copyright 2014 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * An Express web app using Google Identity Toolkit service to login users.
 */

var express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require('fs');
var GitkitClient = require('gitkitclient');
var path = require("path");

app = module.exports = express();
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'))

var hostUrl = process.env.HOST_URL
var apiKey = process.env.API_KEY
var formUrl = process.env.FORM_URL
var mapUrl = process.env.MAP_URL
var allowedUsers = process.env.ALLOWED_USERS.split(',').map(function(user) {
  return user.trim();
});

var serverConfig = {
  "projectId": process.env.PROJECT_ID,
  "clientId": process.env.CLIENT_ID,
  "serviceAccountEmail": process.env.SERVICE_ACCOUNT_EMAIL,
  "serviceAccountPrivateKeyFile": createTempPrivateKeyFile(process.env.SERVICE_ACCOUNT_PRIVATE_KEY),
  "widgetUrl": hostUrl + "gitkit",
  "cookieName": "gtoken"
};
console.log(JSON.stringify(serverConfig));
var gitkitClient = new GitkitClient(serverConfig);

// index page
app.get('/', renderIndexPage);

// widget page hosting Gitkit javascript for login
app.get('/gitkit', renderGitkitWidgetPage);
app.post('/gitkit', renderGitkitWidgetPage);

function renderIndexPage(req, res) {
  if (req.cookies.gtoken) {
    gitkitClient.verifyGitkitToken(req.cookies.gtoken, function (err, resp) {
      if (err) {
        printLoginInfo(res, 'Invalid token: ' + JSON.stringify(err));
      } else {
        renderMapIfUserIsYaacMember(res, resp);
      }
    });
  } else {
    printLoginInfo(res, 'Please log in to continue.');
  }
}

function renderMapIfUserIsYaacMember(res, resp) {
  if (resp.email && allowedUsers.indexOf(resp.email) != -1 && resp.verified) {
    // YAAC Member is Logged In
    console.log('INFO: YAAC member logged in: ' + resp.email);
    printYaacMap(res);
  } else {
    console.log('WARNING: YAAC member not recognized: ' + resp.email);
    printLoginInfo(res, 'Oops. You are not a current YAAC Member. Please log in using your AggieNetwork Google Account.');    
  }
}

function printYaacMap(res) {
  var yaacMapHtml = new Buffer(fs.readFileSync('templates/yaacMapElement.html'))
      .toString()
      .replace('%%mapUrl%%', mapUrl)
      .replace('%%formUrl%%', formUrl);
  renderPage(res, yaacMapHtml);
}

function printLoginInfo(res, loginInfo) {
  var loginInfoHtml = new Buffer(fs.readFileSync('templates/loginInfoElement.html'))
      .toString()
      .replace('%%loginInfo%%', loginInfo);
  renderPage(res, loginInfoHtml);
}

function renderGitkitWidgetPage(req, res) {
  var loginWidgetHtml = new Buffer(fs.readFileSync('templates/gitkit-widget.html'))
      .toString()
      .replace('%%postBody%%', encodeURIComponent(req.body || ''))
      .replace('%%apiKey%%', apiKey)
      .replace(new RegExp('%%hostUrl%%', 'g'), hostUrl);
  renderPage(res, loginWidgetHtml);
}

function renderPage(res, bodyElement) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  var html = new Buffer(fs.readFileSync('./index.html'))
      .toString()
      .replace('%%bodyElement%%', bodyElement);
  res.end(html);
}

function createTempPrivateKeyFile(privateKey) {
  // need to create private key file because gitkit needs file not string
  var temp_dir = path.join(process.cwd(), 'temp/');
  if (!fs.existsSync(temp_dir)) {
    fs.mkdirSync(temp_dir);
  }
  var privateKeyFileLocation = temp_dir + 'key.pem'
  fs.writeFile(privateKeyFileLocation, privateKey, function(err) {
    if (err) throw err;
  });
  return privateKeyFileLocation;
}

var port = process.env.PORT || 8000;
app.listen(port);
console.log('YaaConnections-Web running at port:%d/', port);
