var util = require("util"), 
	http = require("http"),
	 url = require("url"),
	  qs = require("querystring"),
	  fs = require("fs"),
Minotaur = require("minotaur"),
Supervisor = require("./supervisor"),
    PORT = 8080;

var httpServer = http.createServer(function(req, res) {  
    var path = url.parse(req.url).pathname,
		dirPath = "../client";
    switch(path) {
        case "/":
            fs.readFile(dirPath + "/index.html", function (err, data) {
                res.writeHead(200, {"Content-Type": "text/html"});
                res.write(data, "utf8");
	            res.end();
            });
            break;
		case "/styles.css":
		case "/jquery.jgrowl.css":
			fs.readFile(dirPath + path, function(err, data){
                res.writeHead(200, {"Content-Type": "text/css"});
            	res.write(data, "utf8");
            	res.end();
            });
			break;
		case "/bullet_green.png":
		case "/bullet_red.png":
		case "/bullet_yellow.png":
		case "/close.png":
		case "/send.png":
			fs.readFile(dirPath + "/images" + path, function(err, data){
                res.writeHead(200, {"Content-Type": "image/png"});
            	res.write(data, "binary");
            	res.end();
            });
			break;
		case "/minitaur.js":
		case "/jquery.typing-0.2.0.min.js":
        case "/jquery.jgrowl_minimized.js":
		case "/cint.js":
		case "/client.js":
            fs.readFile(dirPath + path, function(err, data){
                res.writeHead(200, {"Content-Type": "text/javascript"});
            	res.write(data, "utf8");
            	res.end();
            });
            break;
        default:

            break;
    }
});
httpServer.listen(PORT);
util.log("Listening on port " + PORT);

var supervisor = new Supervisor();

var minotaur = new Minotaur({
	server: httpServer,
	subdomainPool: [
		"rt01", "rt02", "rt03", "rt04", "rt05", "rt06", "rt07", "rt08", "rt09", 
		"rt10", "rt11", "rt12", "rt13", "rt14", "rt15", "rt16", "rt17", "rt18",
		"rt19", "rt20"
	]
});

minotaur.on("connect", function(session) {
	supervisor.attachUser(session.sid, session.sid);
	// get me the list of online users
	supervisor.forEachUser(function(user) {
		if(user.hash !== session.sid) {
			minotaur.send(
				session.sid, 
				{cmd: "in", id: user.hash, name: user.name}
			);
		}
	});
	// tell everyone that I'm online
    minotaur.broadcast(
		{cmd: "in", id: session.sid, name: session.sid}, 
		session.sid
	);
	
	session.on("client", function() {
		// get me the list of online users
		supervisor.forEachUser(function(user) {
			if(user.hash !== session.sid) {
				minotaur.send(
					session.sid, 
					{cmd: "in", id: user.hash, name: user.name}
				);
			}
		});
	});
	
    session.on("message", function(message) {
        if(message && message.cmd) {
			switch(message.cmd) {
				case "msg":
					if(message.dest && message.content) {
						// send message to receiver
						minotaur.send(
							message.dest,
							{cmd: "msg", source: session.sid, content: message.content}
						);
						// send message to sender
						minotaur.send(
							session.sid,
							{cmd: "msg", source: message.dest, me: true, content: message.content}
						);
					}
					break;
				case "keyStart":
					if(message.dest) {
						util.log("typing");
						minotaur.send(
							message.dest,
							{cmd: "keyStart", source: session.sid}
						);
					}
					break;
				case "keyStop":
					if(message.dest) {
						util.log("stopped typing");
						minotaur.send(
							message.dest,
							{cmd: "keyStop", source: session.sid}
						);
					}
					break;
				case "getName":
					minotaur.send(
						session.sid, 
						{
							cmd: "getName", 
							name: supervisor.getUser(session.sid).name
						}
					);
					break;
				case "setName":
					supervisor.getUser(session.sid).name = message.name;
					supervisor.forEachUser(function(user) {
						minotaur.broadcast(
							{
								cmd: "nameChange", 
								id: session.sid,
								name: message.name
							}, 
							session.sid
						);
					});
					break;
				default:
					break;
			}
        }
    });
    
    session.on("disconnect", function(message) {
		supervisor.detachUser(session.sid);
		// tell everyone that I'm offline
        minotaur.broadcast({cmd: "out", id: session.sid});
    });
});

minotaur.init();