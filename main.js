const express = require("express");
const fs = require("fs-extra");
const Handlebars = require("handlebars");
const path = require("path");
const crypto = require("crypto");
const readdir = require("recursive-readdir");
const sharp = require("sharp");
const tempy = require('tempy');

const app = express();

const template = Handlebars.compile(fs.readFileSync(__dirname + "/template.html", "utf8"));

var games = [];
var staticURL = {};

async function init(){
	console.log("Loading static files");
	await loadStatic();
	
	console.log("Loading data files");
	await loadData();
	
	console.log("Listening");
	app.listen(process.env["M28N_SERVER_ID"] ? 80 : 8080);
}

async function loadStatic(){
	var dir = __dirname + "/static/";
	var files = await readdir(dir);
	await Promise.all(files.map(async function(filename){
		if(filename.indexOf(dir) != 0) throw new Error("Assert error");
		if(filename.split("/").pop()[0] == ".") return;
		
		var ext = path.extname(filename);
		var filepath = filename.slice(dir.length);
		var sha1 = await sha1File(filename);
		var baseURL = "/static/" + sha1;
		var urlFull = baseURL + ext;
		
		var staticObj = {
			src: urlFull,
			srcset: "",
		};
		
		staticURL[filepath] = staticObj;
		
		if(ext == ".png" || ext == ".jpg"){
			var sets = [
				{ suffix: "/1200px", width: 1200 },
				{ suffix: "/1000px", width: 1000 },
				{ suffix: "/710px", width: 710 },
				{ suffix: "/355px", width: 355, isDefault: true },
			];
			
			await Promise.all(sets.map(async function(set){
				var url = baseURL + set.suffix + ext;
				
				if(set.isDefault){
					staticObj.src = url;
				}
				
				if(staticObj.srcset != ""){
					staticObj.srcset += ", ";
				}
				
				staticObj.srcset += url + " " + set.width + "w";
				
				set.height = set.height || ((set.width * 3 / 4)|0);
				
				var tmpFilename = tempy.file({ extension: ext });
				
				var buf = await sharp(filename).resize(set.width, set.height).crop().toFile(tmpFilename);
				app.get(url, function(req, res){
					res.sendFile(tmpFilename);
				});
			}));
		}else{
			app.get(urlFull, function(req, res){
				res.sendFile(filename);
			});
		}
	}));
}

async function loadData(){
	var files = await readdir(__dirname + "/data/");
	
	await Promise.all(files.map(async function(filename){
		if(filename.split("/").pop()[0] == ".") return;
		
		var obj = await fs.readJson(filename);
		
		if(obj.disabled) return;
		
		if(obj.image){
			if(!staticURL.hasOwnProperty(obj.image)) throw new Error("Image not found: " + obj.image);
			obj.imageSrc = staticURL[obj.image].src;
			obj.imageSrcset = staticURL[obj.image].srcset;
		}
		
		games.push(obj);
	}));
}

app.get("/", simpleHandler(async function(req){
	shuffle(games);
	
	var cardClasses = [
		"card-outline-primary",
		"card-outline-success",
		"card-outline-warning",
		"card-outline-danger",
	];
	
	var btnClasses = [
		"btn-primary",
		"btn-success",
		"btn-warning",
		"btn-danger",
	];
	
	games.forEach(function(game, i){
		game.cardClass = cardClasses[i % cardClasses.length];
		game.btnClass = btnClasses[i % btnClasses.length];
	});
	
	return template({
		games: games,
	});
}));

async function sha1File(filename){
	var generator = crypto.createHash("sha1");
	// FIXME: use pipes instead, if some images don"t fit in memory
	generator.update(await fs.readFile(filename, "binary"));
	return generator.digest("hex");
}

function simpleHandler(fn){
	return function(req, res){
		var p = fn(req);
		
		p.then(function(reply){
			res.send(reply);
		}).catch(function(err){
			console.error(err);
			res.status(500).send("Internal error");
		});
	}
}

function shuffle(arr) {
	var i = arr.length;
	while(i != 0) {
		var j = Math.floor(Math.random() * i);
		--i;

		var tmp = arr[i];
		arr[i] = arr[j];
		arr[j] = tmp;
	}

	return arr;
}

init().catch(function(err){
	console.error(err);
	process.exit(1);
});
