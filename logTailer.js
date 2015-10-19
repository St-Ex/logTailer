var http = require('http'),
    Io = require('socket.io'),
    fs = require('fs'),
    Tail = require('tail').Tail,
    tails = [];

// -- Node.js Server ----------------------------------------------------------

server = http.createServer(function (req, res) {

    if (req.url.indexOf("public") > -1) {
        var filename = req.url.substr(req.url.lastIndexOf('/') + 1);
        fs.readFile(__dirname + '/public/' + filename, function (err, data) {
            if (err) {
                res.status(404).send('Not found');
            } else {
                res.writeHead(200, {
                    'Content-Type': "text/" + filename.substr(filename.lastIndexOf('.') + 1)
                });
                res.write(data, 'utf8');
                res.end();
            }
        });
    } else {
        res.writeHead(200, {
            'Content-Type': 'text/html'
        });
        fs.readFile(__dirname + '/public/index.html', function (err, data) {
            res.write(data, 'utf8');
            res.end();
        });
    }

});
server.listen(9020, '0.0.0.0');

// -- Setup Socket.IO ---------------------------------------------------------

var io = Io.listen(server);

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
        var envs = [];

        // Init all files
        envs = JSON.parse(data).envs;
        envs.forEach(function (env) {
            env.files.forEach(function (ref) {
                initTail(ref);
            });
        });
    });
}

loadConf();

console.log('Server running at http://0.0.0.0:9020/, connect with a browser to see tail output');
