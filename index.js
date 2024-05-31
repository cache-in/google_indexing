
const path = require('path');
const fs = require('fs');
var request = require('request');
var { google } = require('googleapis');
// var keys = require('./service_account_1.json');
var keys = [];

//###############################################################################
//
// CONFIG
//
const URLS_PER_TIME = 200; // the number of URLs to send to the API for each accont
const FILE_PATH = 'urls.txt'; // the path to file which contains URL list
const FILE_PATH_SENT = 'urls_sent.txt'; // the path to file which contains already sent URL list
const FILE_PATH_LOG = 'log.txt'; // log file 
const FILE_PATH_KEY = 'keys'; // log file 

// //###############################################################################

const kyePath = path.join(__dirname, FILE_PATH_KEY);

if (!fs.existsSync(kyePath)) {
  const message = 'Unable to scan directory: ' + kyePath;
  console.log(message);
  fs.writeFileSync(message);
  return;
}

keyFiles = fs.readdirSync(kyePath);
if (keyFiles.length === 0) {
  const message = 'Unable to find any key files in: ' + kyePath;
  console.log(message);
  fs.writeFileSync(message);
  return;
}

//listing all files using forEach
keyFiles.forEach(function (file) {
  // Do whatever you want to do with the file
  keys.push(require(path.join(kyePath, file)));
});


// console.log(keys);

async function fetchData(key, cb) { 

  // read URLs file to string
  const batchStr = fs
    .readFileSync(FILE_PATH)
    .toString();

  // determine Line Break 
  let splitStr = '\n';
  if (batchStr.indexOf('\r\n') !== -1) {
    splitStr = '\r\n';
  }

  const jwtClient = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    ['https://www.googleapis.com/auth/indexing'],
    null
  );

  // break string into array splited by the Line Break Symbol
  const allUrls = batchStr.split(splitStr);

  // console.log(allUrls.length);

  let i = 0;
  let urlsToSend = [];

  while( allUrls.length !== 0 ){
    let url = allUrls.shift();
    if(url.trim() == '') continue;
    urlsToSend.push(url);
    if (++i === URLS_PER_TIME) break;
  }

  if(urlsToSend.length === 0) {
    const message = 'Seems URL file list is empty';
    console.log(message);
    fs.writeFileSync(message);
  }

  // console.log(urlsToSend);
  // console.log(urlsToSend.length);
  // return;

  jwtClient.authorize(function (err, tokens) {
    if (err) {
      console.log(err);
      return;
    }
    const items = urlsToSend.map(line => {
      return {
        'Content-Type': 'application/http',
        'Content-ID': '',
        body:
          'POST /v3/urlNotifications:publish HTTP/1.1\n' +
          'Content-Type: application/json\n\n' +
          JSON.stringify({
            url: line,
            type: 'URL_UPDATED'
          })
      };
    });

    const options = {
      url: 'https://indexing.googleapis.com/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/mixed'
      },
      auth: { bearer: tokens.access_token },
      multipart: items
    };

    request(options, (err, resp, body) => {
      // console.log(err);
      // console.log(body);
      if (err !== null || body.indexOf('error') !== -1) {
        if (err !== null) {
          fs.writeFileSync(FILE_PATH_LOG, err);
        }
        if (body.indexOf('error') !== -1) {
          fs.writeFileSync(FILE_PATH_LOG, body);
        }
        console.log("!!! error !!! See logs");
        return;
      }


      fs.writeFileSync(FILE_PATH, allUrls.join(splitStr));

      let batchSent = [];
      if (fs.existsSync(FILE_PATH_SENT)) {
        // read already sent URLs to array (sent list)
        batchSent = fs
          .readFileSync(FILE_PATH_SENT)
          .toString()
          .split(splitStr);
      }

      batchSent.push(...urlsToSend);
      // add last URLS_PER_TIME sent URLs to sent list

      // update already sent URLs list file
      fs.writeFileSync(FILE_PATH_SENT, batchSent.join(splitStr));

      console.log("!!! sucess !!! Sent " + urlsToSend.length + " urls");
      cb();
    });
  });  
}


const fetchDataPromisefied = (key) => {
  return new Promise(resolve => {
    fetchData(key, resolve);    
  });
}

async function exec() {
  // for (var ii = 0; ii < keys.length; ii++){
  for (const key of keys) {
    await fetchDataPromisefied(key);
    // console.log('key');
  }
}

exec();