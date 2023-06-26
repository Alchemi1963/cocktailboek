const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const path = require("path");
const cookieParser = require("cookie-parser");
const https = require("https");
const multer = require("multer");
const XLSX = require("data-validation-xlsx");
const {readFileSync} = require("fs");

//laad cocktails
const {alcoholDB, nonAlcoholDB, removeDrink, editDrink, addDrink} = require("./script/drank");
const {Cocktail, removeCocktail, refreshDatabase, cocktailDB} = require("./script/cocktails");

const debug = process.argv.includes("debug");

const client_secret = debug ? "DEBUGCLIENTSECRET" : readFileSync("./client_secret", "utf-8").trimEnd();

const prismPOST = {
	hostname: "login.i.bolkhuis.nl",
	path: "/token",
	method: "POST",
	headers: {
		"Content-Type": "application/json"
	}
};

const app = express();

//laad form function
function parseForm(data) {
	let alcohol = {};
	let nonAlcohol = {};

	console.log(data);

	let extras = [];

	if (data.selectAlcohol !== undefined && typeof data.selectAlcohol != "string") {
		for (let item in data.selectAlcohol) {
			item = data.selectAlcohol[item];
			item = item.replaceAll(" ", "_");
			if (data["selectType" + item] === "aanvullen") {
				alcohol[item.toLowerCase()] = ["1.0", "aanvullen"];
			} else {
				alcohol[item.toLowerCase()] = [data["selectN" + item], data["selectType" + item]];
			}
		}
	} else if (data.selectAlcohol !== undefined) {
		let item = data.selectAlcohol.replaceAll(" ", "_");
		if (data["selectType" + item] === "aanvullen") {
			alcohol[item.toLowerCase()] = ["1.0", "aanvullen"];
		} else {
			alcohol[item.toLowerCase()] = [data["selectN" + item], data["selectType" + item]];
		}
	}

	if (data.selectNonAlcohol !== undefined && typeof data.selectNonAlcohol != "string") {
		for (let item in data.selectNonAlcohol) {
			item = data.selectNonAlcohol[item];
			item = item.replaceAll(" ", "_");
			if (data["selectType" + item] === "aanvullen") {
				nonAlcohol[item.toLowerCase()] = ["1.0", "aanvullen"];
			} else {
				nonAlcohol[item.toLowerCase()] = [data["selectN" + item], data["selectType" + item]];
			}
		}
	} else if (data.selectNonAlcohol !== undefined) {
		let item = data.selectNonAlcohol.replaceAll(" ", "_");
		if (data["selectType" + item] === "aanvullen") {
			nonAlcohol[item.toLowerCase()] = ["1.0", "aanvullen"];
		} else {
			nonAlcohol[item.toLowerCase()] = [data["selectN" + item], data["selectType" + item]];
		}
	}

	if (data.creator === "") {
		data.creator = null;
	}
	if (data.desc === "") {
		data.desc = null;
	}

	let i = 0
	while (data.hasOwnProperty("extraName" + i.toString())) {
		let name = data["extraName" + i.toString()];
		let price = data["extraPrice" + i.toString()];
		if (name !== "" && price !== "") extras.push([name, price]);
		i++;
	}
	if (extras.length == 0) {
		extras = null;
	}
	let result = Cocktail.create(data.name, data.selectGlass, alcohol, nonAlcohol, data.creator, data.desc, extras);
	console.log("Result: " + result);
	return result;
}

//start server
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(cookieParser());
app.use(session({
	secret: client_secret,
	resave: false,
	saveUninitialized: true
}));
app.use(helmet());

const upload = multer({dest: "upload/"});
const xlsxCols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "L"];

//refreshDatabase();
// databaseWriter("alcohol");
// databaseWriter("nonAlcohol");

function checkCreateSession(req) {
	if (req.session.stateID === undefined) {
		console.log("Creating session state");
		req.session.stateID = Math.floor(Math.random() * 999999).toString();
	}
}

function checkLogin(req) {
	if (debug) {
		return true;
	}
	return req.cookies["bolk-oath-access-token"] !== undefined;
}

function checkPerm(req) {
	if (debug) {
		return true;
	}
	return req.cookies["bolk-oath-permission"] !== undefined;
}

function clearCells(sheet, start, end) {
	const range = XLSX.utils.decode_range(start + ":" + end);
	for (let row = range.s.r; row <= range.e.r; row ++) {
		for (let col = range.s.c; col <= range.e.c; col++){
			const cellAddress = XLSX.utils.encode_cell({r: row, c: col});
			sheet[cellAddress] = undefined;
		}
	}
	return sheet;
}

app.get('/', (req, res) => {
	checkCreateSession(req);
	if (checkLogin(req)) checkPerm(req);
	if (debug){
		res.setHeader('Content-Security-Policy', "default-src 'self' http:; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com;");
		res.cookie("bolk-oath-permission", "true");
		res.cookie("bolk-oath-access-token", "true");
	}
	res.sendFile(path.join(__dirname, '/html/index.html'));
});

app.get('/new', (req, res) => {
	checkCreateSession(req);
	if (debug){
		res.setHeader('Content-Security-Policy', "default-src 'self' http:; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com;");
	}
	if (checkLogin(req)) {
		checkPerm(req);
		res.sendFile(path.join(__dirname, '/html/new.html'));
	} else {
		res.redirect("/")
	}
});

app.post("/new", (req, res) => {

	if (checkLogin(req)) {
		checkPerm(req);
		const data = req.body;
		if (!parseForm(data)) {
			res.sendFile(path.join(__dirname, "/html/error400.html"));
		} else res.redirect("/");
	}

});

app.get("/login", (req, res) => {
	checkCreateSession(req);

	if (debug){
		res.redirect("/");
		return;
	}

	if (req.query.code === undefined && req.query.error === undefined) {
		console.log("Redirecting to https://auth.debolk.nl/authenticate?response_type=code&client_id=cocktailboek&redirect_uri=https://cocktails.debolk.nl/login&state=" + req.session.stateID)
		res.redirect("https://auth.debolk.nl/authenticate?response_type=code&client_id=cocktailboek&redirect_uri=https://cocktails.debolk.nl/login&state=" + req.session.stateID);
	} else {
		if (req.query.state.toString() !== req.session.stateID && req.query.error !== undefined) {
			res.status(400);
			res.redirect("/");
		} else {
			console.log("Query: " + req.query.code + "|" + req.query.state);

			let post = https.request(prismPOST, (postRES) => {
				const data = [];
				postRES.on("data", d => data.push(d));
				postRES.on("end", () => {
					let jsonResponse = JSON.parse(Buffer.concat(data));
					console.log(jsonResponse);

					let token = jsonResponse.access_token;

					get = https.request({
						hostname: "login.i.bolkhuis.nl",
						path: "/resource/?access_token=" + token,
						method: "GET"
					}, (getRes) => {
						const data = [];
						getRes.on("data", d => data.push(d));
						getRes.on("end", () => {
							let jsonData = JSON.parse(Buffer.concat(data));

							if (token === jsonData.access_token && token !== undefined) {
								res.cookie("bolk-oath-access-token", token);
								req.session.user = jsonData.user_id;
								console.log("Logged in " + jsonData.user_id + " with access token " + token);
								// console.log(jsonData.access_token);
								getPerm = https.request({
									hostname: "login.i.bolkhuis.nl",
									path: "/ictcom/?access_token=" + token,
									method: "GET"
								}, (getRes) => {
									if (getRes.statusCode === 200) {
										res.cookie("bolk-oath-permission", "true");
										console.log("Admin permissions verified.")
									}
									res.redirect("/");
								});
								getPerm.end();
								console.log("Attempting to retrieve admin permissions...")
								console.log("https://" + getPerm.host + getPerm.path);
							} else {
								res.status(403);
								res.redirect("/");
							}
						});
					});
					get.end();
				});
			});
			post.on("error", (err) => {
				console.log(err);
			});
			post.write(JSON.stringify({
				grant_type: "authorization_code",
				redirect_uri: "https://cocktails.debolk.nl/login",
				code: req.query.code,
				client_id: "cocktailboek",
				client_secret: client_secret
			}));
			post.end();
			console.log("Attempting to retrieve access token...");

		}
	}
});
app.get("/logout", (req, res) => {
	console.log("Logged out " + req.session.user);
	if (debug){
		res.setHeader('Content-Security-Policy', "default-src 'self' http:; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com;");
	}
	res.clearCookie("bolk-oath-access-token");
	res.clearCookie("bolk-oath-permission");
	res.redirect("/");
});

app.get("/admin/cocktails", (req, res) => {
	checkCreateSession(req);
	if (debug){
		res.setHeader('Content-Security-Policy', "default-src 'self' http:; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com;");
	}
	if (checkLogin(req) && checkPerm(req)) {
		res.sendFile(path.join(__dirname, '/html/admin/cocktails.html'));
	} else {
		res.redirect("/login")
	}
});

app.put("/admin/cocktails", (req, res) => {
	checkCreateSession(req);
	if (checkLogin(req) && checkPerm(req)) {
		if (req.query.remove) {
			removeCocktail(req.query.remove);
		}
		res.sendStatus(200);
	}

});

app.get("/admin/cocktails/edit", (req, res) => {
	checkCreateSession(req);
	if (debug){
		res.setHeader('Content-Security-Policy', "default-src 'self' http:; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com;");
	}
	if (checkLogin(req) && checkPerm(req)) {
		res.sendFile(path.join(__dirname, '/html/admin/editCocktail.html'));
	} else {
		res.redirect("/login")
	}
});

app.post("/admin/cocktails/edit", (req, res) => {
	checkCreateSession(req);
	if (checkLogin(req) && checkPerm(req)) {

		const data = req.body;
		removeCocktail(data.cocktail);

		parseForm(data);
		res.redirect("/admin/cocktails?scroll=" + data.scroll);
	} else {
		res.redirect("/login")
	}
});

app.get("/admin/alcohol", (req, res) => {
	checkCreateSession(req);
	if (debug){
		res.setHeader('Content-Security-Policy', "default-src 'self' http:; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com;");
	}
	if (checkLogin(req) && checkPerm(req)) {
		res.sendFile(path.join(__dirname, '/html/admin/alcohol.html'));
	} else {
		res.redirect("/login")
	}
});

app.put("/admin/alcohol", (req, res) => {
	checkCreateSession(req);
	if (checkLogin(req) && checkPerm(req)) {
		if (req.query.remove) {
			removeDrink(req.query.remove);
		} else if (req.query.edit) {
			editDrink(req.body);
		} else if (req.query.add) {
			addDrink(req.body);
		}
		res.sendStatus(200);
	} else {
		res.redirect("/login")
	}

});

app.get("/admin/nonalcohol", (req, res) => {
	checkCreateSession(req);
	if (debug){
		res.setHeader('Content-Security-Policy', "default-src 'self' http:; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com;");
	}
	if (checkLogin(req) && checkPerm(req)) {
		res.sendFile(path.join(__dirname, '/html/admin/nonalcohol.html'));
	} else {
		res.redirect("/login")
	}
});

app.put("/admin/nonalcohol", (req, res) => {
	checkCreateSession(req);
	if (checkLogin(req) && checkPerm(req)) {
		if (req.query.remove) {
			removeDrink(req.query.remove);
		} else if (req.query.edit) {
			editDrink(req.body);
		} else if (req.query.add) {
			addDrink(req.body);
		}
		res.sendStatus(200);
	} else {
		res.redirect("/login")
	}

});

app.get("/admin/download", (req, res) => {
	const filepath = path.join(__dirname, "/public/assets/template.xlsx");
	//prepare workbook
	const workbook = XLSX.readFile(filepath);
	const alcoholSheet = workbook.Sheets["alcohol"];
	const nonAlcoholSheet = workbook.Sheets["nonAlcohol"];
	const cocktailSheet = workbook.Sheets["cocktails"];

	console.log(cocktailSheet);

	clearCells(alcoholSheet, "A2", "E102");
	clearCells(nonAlcoholSheet, "A2", "D102");

	alcoholSheet["!ref"] = "A1:E" + (Object.values(alcoholDB).length + 1).toString();
	nonAlcoholSheet["!ref"] = "A1:E" + (Object.values(nonAlcoholDB).length + 1).toString();

	let i = 2;
	for (let key in alcoholDB) {
		let alc = alcoholDB[key];

		alcoholSheet["A" + i.toString()] = {t: "s", v: key};
		alcoholSheet["B" + i.toString()] = {t: "s", v: alc.name};
		alcoholSheet["C" + i.toString()] = {t: "n", v: alc.alcPer};
		alcoholSheet["D" + i.toString()] = {t: "n", v: alc.price};
		alcoholSheet["E" + i.toString()] = {t: "n", v: alc.vol};

		i ++;
	}

	i = 2;
	for (let key in nonAlcoholDB) {
		let nonAlc = nonAlcoholDB[key];
		nonAlcoholSheet["A" + i.toString()] = {t: "s", v: key};
		nonAlcoholSheet["B" + i.toString()] = {t: "s", v: nonAlc.name};
		nonAlcoholSheet["C" + i.toString()] = {t: "n", v: nonAlc.price};
		nonAlcoholSheet["D" + i.toString()] = {t: "n", v: nonAlc.vol};

		i ++;
	}

	cocktailSheet["!ref"] = "A1:L6401";

	for (let i = 2; i <= 6401; i++){
		cocktailSheet["B" + i.toString()] = { t: "s", v: ""};
		cocktailSheet["C" + i.toString()] = { t: "s", v: ""};
		cocktailSheet["D" + i.toString()] = { t: "n", v: ""};
		cocktailSheet["E" + i.toString()] = { t: "s", v: ""};
		cocktailSheet["F" + i.toString()] = { t: "s", v: ""};
		cocktailSheet["G" + i.toString()] = { t: "n", v: ""};
		cocktailSheet["H" + i.toString()] = { t: "s", v: ""};
		cocktailSheet["J" + i.toString()] = { t: "n", v: ""};
		cocktailSheet["B" + i.toString()].dataValidation = {type: "list", formula1: '"longdrink,tumbler,papa,pul,pitcher,shot"'};
		cocktailSheet["C" + i.toString()].dataValidation = {type: "list", formula1: '"' + Object.keys(alcoholDB).join(",") + '"'};
		cocktailSheet["D" + i.toString()].dataValidation = {type: "decimal", operator: "greaterThan", formula1: 0.0};
		cocktailSheet["E" + i.toString()].dataValidation = {type: "list", formula1: '"shot,fles,scheutje,aanvullen"'};
		cocktailSheet["F" + i.toString()].dataValidation = {type: "list", formula1: '"' + Object.keys(nonAlcoholDB).join(",") + '"'};
		cocktailSheet["G" + i.toString()].dataValidation = {type: "decimal", operator: "greaterThan", formula1: 0.0};
		cocktailSheet["H" + i.toString()].dataValidation = {type: "list", formula1: '"shot,fles,scheutje,aanvullen"'};
		cocktailSheet["J" + i.toString()].dataValidation = {type: "decimal", operator: "greaterThanOrEqual", formula1: 0.0};
		if (i === 3) console.log(cocktailSheet);
	}


	XLSX.writeFileXLSX(workbook, path.join(__dirname, "/public/assets/template.xlsx"));

	res.setHeader("Content-Disposition", "attachment; filename=bulk_import.xlsx");
	res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
	res.sendFile(filepath);
});

app.post("/admin/upload", upload.single("file"), (req, res) => {
	const filepath = req.file.path;
	const workbook = XLSX.readFile(filepath);
	const sheet = workbook.Sheets["cocktails"];

	let addDB = [];
	let row = 2;
	let index = -1;
	let fails = [];

	while (true) {
		let emptyCount = 0;
		for (let letter in xlsxCols) {
			letter = xlsxCols[letter];
			let cell = sheet[letter + row.toString()]
			if (cell !== undefined) {
				let v = cell.v;
				if (letter === "A") {
					addDB.push({name: v});
					index ++;
				} else if (letter === "B") addDB[index]["glass"] = v;
				else if (letter === "C") {
					if (addDB[index]["alcohol"] === undefined){
						addDB[index]["alcohol"] = {};
					}
					addDB[index]["alcohol"][v] = [];
				}
				else if (letter === "D") addDB[index]["alcohol"][sheet["C" + row.toString()].v].push(v);
				else if (letter === "E") addDB[index]["alcohol"][sheet["C" + row.toString()].v].push(v);
				else if (letter === "F") {
					if (addDB[index]["nonAlcohol"] === undefined){
						addDB[index]["nonAlcohol"] = {};
					}
					addDB[index]["nonAlcohol"][v] = [];
				}
				else if (letter === "G") addDB[index]["nonAlcohol"][sheet["F" + row.toString()].v].push(v);
				else if (letter === "H") addDB[index]["nonAlcohol"][sheet["F" + row.toString()].v].push(v);
				else if (letter === "I") {
					if (addDB[index]["extras"] === undefined) {
						addDB[index]["extras"] = [];
					}
					addDB[index]["extras"].push([v]);
				}
				else if (letter === "J") addDB[index]["extras"][addDB[index]["extras"].length - 1].push(v);
				else if (letter === "K") addDB[index]["creator"] = v;
				else if (letter === "L") addDB[index]["desc"] = v;
			}
			else emptyCount ++;
		}
		if (emptyCount == 11) break; // stop when an entire row is empty
		row ++;
	}
	for (let cock in addDB){
		if (cock["alcohol"] === undefined) cock["alcohol"] = null;
		if (cock["nonAlcohol"] === undefined) cock["nonAlcohol"] = null;
		if (cock["extras"] === undefined) cock["extras"] = null;
		if (cock["creator"] === undefined) cock["creator"] = null;
		if (cock["desc"] === undefined) cock["desc"] = null;
		cock = addDB[cock];
		if (Cocktail.create(cock.name, cock.glass, cock.alcohol, cock.nonAlcohol, cock.creator, cock.desc, cock.extras)) {
			console.log("Succesfully created " + cock.name);
		} else {
			console.log("Failed creating " + cock.name);
			fails.push(cock.name);
		}
	}
	res.sendStatus(200);
});

app.listen(3000)
