#!/bin/bash
cd /var/www/cocktailboek
git add ./public/assets/cocktails.json
git add ./public/assets/alcohol.json
git add ./public/assets/nonAlcohol.json
git commit -m "Cocktail, alcohol & nonAlcohol database update"
git push
