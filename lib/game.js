
Array.prototype.shuffle = function () {
    for (let i = this.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this[i], this[j]] = [this[j], this[i]];
    }
    return this;
};
Array.prototype.shuffled = function () {
    let array = Array.from(this);
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

const Discord = require('discord.js');
const fs = require('fs');
const { MessageButton, MessageActionRow } = require('discord-buttons');
const languageManager = require("./languageManager");
const { lang } = languageManager;
const games = [];
module.exports = class Game {
    constructor(moderator, message) {
        this.isStarted = false;
        this.moderator = moderator;
        this.message = message;

        this.words = lang("words").shuffle().splice(0, 25);

        this.grid = [];
        this.gridButtons = [];
        this.gridButtonsSpy = [];

        this.initGrid();

        this.teams = [{ spymasters: [], operatives: [] }, { spymasters: [], operatives: [] }];
        this.players = [moderator];
        this.playerReplies = {};
    }
    static get games() {
        return games;
    }
    getNewWords() {
        this.words = lang("words").shuffle().splice(0, 25);
    }
    initGrid() {
        for (let j = 0; j < 5; j++) {
            let gridRow = [];
            let row = new MessageActionRow()

            for (let i = 0; i < 5; i++) {
                let myButton = new MessageButton()
                    .setLabel(this.words[j * 5 + i])
                    .setStyle("gray")//red,green,blurple,gray,url
                    //.setEmoji("🍕")
                    .setID(j + "," + i)
                gridRow.push(this.words[j * 5 + i])
                row.addComponent(myButton)
            }

            this.grid.push(gridRow);
            this.gridButtons.push(row);
        }
    }
    addPlayer(player) {
        return this.players.push(player);
    }
    removePlayer(player) {
        let index = this.players.indexOf(player);
        if (index == -1)
            return;

        this.removePlayerFromTeams(player);
        this.players.splice(index, 1);
        return this.players.length;
    }
    removePlayerFromTeams(player) {
        this.teams.forEach(team => {
            if (team.spymasters.includes(player))
                team.spymasters.splice(team.spymasters.indexOf(player), 1);
            if (team.operatives.includes(player))
                team.operatives.splice(team.operatives.indexOf(player), 1);
        });
    }
    resetTeams() {
        this.teams = [{ spymasters: [], operatives: [] }, { spymasters: [], operatives: [] }];
        return this.teams;
    }
    randomizeTeams() {
        this.resetTeams();
        this.players.shuffle()
        let newTeams = [
            this.players.slice(0, ~(this.players.length / 2) + 1),
            this.players.slice(~(this.players.length / 2) + 1, this.players.length)
        ].shuffled();
        this.teams[0].operatives = [...newTeams[0]];
        this.teams[1].operatives = [...newTeams[1]];
    }
    joinSpymasters(player, team) {
        if (isNaN(team))
            team = this.teams.findIndex(t => t.spymasters.some(p => p == player) || t.operatives.some(p => p == player));


        this.removePlayerFromTeams(player);

        this.teams[team].spymasters.push(player);
    }
    joinOperatives(player, team) {
        if (isNaN(team))
            team = this.teams.findIndex(t => t.spymasters.some(p => p == player) || t.operatives.some(p => p == player));

        this.removePlayerFromTeams(player);

        this.teams[team].operatives.push(player);
    }
    findTeamIndex(player) {
        console.log("Searching team index")
        console.log(player)
        console.log(this.teams)
        return this.teams.findIndex(team => team.spymasters.includes(player) || team.operatives.includes(player))
    }
    findTeam(player) {
        return this.teams.find(team => team.spymasters.includes(player) || team.operatives.includes(player))
    }
    start() {
        this.isStarted = true;
        this.blackWord = this.words[getRandomInt(0, this.words.length - 1)]

        this.currentTeam = 0//getRandomInt(0, 1);

        this.teams[0].words = [...this.words.filter(w => w != this.blackWord).shuffled().slice(0, !this.currentTeam ? 9 : 8)]
        this.teams[1].words = [...this.words.filter(w => w != this.blackWord && !this.teams[0].words.includes(w)).shuffled().slice(0, this.currentTeam ? 9 : 8)]

        for (let j = 0; j < this.grid.length; j++) {
            const row = this.grid[j];
            let btnRow = new MessageActionRow()

            for (let i = 0; i < row.length; i++) {
                let word = this.grid[j][i];
                let color;

                if (this.teams[0].words.includes(word))
                    color = "red";
                else if (this.teams[1].words.includes(word))
                    color = "blurple";
                else if (this.blackWord == word)
                    color = "green"
                else
                    color = "gray";

                let myButton = new MessageButton()
                    .setLabel(word)
                    .setStyle(color)//red,green,blurple,gray,url
                    .setID("spy_" + j + "," + i)

                if (color == "green" || color == "gray")
                    myButton.setDisabled(true);

                btnRow.addComponent(myButton)
            }
            this.gridButtonsSpy.push(btnRow);
        }
    }
    giveClue(clue, clueCount) {
        this.clue = clue;
        this.clueCount = clueCount;
        this.teams[this.currentTeam].guessCount = clueCount + 1;
        this.updateReplies()
        this.updateMessage()
    }
    nextRound() {
        this.clue = "";
        this.clueCount = "";
        this.teams[this.currentTeam].guessCount = 0;
        this.currentTeam = this.currentTeam ? 0 : 1;
        this.updateReplies()
        this.updateMessage()
    }
    gameOver(lose) {
        this.isGameOver = true;
        this.lastWinner = lose ? (this.currentTeam ? 0 : 1) : this.currentTeam;
        this.players.forEach(player => {
            let teamIndex = this.findTeamIndex(player);
            this.playerReplies[player.id].edit("**Game is over! You " + (this.lastWinner == teamIndex ? "win" : "lost") + "!**")
        });
        this.updateMessage();
    }
    resetGame() {
        this.clue = "";
        this.clueCount = "";
        this.isStarted = false;
        this.isGameOver = false;
        this.updateMessage();
    }
    async makeGuess(j, i) {
        this.gridButtons.forEach(gridButtons => {
            gridButtons.components.forEach(gridButton => {
                if (!gridButton.disabled && gridButton.style != "gray")
                    gridButton.setStyle("gray");
            })
        })

        let word = this.grid[j][i];
        let team = this.teams[this.currentTeam];
        let correct = team.words.includes(word);
        let opposite = this.teams[this.currentTeam ? 0 : 1].words.includes(word);

        let style = "gray";
        if (this.blackWord == word)
            style = "green"
        else if (this.teams[0].words.includes(word))
            style = "red"
        else if (this.teams[1].words.includes(word))
            style = "blurple"

        this.gridButtons[j].components[i].setDisabled(true).setStyle(style);

        if (this.blackWord == word)
            this.gameOver(true);
        else if (opposite)
            return this.nextRound();
        else if (--this.teams[this.currentTeam].guessCount <= 0)
            return this.nextRound();

        await this.updateMessage();
    }
    async updateMessage() {
        if (this.isGameOver)
            return this.message.edit({ embed: this.embed, component: this.createButton("Play Next Game", "green", "nextGame") });
        else if (this.isStarted)
            return this.message.edit({ embed: this.embed, components: this.gridButtons });
        else
            return this.message.edit({ embed: this.embed, component: this.createButton("Join Game", "green", "join") });
    }
    updateReplies() {
        this.teams[this.currentTeam].spymasters.forEach(spymaster => {
            let reply = this.playerReplies[spymaster.id];
            reply.edit("**Your operatives are guessing now...**", { components: this.gridButtonsSpy })
        });
        this.teams[this.currentTeam].operatives.forEach(operative => {
            let reply = this.playerReplies[operative.id];
            reply.edit("**Try to guess a word.**", { buttons: [this.createButton("Press to be ready to guess!", "red", "ready"), this.createButton("End Guessing", "green", "endGuessing")] })
        });
        this.teams[this.currentTeam ? 0 : 1].spymasters.forEach(spymaster => {
            let reply = this.playerReplies[spymaster.id];
            reply.edit("**The opponent operative is playing, wait for your turn...**", { components: this.gridButtonsSpy })
        });
        this.teams[this.currentTeam ? 0 : 1].operatives.forEach(operative => {
            let reply = this.playerReplies[operative.id];
            reply.edit("**The opponent operative is playing, wait for your turn...**", { components: null })
        });
    }
    get embed() {
        let redTeam = "";
        if (this.teams[0].spymasters.length)
            redTeam += "🕵️" + this.teams[0].spymasters.join("\n🕵️") + "\n";
        if (this.teams[0].operatives.length)
            redTeam += this.teams[0].operatives.join("\n");

        let blueTeam = "";
        if (this.teams[1].spymasters.length)
            blueTeam += "🕵️" + this.teams[1].spymasters.join("\n🕵️") + "\n";
        if (this.teams[1].operatives.length)
            blueTeam += this.teams[1].operatives.join("\n");

        let embed = new Discord.MessageEmbed()
            .addField("Players", this.players.join(" - ") || "-", false)
            .addField("Red Team", redTeam || "-", true)
            .addField("Blue Team", blueTeam || "-", true)

        if (this.isGameOver) {
            embed.setFooter("Codenames #" + games.indexOf(this), this.message.client.user.displayAvatarURL())
                .setTitle((this.lastWinner ? "Blue" : "Red") + " team wins!")
                .setDescription("Game is over!")
                .setColor(this.lastWinner ? "BLUE" : "RED")
        } else if (this.isStarted) {
            embed.setFooter("Codenames #" + games.indexOf(this), this.message.client.user.displayAvatarURL())
                .setAuthor((this.currentTeam ? "Blue" : "Red") + " Team is playing.")
                .setDescription("Waiting for spymaster to clue...")
                .setColor(this.currentTeam ? "BLUE" : "RED")

            if (this.clue) {
                embed.setTitle(this.clue + " - " + this.clueCount)
                    .setDescription("Waiting for operatives to guess...")
            }
        }
        else
            embed.setAuthor("Codenames #" + games.indexOf(this), this.message.client.user.displayAvatarURL())

        return embed;
    }
    createButton(label, style, id, activeOnly) {
        return new MessageButton()
            .setLabel(label)
            .setStyle(style) // red,green,blurple,gray,url
            .setID(id)
            .setDisabled(activeOnly ? activeOnly != id : false)
    }
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}