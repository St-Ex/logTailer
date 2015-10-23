var http = require('http'),
    Io = require('socket.io'),
    fs = require('fs'),
    Tail = require('tail').Tail,
    tails = [],
    bodyParser = require('body-parser'),
    express = require('express'),
    app = express();

var io;

// -- Server ----------------------------------------------------------
app.use(bodyParser.json());
app.post("/toast/all", function (req, res) {
    try {
        var toast = {
            title: req.body.title,
            message: req.body.message,
            level: (req.body.level ? req.body.level : info)
        };

        for (var url in tails) {
            io.of(url).emit('toast', toast);
        };

        res.sendStatus(200);
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

console.log(__dirname);
app.use('/public', express.static(__dirname + '/public'));

app.use(function (req, res) {
    res.sendFile('./public/index.html', {
        root: __dirname
    });
});

var server = app.listen(9020, function () {
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
    if (tails[file.url] == null) {
        try {
            console.log("Creating tail on " + file.filePath + " for socket " + file.url);
            var tail = new Tail(file.filePath, "\n", {
                persistent: true,
                recursive: false
            }, false);

            tail.on("line", function (data) {
                sent(file.url, 'data', data);
            });

            tail.on("error", function (error) {
                console.error(error);
                sent(file.url, 'error', "##### Tailer message ####### File not accessible ######")
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
    if (tails[file.url] != null) {
        var nbConnected = io.of(file.url).connected;
        if (Object.keys(nbConnected).length === 0) {
            console.log("Last client disconnected, closing tail.");
            tails[file.url].unwatch();
            tails[file.url] = null;
        }
    }
}

// Initialize socket
function initTail(file) {
    console.log("Init of " + file.url + " on " + file.filePath);

    io.of(file.url).on('connection', function (client) {
        client.emit('file', file.filePath);
        openTail(file);

        client.on('disconnect', function (client) {
            closeTail(file);
        })
    });
}

// Loading config
function loadConf() {
    fs.readFile(__dirname + '/public/conf.json', function (err, data) {
        JSON.parse(data).envs.forEach(function (env) {
            env.files.forEach(function (ref) {
                initTail(ref);
            });
        });
    });
}

loadConf();
