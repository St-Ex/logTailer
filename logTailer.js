'use strict';

/*globals __dirname:false */
/*globals require:false */

var http = require('http'),
  Io = require('socket.io'),
  fs = require('fs'),
  Tail = require('tail').Tail,
  tails = [],
  bodyParser = require('body-parser'),
  express = require('express'),
  app = express(),
  io;

// Conf loader
function loadConf(callbackPerFile) {
  fs.readFile(__dirname + '/public/conf.json', function(err, data) {
    JSON.parse(data).envs.forEach(function(env) {
      env.files.forEach(function(ref) {
        callbackPerFile(ref);
      });
    });
  });
}

// -- Server ----------------------------------------------------------
app.use(bodyParser.json());
app.post("/toast/all", function(req, res) {
  try {
    var toast = {
      title: req.body.title,
      message: req.body.message,
      level: (req.body.level ? req.body.level : 'info')
    };

    for (var url in tails) {
      io.of(url).emit('toast', toast);
    }

    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

loadConf(function(file) {
  var url = file.url + "/FULL";
  console.log("Adding full file route " + url);
  var options = {
    headers: {
      'x-timestamp': Date.now(),
      'x-sent': true,
      'content-disposition': 'attachment; filename="' + file.filePath.substring(file.filePath.lastIndexOf('/') + 1) + '"'
    }
  };
  app.get(url, function(req, res) {
    res.sendFile(file.filePath, options);
  });

  console.log("Adding tailer route " + file.url);
  app.get(file.url, function(req, res) {
    res.sendFile('./public/index.html', {
      root: __dirname
    });
  });
});

app.use('/public', express.static(__dirname + '/public'));
app.use('/lib', express.static(__dirname + '/node_modules'));

app.get('/', function(req, res) {
  res.sendFile('./public/index.html', {
    root: __dirname
  });
});

var server = app.listen(9020, function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Server running at http://%s:%s, connect with a browser to see tail output', host, port);
});

// -- Setup Socket.IO ---------------------------------------------------------

io = Io.listen(server);

function sent(url, type, data) {
  io.of(url).emit(type, data);
}

function openTail(file) {
  if (!tails[file.url]) {
    try {
      var begin = (file.fromBeginning ? true : false);
      console.log("Creating tail on " + file.filePath + " for socket " + file.url + " from beginning " + begin);
      var tail = new Tail(file.filePath, "\n", {
        persistent: true,
        recursive: false
      }, begin);

      tail.on("line", function(data) {
        sent(file.url, 'data', data);
      });

      tail.on("error", function(error) {
        console.error(error);
        sent(file.url, 'error', "##### Tailer message ####### File not accessible ######");
      });
      tails[file.url] = tail;
    } catch (e) {
      tails[file.url] = null;
      console.error(e);
      sent(file.url, 'error', "Cannot open file, try again later");
    }
  }
}

function closeTail(file) {
  if (tails[file.url]) {
    var nbConnected = io.of(file.url).connected;
    if (Object.keys(nbConnected).length === 0) {
      console.log("Last client disconnected, closing tail.");
      tails[file.url].unwatch();
      tails[file.url] = null;
    }
  }
}

// Init
loadConf(function(file) {
  console.log("Init of " + file.url + " on " + file.filePath);
  io.of(file.url).on('connection', function(client) {
    client.emit('file', file.filePath);
    openTail(file);

    client.on('disconnect', function(client) {
      closeTail(file);
    });
  });
});
