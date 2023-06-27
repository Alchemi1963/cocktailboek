const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const path = require("path");
const cookieParser = require("cookie-parser");
const https = require("https");
const multer = require("multer");
const XLSX = require("xlsx-populate");
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
const upload = multer({dest: "upload/"});
const xlsxCols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

if (process.argv.includes("refresh")){
	refreshDatabase();
}

//start server
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, "html", "views"));
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

//laad form function
function parseForm(data) {
	let alcohol = {};
	let nonAlcohol = {};

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
	if (extras.length === 0) {
		extras = null;
	}
	let result = Cocktail.create(data.name, data.selectGlass, alcohol, nonAlcohol, data.creator, data.desc, extras);
	console.log("Result: " + result);
	return result;
}

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

function setDebug(res){
	if (debug){
		res.setHeader('Content-Security-Policy', "default-src 'self' http:; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com;");
		res.cookie("bolk-oath-permission", "true");
		res.cookie("bolk-oath-access-token", "true");
	}
}

function genScripts(...scripts) {
	let s = "";
	for (let script of scripts){
		script = script.endsWith(".js") ? script : script + ".js";
		s += "<script src='/script/" + script + "'></script>\n";
	}
	return s;
}

app.get('/', (req, res) => {
	checkCreateSession(req);
	setDebug(res);
	if (checkLogin(req)) checkPerm(req);

	res.render("index", {scripts: genScripts("getDrank", "functions", "getCocktails", "loginButtons", "enableButtons"),
	extraStyle: "<link href=\"/styles/style.css\" rel=\"stylesheet\" type=\"text/css\">",
	location: "/"});
});

app.get('/new', (req, res) => {
	checkCreateSession(req);
	setDebug(res);
	if (checkLogin(req)) {
		checkPerm(req);

		res.render("editor", { scripts: genScripts("getDrank", "editorFunctions", "functions", "enableButtons", "loginButtons"),
			location: "/new"});
	} else {
		res.render("error", {location: "/", errorcode: "401 Unauthorized", message: "Je bent niet ingelogd.<br>Als deze fout zich blijft voordoen, neem contact op met beheer."});
	}
});

app.post("/new", (req, res) => {

	if (checkLogin(req)) {
		checkPerm(req);
		const data = req.body;
		if (!parseForm(data)) {
			res.render("error", {
				location: "/new",
				errorcode: "336 + 64 = 400 Bad Request",
				message: "De cocktail die je wilde toevoegen bestaat al, of er is eentje met dezelfde naam."
			});
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
	setDebug(res);
	if (checkLogin(req) && checkPerm(req)) {
		res.render("index", {scripts: genScripts("getDrank", "functions", "getCocktails", "adminFunctions", "enableButtons", "loginButtons"),
			extraStyle: "<link href=\"/styles/style.css\" rel=\"stylesheet\" type=\"text/css\">",
			location: "/admin/cocktails"});
	} else {
		res.render("error", {location: "/admin/cocktails", errorcode: "401 Unauthorized", message: "Je bent niet geauthoriseerd voor deze pagina.<br>Als je denkt dat dit een fout is, neem contact op met beheer."});
	}
});

app.put("/admin/cocktails", (req, res) => {
	checkCreateSession(req);
	if (checkLogin(req) && checkPerm(req)) {
		if (req.query.remove) {
			removeCocktail(req.query.remove);
		}
		res.redirect("/admin/cocktails");
	} else {
		res.render("error", {
			location: "/admin/cocktails",
			errorcode: "401 Unauthorized",
			message: "Je bent niet geauthoriseerd om dit te doen.<br>Als je denkt dat dit een fout is, neem contact op met beheer."
		});
	}
});

app.get("/admin/cocktails/edit", (req, res) => {
	checkCreateSession(req);
	setDebug(res);
	if (checkLogin(req) && checkPerm(req)) {
		res.render("editor", { scripts: genScripts("getDrank", "functions", "getCocktails", "editorFunctions", "enableButtons", "adminFunctions", "loginButtons"),
			location: "/admin/cocktails/edit"});
	} else {
		res.render("error", {location: "/admin/cocktails/edit", errorcode: "401 Unauthorized", message: "Je bent niet geauthoriseerd voor deze pagina.<br>Als je denkt dat dit een fout is, neem contact op met beheer."});
	}
});

app.post("/admin/cocktails/edit", (req, res) => {
	checkCreateSession(req);
	if (checkLogin(req) && checkPerm(req)) {

		const old = { ...cocktailDB[data.cocktail] };
		const data = req.body;
		removeCocktail(data.cocktail);
		if (!parseForm(data)){
			console.log(data);
			res.render("error", {location: "/admin/cocktails/edit", errorcode: "336 + 64 = 400 Bad Request", message: "De cocktail kon niet aangepast worden. Check de logs voor details."});
			Cocktail.create(old.name, old.glass, old.alcohol, old.nonAlcohol, old.creator, old.desc, old.extras);
			return;
		}
		res.redirect("/admin/cocktails?scroll=" + data.scroll);
	} else {
		res.render("error", {location: "/admin/cocktails/edit", errorcode: "401 Unauthorized", message: "Je bent niet geauthoriseerd om dit te doen.<br>Als je denkt dat dit een fout is, neem contact op met beheer."});
	}
});

app.get("/admin/alcohols", (req, res) => {
	checkCreateSession(req);
	setDebug(res);
	if (checkLogin(req) && checkPerm(req)) {
		res.render("index", { scripts: genScripts("functions", "adminFunctions", "alcoholAdminInit", "enableButtons", "loginButtons"),
			extraStyle: "<link href=\"/styles/drinkAdmin.css\" rel=\"stylesheet\" type=\"text/css\">",
			location: "/admin/alcohols"});
	} else {
		res.render("error", {location: "/admin/alcohols", errorcode: "401 Unauthorized", message: "Je bent niet geauthoriseerd voor deze pagina.<br>Als je denkt dat dit een fout is, neem contact op met beheer."});
	}
});

app.put("/admin/alcohols", (req, res) => {
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
		res.render("error", {location: "/admin/alcohols", errorcode: "401 Unauthorized", message: "Je bent niet geauthoriseerd om dit te doen.<br>Als je denkt dat dit een fout is, neem contact op met beheer."});
	}

});

app.get("/admin/nonalcohols", (req, res) => {
	checkCreateSession(req);
	setDebug(res);
	if (checkLogin(req) && checkPerm(req)) {
		res.render("index", { scripts: genScripts("functions", "adminFunctions", "nonAlcoholAdminInit", "enableButtons", "loginButtons"),
			extraStyle: "<link href=\"/styles/drinkAdmin.css\" rel=\"stylesheet\" type=\"text/css\">",
			location: "/admin/nonalcohols"});
	} else {
		res.render("error", {location: "/admin/nonalcohols", errorcode: "401 Unauthorized", message: "Je bent niet geauthoriseerd voor deze pagina.<br>Als je denkt dat dit een fout is, neem contact op met beheer."});
	}
});

app.put("/admin/nonalcohols", (req, res) => {
	checkCreateSession(req);
	setDebug(res);
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
		res.render("error", {location: "/admin/nonalcohols", errorcode: "401 Unauthorized", message: "Je bent niet geauthoriseerd om dit te doen.<br>Als je denkt dat dit een fout is, neem contact op met beheer."});
	}

});

app.get("/admin/download", (req, res) => {
	checkCreateSession(req);
	setDebug(res);
	if (!checkLogin(req) || !checkPerm(req)) {
		res.render("error", {location: "/admin/download", errorcode: "401 Unauthorized", message: "Je bent niet geauthoriseerd om dit te doen.<br>Als je denkt dat dit een fout is, neem contact op met beheer."});
		return;
	}

	XLSX.fromBlankAsync()
		.then(workbook => {
			//prepare workbook
			const sheet = workbook.addSheet("cocktails");
			workbook.sheet(0).delete();
			const headers = ["name", "glass", "alcohol", "amount", "type", "nonAlcohol", "amount", "type", "extrasName", "extrasPrice", "creator", "desc"];

			//set column headers
			let row = sheet.row(1);
			let index = 1;
			for (let header in headers){
				header = headers[header];
				row.cell(index).value(header);
				index ++;
			}

			//number datavalidation
			for (let r of ["D2:D640001", "G2:G640001", "J2:J640001"]){
				sheet.range(r).dataValidation({
					type: "decimal",
					allowBlank: true,
					operator: "greaterThanOrEqual",
					formula1: 0.0,
					error: "Needs to be a decimal of at least 0",
					errorTitle: "Wrong",
					showErrorMessage: true
				});
			}

			// glass validation
			sheet.range("B2:B640001").dataValidation({
				type: "list",
				allowBlank: true,
				showDropDown: true,
				formula1: '"longdrink,pul,pitcher,shot,papa,tumbler"',
				error: "Not a valid glass",
				errorTitle: "Wrong",
				showErrorMessage: true
			});

			// type validation
			for (let r of ["E2:E640001", "H2:H640001"]){
				sheet.range(r).dataValidation({
					type: "list",
					allowBlank: true,
					showDropDown: true,
					formula1: '"shot,scheutje,fles,aanvullen"',
					prompt: true,
					error: "Needs to be either shot, scheutje, fles or aanvullen",
					errorTitle: "Wrong",
					showErrorMessage: true
				});
			}

			// alcohol validation
			sheet.range("C2:C640001").dataValidation({
				type: "list",
				allowBlank: true,
				showDropDown: true,
				formula1: "alcohol!A2:A641",
				prompt: true,
				error: "This is not one of the alcohol options",
				errorTitle: "Wrong",
				showErrorMessage: true
			});

			//nonAlcohol validation
			sheet.range("F2:F640001").dataValidation({
				type: "list",
				allowBlank: true,
				formula1: "nonAlcohol!A2:A641",
				prompt: true,
				error: "This is not one of the alcohol options",
				errorTitle: "Wrong",
				showErrorMessage: true
			});

			//alcohol
			const alcSheet = workbook.addSheet("alcohol");
			const alcHeaders = ["id", "name", "alcPer", "vol", "price"]
			row = alcSheet.row(1);
			index = 1
			for (let h of alcHeaders){
				row.cell(index).value(h);
				index++;
			}

			let rowIndex = 2;
			for (let key in alcoholDB){
				row = alcSheet.row(rowIndex);
				row.cell(1).value(key);
				key = alcoholDB[key];
				row.cell(2).value(key.name);
				row.cell(3).value(key.alcPer);
				row.cell(4).value(key.vol);
				row.cell(4).style({numberFormat: "#0 \"ml\""});
				row.cell(5).value(key.price);
				row.cell(5).style({numberFormat: "€ #,##0.00"});
				rowIndex++;
			}

			//nonAlcohol
			const nonAlcSheet = workbook.addSheet("nonAlcohol");
			const nonAlcHeaders = ["id", "name", "vol", "price"]
			row = nonAlcSheet.row(1);
			index = 1
			for (let h of nonAlcHeaders){
				row.cell(index).value(h);
				index++;
			}

			rowIndex = 2;
			for (let key in nonAlcoholDB){
				row = nonAlcSheet.row(rowIndex);
				row.cell(1).value(key);
				key = nonAlcoholDB[key];
				row.cell(2).value(key.name);
				row.cell(3).value(key.vol);
				row.cell(3).style({numberFormat: "#0 \"ml\""});
				row.cell(4).value(key.price);
				row.cell(4).style({numberFormat: "€ #,##0.00"});
				rowIndex++;
			}

			//send to client
			workbook.outputAsync().then(buffer => {
				res.setHeader("Content-Disposition", "attachment; filename=bulk_import.xlsx");
				res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
				res.send(buffer);
			});
		});
});

app.get("/admin/upload", (req, res) => {
	checkCreateSession(req);
	setDebug(res);
	if (checkLogin(req) && checkPerm(req)) {
		res.render("upload.ejs", {location: "/admin/upload", scripts: genScripts("functions", "getDrank", "enableButtons", "loginButtons")});
	} else {
		res.render("error", {location: "/admin/upload", errorcode: "401 Unauthorized", message: "Je bent niet geauthoriseerd voor deze pagina.<br>Als je denkt dat dit een fout is, neem contact op met beheer."});
	}
});

app.post("/admin/upload", upload.single("file"), (req, res) => {
	setDebug(res);
	if (!checkLogin(req) || !checkPerm(req)) {
		res.render("error", {location: "/admin/upload", errorcode: "401 Unauthorized", message: "Je bent niet geauthoriseerd om te uploaden.<br>Als je denkt dat dit een fout is, neem contact op met beheer."})
		return;
	}

	const filepath = req.file.path;

	XLSX.fromFileAsync(filepath)
		.then(workbook => {
			const sheet = workbook.sheet("cocktails");

			let addDB = [];
			let fails = [];
			let index = -1;
			let rowIndex = 2;
			let emptyCount = 0;

			while (emptyCount < 11) {
				const row = sheet.row(rowIndex);
				emptyCount = 0;
				for (let l of xlsxCols) {
					let value = row.cell(l).value();

					if (value === undefined) {
						emptyCount ++;
						continue;
					}

					switch(l){
						case "A":
							addDB.push({name : value});
							index++;
							break;
						case "B":
							addDB[index]["glass"] = value;
							break;
						case "C":
							if (addDB[index]["alcohol"] === undefined) {
								addDB[index]["alcohol"] = {};
							}
							addDB[index]["alcohol"][value] = [];
							break;
						case "D":
							addDB[index]["alcohol"][row.cell("C").value()].push(value);
							break;
						case "E":
							addDB[index]["alcohol"][row.cell("C").value()].push(value);
							break;
						case "F":
							if (addDB[index]["nonAlcohol"] === undefined) {
								addDB[index]["nonAlcohol"] = {};
							}
							addDB[index]["nonAlcohol"][value] = [];
							break;
						case "G":
							addDB[index]["nonAlcohol"][row.cell("F").value()].push(value);
							break;
						case "H":
							addDB[index]["nonAlcohol"][row.cell("F").value()].push(value);
							break;
						case "I":
							if (addDB[index]["extras"] === undefined){
								addDB[index]["extras"] = []
							}
							addDB[index]["extras"].push([value]);
							break;
						case "J":
							addDB[index]["extras"][addDB[index]["extras"].length - 1].push(value);
							break;
						case "K":
							addDB[index]["creator"] = value;
							break;
						case "L":
							addDB[index]["desc"] = value;
							break;
					}

				}
				rowIndex ++;
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

			console.log("Succesfully created " + (addDB.length - fails.length).toString() + " cocktails");
			console.log("Failed creating " + fails.length.toString() + " cocktails\n" + fails.join("\n\t"));

			if (fails.length > 0){
				res.render("error", {location: "/admin/upload", errorcode: "336 + 64 = 400 Bad Request", message: fails.join(", ") + " konden niet geimporteerd worden.<br> Check je import xlsx."});
			} else {
				res.redirect("/");
			}
		})
});

app.listen(3000)
