function selectEasy(el) {
    if (el.tagName.toLowerCase() === "option" && el.parentNode.hasAttribute("multiple")) {
        // toggle selection
        if (el.hasAttribute('selected')) el.removeAttribute('selected');
        else el.setAttribute('selected', '');

        el.parentNode.dispatchEvent(new Event("change"));
        return true;
    }
    return false;
}

function filterDrink(type, input) {
    let database;
    let element;
    if (type === "alcohol") {
        database = alcoholDB;
        element = document.getElementById("nieuweSelectAlcohol");
    } else if (type === "nonalcohol") {
        database = nonAlcoholDB;
        element = document.getElementById("nieuweSelectNonAlcohol");
    }
    let searchedArray = Object.values(database).filter(element => element.name.toString().toLowerCase().includes(input))
    element.innerHTML = "";

    for (let key in searchedArray) {
        let opt = document.createElement('option');
        opt.value = key;
        opt.innerHTML = searchedArray[key].name
        element.appendChild(opt);
    }

}

function updateSelectQuantity(e) {

    if (e.target.id === "nieuweSelectAlcohol" || e.target.id === "nieuweSelectNonAlcohol") {

        let type = e.target.id.replace("nieuweSelect", "");
        type = type.charAt(0).toLowerCase() + type.slice(1);

        let xAmount = document.getElementById(type + "Amount");

        for (let i = 0; i < e.target.childElementCount; i++) {

            let element = e.target.children.item(i);
            let child = document.getElementById(element.innerHTML.replaceAll(" ", "_"));

            if (element.selected && child === null) {

                let div = document.createElement("div");
                let label = document.createElement("label");
                let input = document.createElement("input");
                let select = document.createElement("select");
                let shot = document.createElement("option");
                let fles = document.createElement("option");
                let scheutje = document.createElement("option");
                let aanvullen = document.createElement("option");
                input.type = "number";
                input.step = "any";
                input.className = "hoeveelheid";
                input.name = "selectN" + element.value.replaceAll(" ", "_");
                input.id = "selectN" + element.value.replaceAll(" ", "_");
                input.required = true;
                label.innerHTML = element.innerHTML;
                label.className = "hoeveelheid";
                select.name = "selectType" + element.value.replaceAll(" ", "_");
                select.id = "selectType" + element.value.replaceAll(" ", "_");
                select.className = "hoeveelheid";
                select.onchange = function() {
                    console.log(select);
                    console.log(select.style.width);
                    if (select.item(select.selectedIndex) === aanvullen) {
                        select.style.width = "60%";
                        input.style.display = "none";
                        input.required = false;
                    } else {
                        select.style.width = "inherit";
                        input.style.display = "inherit";
                        input.required = true;
                    }

                    console.log(select);
                    console.log(select.style.width);
                };
                shot.innerHTML = "shot";
                shot.name = "shot";
                scheutje.innerHTML = "scheutje";
                scheutje.name = "scheutje";
                fles.innerHTML = "fles";
                fles.name = "fles";
                aanvullen.name = "aanvullen";
                aanvullen.innerHTML = "aanvullen";

                select.append(shot, fles, scheutje, aanvullen);
                div.appendChild(label);
                div.appendChild(select);
                div.appendChild(input);
                div.id = element.innerHTML.replaceAll(" ", "_");

                xAmount.appendChild(div);
                if (xAmount.style.display === "none") xAmount.style.display = "flex";

            } else if (child != null && !element.selected) {
                xAmount.removeChild(child);
                if (xAmount.childElementCount <= 1) xAmount.style.display = "none";
            }
        }
    }
}