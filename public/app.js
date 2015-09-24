 var socket,
     lastLvl = 0,
     lastP = 0,
     lineCount = 0,
     regexPattern = null,
     lglvl = "0",
     logPattern = /(.*?)\s+(DEBUG|INFO|WARN|ERROR)+\s+(.*)/,
     log4jComp = false;

 function safe_tags(str) {
     return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\t/, "&emsp;");
 };

 // Convert log4j log level to int
 function convertLoglvl(log4jLvl) {
     var lvl = ["DEBUG", "INFO", "WARN", "ERROR"];
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
     $("#play").attr("disabled", "disabled");
     $("#play").addClass("active");
     $("#stop").removeAttr("disabled");
     $("#stop").removeClass("active");
 }

 // Disconnect socket
 function disconnect(message) {
     socket.disconnect();
     $("#stop").attr("disabled", "disabled");
     $("#stop").addClass("active");
     $("#play").removeAttr("disabled");
     $("#play").removeClass("active");

     $("#tail").append("<pre><span class=\"glyphicon glyphicon-stop\" aria-hidden=\"true\"> </span>" + (message ? message : "Tail stopped.") + "</pre>");
     window.scrollTo(0, document.body.scrollHeight);
 }

 // Changing log lvl and applying filter
 function loglvl(lvl) {
     lglvl = lvl;
     $.each($("#tail").find("p"), function (ind, value) {
         toggleIt(value);
     });
     window.scrollTo(0, document.body.scrollHeight);
 }

 // Changing log lvl and applying filter
 function logReg(newRegex) {
     regexPattern = (newRegex ? new RegExp(newRegex) : null);

     $.each($("#tail").find("p"), function (ind, value) {
         toggleIt(value);
     });
     window.scrollTo(0, document.body.scrollHeight);
 }

 // Apply change to paragraphe
 function toggleIt(elem) {
     var b = false;
     if (log4jComp) {
         switch (lglvl) {
             case "0":
                 b = b || $(elem).hasClass("loglv0");
             case "1":
                 b = b || $(elem).hasClass("loglv1");
             case "2":
                 b = b || $(elem).hasClass("loglv2");
             case "3":
                 b = b || $(elem).hasClass("loglv3");
         }
     } else {
         b = true;
     }
     if (b && regexPattern) {
         b = regexPattern.test($(elem).text());
     }
     $(elem).toggle(b);
 }

 function initEnvs() {
     $.get(location.protocol + "//" + location.host + "/public/conf.json", function (data, status) {
         var envs = data.envs,
             n_env = 0;
         envs.forEach(function (env) {
             n_env++;
             $("#envChoice").append("<li class=\"dropdown\"><a href=\"#\" class=\"dropdown-toggle\" data-toggle=\"dropdown\" role=\"button\" aria-haspopup=\"true\" aria-expanded=\"false\">" + env.name + "<span class=\"caret\"></span></a><ul id=env" + n_env + " class=\"dropdown-menu\"></ul></li>");
             env.files.forEach(function (file) {
                 $("#env" + n_env).append("<li><a href=\"" + env.host + file.url + "\">" + file.name + "</a></li>");

                 if (window.location.href.endsWith(file.url)) {
                     log4jComp = file.log4j;
                 }
             });
         });
         $("#log4jCtrl").toggle(log4jComp);
     });
 }


 // -------------------------------------------------
 // Init
 $(function () {
     connect();

     socket.on('connect', function (message) {
         $("#tail").append("<pre><span class=\"glyphicon glyphicon-play\" aria-hidden=\"true\"> </span>Connected</pre>");
         window.scrollTo(0, document.body.scrollHeight);
     });

     // Loading file name for navbar title
     socket.on('file', function (message) {
         $('#info').html('$ Tail -f : ' + message);
     });

     // Managing data
     socket.on('data', function (data) {
         lineCount++;
         data = safe_tags(data);
         var res = logPattern.exec(data);

         if (log4jComp) {
             // Log4j tag management
             if (res) {
                 lastLvl = convertLoglvl(res[2]);
                 var appendStr = "<p id=\"" + lineCount + "\" class=\"row loglv" + lastLvl + "\">" + " <span class=\"logDate\">" + res[1] + "</span> " + "<span class=\"logLVL\">" + res[2] + "</span> " + res[3] + "</p>"
                 $("#tail").append(appendStr);

                 // Saving last linecount
                 lastP = lineCount;
             } else {
                 $("#" + lastP).append(data + "<br/>");
             }

         } else {
             // Simple text management
             lastP = lineCount;
             $("#tail").append("<p id=\"" + lastP + "\" class=\"row noLog\">" + data + "</p>")
         }

         // Toggle line or not
         toggleIt($("#" + lastP));
         window.scrollTo(0, document.body.scrollHeight);
     });

     // Managing error comming from server
     socket.on('error', function (data) {
         disconnect(data);
         window.scrollTo(0, document.body.scrollHeight);
     });

     // Managing lost connection
     socket.on('connect_timeout', function (reason) {
         disconnect("Server is unreachable :" + reason);
     });
     socket.on('connect_error', function (reason) {
         disconnect("Connection lost :" + reason);
     });



     // Getting log lvl change from navbar buttons
     $(document).on('change', 'input:radio[id^="logLvlBut"]', function (event) {
         loglvl(event.currentTarget.id.slice(-1));
     });

     // Getting regex change from navbar buttons
     $("#logRegex").change(function () {
         logReg($("#logRegex").val());
     });

     initEnvs();
 });
