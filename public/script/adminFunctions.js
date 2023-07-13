function br(){
	return document.createElement("br");
}

function confirm(divId, callback) {
	let div = document.getElementById(divId);
	let content = document.getElementById("content");
	let overlay = document.getElementById("overlay");
	overlay.style.display = "block";
	content.addEventListener("mousedown", blockEvent);
	div.style.display = "block";

	for (let i in div.children){
		let item = div.children[i];
		if (item.id === "yes") {
			item.onclick = () => {
				overlay.style.display = "none";
				content.removeEventListener("mousedown", blockEvent);
				div.style.display = "none";
				callback();
			};
		} else if (item.id === "no") {
			item.onclick = () => {
				overlay.style.display = "none";
				content.removeEventListener("mousedown", blockEvent);
				div.style.display = "none";
			}
		}
	}
}

function blockEvent(e){
	e.preventDefault();
}

function printToPage(database) {

	document.getElementById('content').innerHTML = "";
	for (let item in database) {
		let type;
		let drink = database[item];

		let div = document.createElement("div");
		div.className = "drink";

		let name = document.createElement("input");
		name.id = "name";
		name.value = drink.name;
		div.append(name, br(), br(), br());

		const serveSize = document.createElement("input");
		serveSize.value = drink.vol;
		serveSize.type = "number";
		serveSize.step = "1";
		serveSize.id = "serveSize";

		let serveSizeLabel = document.createElement("label");
		serveSizeLabel.innerHTML = "Serveer volume [mL]";
		serveSizeLabel.htmlFor = serveSize.id;

		div.append(serveSizeLabel, serveSize, br());

		if ("alcPer" in drink) {
			type = "alcohols";
			const alcPer = document.createElement("input");
			alcPer.value = drink.alcPer;
			alcPer.id = "alcPer";
			alcPer.type = "number";
			alcPer.step = ".1";

			let alcPerLabel = document.createElement("label");
			alcPerLabel.innerHTML = "Alcohol gehalte [%]";
			alcPerLabel.htmlFor = alcPer.id;

			div.append(alcPerLabel, alcPer, br());

		} else{
			type = "nonalcohols";
		}

		const price = document.createElement("input");
		price.value = drink.price;
		price.type = "number";
		price.step = ".01";
		price.id = "price";

		let priceLabel = document.createElement("label");
		priceLabel.innerHTML = "Prijs €";
		priceLabel.htmlFor = price.id;

		div.append(priceLabel, price);

		let butDiv = document.createElement("div");
		butDiv.id = "butDiv";

		let edit = document.createElement("button");
		edit.id = "edit";
		edit.onclick = () => {
			let put = new XMLHttpRequest();
			let newDrink = {id: getId(drink.name), name: drink.name, price: price.value, vol: serveSize.value}

			if (type === "alcohols") {
				newDrink["alcPer"] = alcPer.value;
			}
			put.open("PUT", "/admin/{}?edit={}".format(type, getId(drink.name)));
			put.setRequestHeader("Content-Type", "application/json");
			put.onreadystatechange = function() {
				if (put.status === 200) {
					location.reload();
				}
			};
			put.send(JSON.stringify(newDrink));
		};
		edit.innerHTML = "Submit";

		let remove = document.createElement("button");
		remove.id = "remove";
		remove.onclick = () => {
			confirm("removeConfirm", () => {
				div.remove();
				let put = new XMLHttpRequest();
				put.open("PUT", "/admin/" + type + "?remove=" + getId(drink.name));
				put.onreadystatechange = function() {
					if (put.status === 200) {
						location.reload();
					}
				}
				put.send();
			});
		};
		remove.innerHTML = "Remove";

		butDiv.append(edit, remove);
		div.appendChild(butDiv);
		document.getElementById('content').appendChild(div);
	}
}

function render(database){
	if (document.location.pathname.includes("cocktails")) {
		printToWebpage(database);
	} else{
		printToPage(database);
	}
}

function addNew() {
	let type;

	if (location.pathname.includes("nonalcohols")) {
		type = "nonAlcohols";
	} else {
		type = "alcohols";
	}

	let div = document.createElement("div");
	div.className = "drink";

	const name = document.createElement("input");
	name.placeholder = "Naam";
	name.id = "name";
	div.append(name, br(), br(), br());

	const serveSize = document.createElement("input");
	serveSize.value = 40;
	serveSize.type = "number";
	serveSize.step = "1";
	serveSize.id = "serveSize";

	let serveSizeLabel = document.createElement("label");
	serveSizeLabel.innerHTML = "Serveer volume [mL]";
	serveSizeLabel.htmlFor = serveSize.id;

	div.append(serveSizeLabel, serveSize, br());

	const alcPer = document.createElement("input");
	if (type === "alcohol") {
		alcPer.value = 38;
		alcPer.id = "alcPer";
		alcPer.type = "number";
		alcPer.step = ".1";

		let alcPerLabel = document.createElement("label");
		alcPerLabel.innerHTML = "Alcohol percentage [%]";
		alcPerLabel.htmlFor = alcPer.id;

		div.append(alcPerLabel, alcPer, br());

	}

	const price = document.createElement("input");
	price.value = 1.3;
	price.type = "number";
	price.step = ".01";
	price.id = "price";

	let priceLabel = document.createElement("label");
	priceLabel.innerHTML = "Prijs €";
	priceLabel.htmlFor = price.id;

	div.append(priceLabel, price);

	let butDiv = document.createElement("div");
	butDiv.id = "butDiv";

	let edit = document.createElement("button");
	edit.id = "edit";
	edit.onclick = () => {
		let put = new XMLHttpRequest();
		let newDrink = {id: getId(name.value), name: name.value, price: price.value, vol: serveSize.value}

		if (type === "alcohols") {
			newDrink["alcPer"] = alcPer.value;
		}

		put.open("PUT", "/admin/{}?add={}".format(type, getId(name.value)));
		put.setRequestHeader("Content-Type", "application/json");
		put.onreadystatechange = function() {
			if (put.status === 200) {
				location.reload();
			}
		}
		put.send(JSON.stringify(newDrink));
	};
	edit.innerHTML = "Submit";

	butDiv.append(edit);
	div.appendChild(butDiv);
	document.getElementById('content').insertBefore(div, document.getElementById("content").firstChild);
}

function search(array){
	let input = document.getElementById('search').value.toString().toLowerCase();
	let searchedArray = array.filter(element => element.name.toString().toLowerCase().includes(input))
	render(searchedArray);
}

function sortAlpha(database) {
	const sort = database.sort();
	render(sort);
}
function sortByPriceLH(database){
	const sort = database.sort((a,b) => (a.price - b.price));
	render(sort);
}
function sortByPrice(database){
	const sort = database.sort((a,b) => (b.price - a.price));
	render(sort);
}
function sortByAlcLH(database){
	const sort = database.sort((a,b) => (a.alcPer - b.alcPer));
	render(sort);
}
function sortByAlc(database){
	const sort = database.sort((a,b) => (b.alcPer - a.alcPer));
	render(sort);
}

function sortByVolLH(database) {
	const sort = database.sort((a,b) => (a.vol - b.vol));
	render(sort);
}
function sortByVol(database) {
	const sort = database.sort((a,b) => (b.vol - a.vol));
	render(sort);
}

if (location.pathname.includes("/admin/cocktails/edit")) {
	let search = new URLSearchParams(window.location.search);
	const cocktailID = search.get('cocktail');

	document.getElementById("cocktail").value = cocktailID;
	document.getElementById("scroll").value = search.get("scroll");

	if (cocktailID in cocktailDB) {
		let cocktail = cocktailDB[cocktailID];
		console.log(cocktail);

		document.getElementById("name").value = cocktail.name;
		document.getElementById("selectGlass").value = cocktail.glass;
		document.getElementById("desc").value = cocktail.desc;
		document.getElementById("creator").value = cocktail.creator;

		let selAlc = document.getElementById("nieuweSelectAlcohol");
		for (let i in selAlc.children) {
			let option = selAlc.children[i];
			if (cocktail.alcohol !== null > 0 && option.value in cocktail.alcohol){
				option.selected = true;
				selAlc.dispatchEvent(new Event("change"));

				let type = document.getElementById("selectType{}".format(getId(option.innerHTML)));
				type.value = cocktail.alcohol[option.value][1];

				if (type.value !== "aanvullen") {
					document.getElementById("selectN{}".format(getId(option.innerHTML))).value = cocktail.alcohol[option.value][0];
				} else {
					let input = document.getElementById("selectN{}".format(getId(option.innerHTML)));
					type.style.width = "60%";
					input.style.display = "none";
					input.required = false;
				}
			}
		}

		let selNonAlc = document.getElementById("nieuweSelectNonAlcohol");
		for (let i in selNonAlc.children) {
			let option = selNonAlc.children[i];
			if (cocktail.nonAlcohol !== null && option.value in cocktail.nonAlcohol){
				option.selected = true;
				selNonAlc.dispatchEvent(new Event("change"));

				let type = document.getElementById("selectType{}".format(getId(option.innerHTML)));
				type.value = cocktail.nonAlcohol[option.value][1];

				if (type.value !== "aanvullen") {
					document.getElementById("selectN{}".format(getId(option.innerHTML))).value = cocktail.nonAlcohol[option.value][0];
				} else {
					let input = document.getElementById("selectN{}".format(getId(option.innerHTML)));
					type.style.width = "60%";
					input.style.display = "none";
					input.required = false;
				}
			}
		}

		if (cocktail.extras !== null) {
			let extras = document.getElementById("extraStuff");
			for (let i in cocktail.extras) {
				let item = cocktail.extras[i];

				generateExtra(extras);
				document.getElementById("extraName" + i.toString()).value = item[0];
				document.getElementById("extraPrice" + i.toString()).value = parseFloat(item[1]);
			}
		}
	} else {
		location.href = "/admin/cocktails?scroll=" + document.getElementById("scroll").value;
	}
} else if (location.pathname.includes("/admin/cocktails")) {
	let search = new URLSearchParams(window.location.search);

	if (search.has("scroll")){
		window.scrollTo(0, parseInt(search.get("scroll")));
	}
}