function enableButton(elementId, eventType, listener, antiLocations) {
	let e = document.getElementById(elementId);
	antiLocations = (antiLocations === undefined) ? [""] : antiLocations;
	if (e !== undefined && e !== null && typeof e !== undefined && !antiLocations.includes(location.pathname)){
		e.addEventListener(eventType, listener);
	}
}
enableButton("nieuweSelectAlcohol", "mousedown", (e) => {
	if (e.target.tagName.toLowerCase() === "option") {
		selectEasy(e.target);
		e.preventDefault();
	}
});
enableButton("nieuweSelectNonAlcohol", "mousedown", (e) => {
	if (e.target.tagName.toLowerCase() === "option") {
		selectEasy(e.target);
		e.preventDefault();
	}
});

enableButton("selectAlcoholSearch", "keyup", (e) => {
	filterDrink("alcohol", e.target.value.toLowerCase());
});

enableButton("selectNonAlcoholSearch", "keyup", (e) => {
	filterDrink("nonalcohol", e.target.value.toLowerCase());
});

enableButton("nieuweSelectAlcohol", "change", (e) => {
	updateSelectQuantity(e);
});

enableButton("nieuweSelectNonAlcohol", "change",  (e) => {
	updateSelectQuantity(e);
});

enableButton("addExtra", "click", function(e) {
	e.preventDefault();
	let element = document.getElementById("extraStuff");
	generateExtra(element);
});

enableButton("reset", "click", function() {
document.getElementById("alcoholAmount").innerHTML = "";
    document.getElementById("nonAlcoholAmount").innerHTML = "";

    let selectAlcohol = document.getElementById("nieuweSelectAlcohol");
    for (let i = 0; i < selectAlcohol.children.length; i++) {
        let child = selectAlcohol.children.item(i);
        if (child.hasAttribute("selected")) {
            child.removeAttribute("selected");
        }
    }

    let selectNonAlcohol = document.getElementById("nieuweSelectNonAlcohol");
    for (let i = 0; i < selectNonAlcohol.children.length; i++) {
        let child = selectNonAlcohol.children.item(i);
        if (child.hasAttribute("selected")) {
            child.removeAttribute("selected");
        }
    }
});

//zorgt voor de interactie op de webpagina
enableButton("selectNonAlcohol", "click", function(){
	sort();
});

enableButton("selectAlcohol", "click", function(){
	sort();
});

enableButton("randomCocktail", "click", function(){
	randomCocktail();
});

enableButton("search", "keyup", function(){
	searchCocktail(returnSelected());
}, ["/admin/alcohol", "/admin/nonalcohol"]);

enableButton("selectGlass", "change", function(){
	sort();
});

enableButton("sort", "change", function(){
	switch(document.getElementById("sort").value){
		case "Alfabetisch":
			sortAlpha();
			break;
		case "Prijs laag -> hoog":
			sortByPriceLH();
			break;
		case "Prijs hoog -> laag":
			sortByPrice();
			break;
		case "Alcohol laag -> hoog":
			sortByAlcLH();
			break;
		case "Alcohol hoog -> laag":
			sortByAlc();
			break;
		default:
			break;
		}
}, ["/admin/alcohol", "/admin/nonalcohol"]);

enableButton("backToAll", "click", backToAll);

if (location.pathname.includes("admin") && location.pathname !== "/admin/upload") {
	let db = [];

	if (location.pathname.includes("cocktails")) {
		for (let item in cocktailDB){
			item = cocktailDB[item];
			db.push(item);
		}

	} else if (location.pathname.includes("nonalcohol")) {
		for (let item in nonAlcoholDB){
			item = nonAlcoholDB[item];
			db.push(item);
		}
	} else {
		for (let item in alcoholDB){
			item = alcoholDB[item];
			db.push(item);
		}
	}

	enableButton("new", "click", function() {
		addNew();
	});

	enableButton("search", "keyup", function(){
		search(db);
	});

	enableButton("sort", "change", function(){
		switch(document.getElementById("sort").value){
			case "Alfabetisch":
				sortAlpha(db);
				break;
			case "Prijs laag -> Hoog":
				sortByPriceLH(db);
				break;
			case "Prijs hoog -> Laag":
				sortByPrice(db);
				break;
			case "Alcohol laag -> hoog":
				sortByAlcLH(db);
				break;
			case "Alcohol hoog -> laag":
				sortByAlc(db);
				break;
			case "Volume laag -> hoog":
				sortByVolLH(db);
				break;
			case "Volume hoog -> laag":
				sortByVol(db);
				break;
		}
	});
}

enableButton("hamburger", "click", function() {
	let bar = document.getElementById("topnav");
	if (bar.style.display !== "none" && bar.style.display !== ""){
		bar.style.display = "none";
	} else {
		bar.style.display = "inline-block";
	}
});