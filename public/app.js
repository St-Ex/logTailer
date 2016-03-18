'use strict';
/*jshint multistr: true */
/*globals $:false */
/*globals io:false */
/*globals toastr:false */

var socket,
  lastLvl = 0,
  lastP = 0,
  lineCount = 0,
  regexPattern = null,
  lglvl = 2,
  logPattern = /(.*?)\s+(TRACE|DEBUG|INFO|WARN|ERROR)+\s+(.*)/,
  log4jComp = false,
  scrolling = true,
  line = false;

function safe_tags(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\t/, '&emsp;');
}

// Convert log4j log level to int
function convertLoglvl(log4jLvl) {
  var lvl = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];
  return lvl.indexOf(log4jLvl);
}

// Connect or reconnect socket
function connect() {
  if (socket) {
    socket.connect();
  } else {
    socket = io.connect(window.location.href);
  }
  // GUI modification
  $('#play').toggle(false);
  $('#stop').toggle(true);
  resumeScroll();
}

// Pause scrolling (but keep receiving data)
function pauseScroll() {
  scrolling = false;
  $('#pause').toggle(false);
  $('#resume').toggle(true);
}

// Un Pause scrolling (but keep receiving data)
function resumeScroll() {
  scrolling = true;
  $('#resume').toggle(false);
  $('#pause').toggle(true);
  window.scrollTo(0, document.body.scrollHeight);
}

// Wrap or unwrap line
function wrapLine(b) {
  line = b;
  if (line) {
    $('#tail').addClass('line');
  } else {
    $('#tail').removeClass('line');
  }
  $('#wrap').toggle(!line);
  $('#unwrap').toggle(line);
}

// Disconnect socket
function disconnect(message) {
  socket.disconnect();
  $('#play').toggle(true);
  $('#stop').toggle(false);
  resumeScroll();

  $('#tail').append('<p class="always"><i class="material-icons">stop</i> ' + (message ? message : 'Tail stopped.') + '</p>');
  window.scrollTo(0, document.body.scrollHeight);
}

// Changing log lvl and applying filter
function changeLogLevel(lvl) {
  $('#tail').removeClass('lv' + lglvl);
  lglvl = lvl;
  $('#tail').addClass('lv' + lglvl);
}

// Changing log lvl and applying filter
function logReg(newRegex) {
  regexPattern = (newRegex ? new RegExp(newRegex) : null);

  $.each($('#tail').find('p'), function(ind, value) {
    if (regexPattern && !regexPattern.test($(value).text())) {
      $(value).addClass('nomatch');
    } else {
      $(value).removeClass('nomatch');
    }
  });
  window.scrollTo(0, document.body.scrollHeight);
}

function initEnvs() {
  $.get(location.protocol + '//' + location.host + '/public/conf.json', function(data, status) {
    var envs = data.envs,
      n_env = 0;
    envs.forEach(function(env) {
      n_env++;
      $('#envChoice').append(
        '<li class="nav-item dropdown"><span class="nav-link dropdown-toggle" data-toggle="dropdown" href="#" role="button" aria-haspopup="true" aria-expanded="false">' + env.name + '</span><div id="env' + n_env + '" class="dropdown-menu"></div></li>');
      env.files.forEach(function(file) {
        $('#env' + n_env).append('<a class="dropdown-item" href="' + env.host + file.url + '">' + file.name + '</a>');
        if (window.location.href.endsWith(file.url)) {
          log4jComp = file.log4j;
        }
      });
    });
    $('#log4jCtrl').toggle(log4jComp);
  });
}

// -------------------------------------------------
// Init
$(function() {
  connect();

  socket.on('connect', function(message) {
    $('#tail').append('<p class="always"><i class="material-icons">swap_vert</i> Connected</p>');
    window.scrollTo(0, document.body.scrollHeight);
  });

  // Loading file name for navbar title
  socket.on('file', function(message) {
    $('#info').html('$ Tail -f : ' + message);
  });

  // Managing data
  socket.on('data', function(data) {
    lineCount++;
    data = safe_tags(data);
    var res = logPattern.exec(data);

    if (log4jComp) {
      // Log4j tag management
      if (res) {
        lastLvl = convertLoglvl(res[2]);
        var appendStr =
          '<p id="' + lineCount + '" class="loglv' + lastLvl + (line ? ' line' : '') + '"><span class="logDate">' + res[1] + '</span><span class="logLVL"> ' + res[2] + ' </span>' + res[3] + '</p>';
        $('#tail').append(appendStr);

        // Saving last linecount
        lastP = lineCount;
      } else {
        console.log($('#collapse' + lastP).length);
        if (!$('#collapse' + lastP).length) {
          $('#' + lastP).append('<br/><a class="btn btn-primary" data-toggle="collapse" href="#collapse' + lastP+'">See/Hide full stack</a><div id="collapse' + lastP + '" class="panel-collapse collapse" role="tabpanel"></div>');
        }
        $('#collapse' + lastP).append(data + '<br/>');
      }

    } else {
      // Simple text management
      lastP = lineCount;
      $('#tail').append('<p id="' + lastP + '" class="noLog' + (line ? ' line' : '') + '">' + data + '</p>');
    }

    if (scrolling) {
      window.scrollTo(0, document.body.scrollHeight);
    }
  });

  socket.on('toast', function(data) {
    toastr.options = {
      'closeButton': false,
      'debug': false,
      'newestOnTop': true,
      'progressBar': false,
      'positionClass': 'toast-bottom-right',
      'preventDuplicates': false,
      'onclick': null,
      'showDuration': '300',
      'hideDuration': '1000',
      'timeOut': '0',
      'extendedTimeOut': '1000',
      'showEasing': 'swing',
      'hideEasing': 'linear',
      'showMethod': 'fadeIn',
      'hideMethod': 'fadeOut'
    };
    toastr[data.level](data.message, data.title);
  });

  // Managing error comming from server
  socket.on('error', function(data) {
    disconnect(data);
    window.scrollTo(0, document.body.scrollHeight);
  });

  // Managing lost connection
  socket.on('connect_timeout', function(reason) {
    disconnect('Server is unreachable :' + reason);
  });
  socket.on('connect_error', function(reason) {
    disconnect('Connection lost :' + reason);
  });

  // Getting regex change from navbar buttons
  $('#logRegex').change(function() {
    logReg($('#logRegex').val());
  });

  // Download
  $('#download').attr('href', function() {
    return window.location.href + '/FULL';
  });

  wrapLine(line);
  changeLogLevel(lglvl);
  initEnvs();
});
