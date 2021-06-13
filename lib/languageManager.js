
String.prototype.escapeRegExp = function () {
    return this.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
String.prototype.replaceAllWithArray = function (searchValue, replaceArray = []) {
    let str = this;
    let match = this.match(new RegExp(searchValue.escapeRegExp()));
    if (!match || !replaceArray.length) return str.toString();
    str = str.replace(searchValue, replaceArray.shift());
    return str.replaceAllWithArray(searchValue, replaceArray).toString();
};

const fs = require('fs');
const path = require('path');

const data = {};

fs.readdirSync(path.join(__dirname, '..', 'lang')).forEach(file => {
    let lang = file.replace(".json", "");
    data[lang] = require(path.join(__dirname, '..', 'lang', file));
})

let selectedLang = "en";

function changeLanguage(lang) {
    if (!data.hasOwnProperty(lang))
        throw new Error("Couldn't found language!");

    selectedLang = lang;
}
exports.changeLanguage = changeLanguage;

function lang(key, ...args) {
    let str = data[selectedLang][key] || key;
    if (typeof (str) != "string")
        return str;

    return str.replaceAllWithArray("${}", args);
}
exports.lang = lang;