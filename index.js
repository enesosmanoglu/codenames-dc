const Discord = require('discord.js');
const fs = require('fs');

if (fs.existsSync('.env'))
    require('dotenv').config()

const languageManager = require("./lib/languageManager");
languageManager.changeLanguage("tr");
const { lang } = languageManager;

const client = new Discord.Client();

const Game = require("./lib/game");
const { games } = Game;

const dcbtn = require('discord-buttons');
dcbtn(client)
const { MessageButton, MessageActionRow } = dcbtn;

////////////////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////////////////

client.on('ready', () => {
    console.log(lang("client_ready", client.user.tag));
    client.api.applications(client.user.id).guilds('618388059708325898').commands.post({
        data: {
            name: "clue",
            description: "Give a clue to your operatives.",
            options: [
                {
                    name: "clue",
                    description: "Clue",
                    required: true,
                    type: 3,
                    choices: []
                },
                {
                    name: "clue_count",
                    description: "Clue Count",
                    required: true,
                    type: 4,
                }
            ]
        }
    })
});

client.on('message', async msg => {
    if (msg.content === '!play') {
        let components = [];
        let row = new MessageActionRow()
        let joinButton = new MessageButton()
            .setLabel("Create Game")
            .setStyle("green")//red,green,blurple,gray,url
            //.setEmoji("🍕")
            .setID("create")
        row.addComponent(joinButton);
        components.push(row);

        msg.channel.send("Use button below to create a new game:", { components });
    }
});

let joinGameButton = new MessageButton()
    .setLabel("Join Game")
    .setStyle("green")
    .setID("join")

client.on('clickButton', async (button) => {
    await button.clicker.fetch();
    let gameID = parseInt(button.message.embeds[0]?.author?.name?.split("#")[1]) || parseInt(button.message.embeds[0]?.footer?.text?.split("#")[1]) || games.findIndex(g => g.players.includes(button.clicker.user));
    let gameMsg = button.message;
    console.log(gameMsg.id);
    if (gameID >= 0 && gameMsg.id != games[gameID].message.id) {
        gameMsg = games[gameID].message;
    }
    if (!gameID || gameID < 0)
        gameID = games.findIndex(g => g.message.id == gameMsg.id)
    console.log(gameMsg.id);

    let game = !isNaN(gameID) ? games[gameID] : null;
    let player = button.clicker.user;
    player.isModerator = player.id == game?.moderator?.id;
    let teamIndex = game?.findTeamIndex(player);
    let team = game?.findTeam(player);

    console.log(player.username, "clicked", button.id, "\tGameID:", gameID);

    let components = [];

    if (button.id == "create") {
        game = new Game(player, gameMsg);
        games.push(game);

        await game.updateMessage();

        addTeamComponents(components, true);

        game.playerReplies[player.id] = await button.reply.send("**Set up a game**", { ephemeral: true, components });
    } else if (button.id == "join") {
        if (game.players.includes(player))
            return await button.defer();

        game.players.push(player);
        await game.updateMessage();

        addTeamComponents(components, false);

        game.playerReplies[player.id] = await button.reply.send("**Join a team**", { ephemeral: true, components });
    } else if (["op_red", "op_blue", "spy_red", "spy_blue"].includes(button.id)) {
        let teamIndex = button.id.endsWith("red") ? 0 : 1;
        let isSpy = button.id.startsWith("spy");

        if (isSpy)
            game.joinSpymasters(player, teamIndex);
        else
            game.joinOperatives(player, teamIndex);

        addTeamComponents(components, player.isModerator, ["op_red", "op_blue", "spy_red", "spy_blue"].find(id => id != button.id && id[id.length - 1] == button.id[button.id.length - 1]));

        await game.updateMessage();
        await game.playerReplies[player.id].edit({ components })
        await button.defer();
    } else if (button.id == "switch") {
        let isSpy = game.teams[teamIndex].spymasters.includes(player);

        if (isSpy)
            game.joinSpymasters(player, teamIndex ? 0 : 1);
        else
            game.joinOperatives(player, teamIndex ? 0 : 1);

        button.id = (isSpy ? "spy" : "op") + "_" + (teamIndex ? "red" : "blue");

        components = [];
        addTeamComponents(components, player.isModerator, ["op_red", "op_blue", "spy_red", "spy_blue"].find(id => id != button.id && id[id.length - 1] == button.id[button.id.length - 1]));

        await game.updateMessage();
        await game.playerReplies[player.id].edit({ components })
        await button.defer();
    } else if (button.id == "leave") {
        game.removePlayer(player);

        await game.updateMessage();

        await game.playerReplies[player.id].edit("Left the game!");
        await button.defer();
    } else if (button.id == "randomize") {
        game.randomizeTeams();

        let teamIndex = game.findTeamIndex(player);
        let isSpy = game.teams[teamIndex].spymasters.includes(player);

        button.id = (isSpy ? "spy" : "op") + "_" + (teamIndex ? "blue" : "red");

        components = [];
        addTeamComponents(components, player.isModerator, ["op_red", "op_blue", "spy_red", "spy_blue"].find(id => id != button.id && id[id.length - 1] == button.id[button.id.length - 1]));

        await game.updateMessage();
        await game.playerReplies[player.id].edit({ components })
        await button.defer();
    } else if (button.id == "reset") {
        game.resetTeams();

        await game.updateMessage();

        addTeamComponents(components, player.isModerator);

        await game.playerReplies[player.id].edit({ components })
        await button.defer();
    } else if (button.id == "start") {
        console.log("START")
        game.start();

        await game.updateMessage();

        game.teams[game.currentTeam].spymasters.forEach(spymaster => {
            let reply = game.playerReplies[spymaster.id];

            reply.edit("**Give your operatives a clue.**", { components: game.gridButtonsSpy })
        });
        game.teams[game.currentTeam].operatives.forEach(operative => {
            let reply = game.playerReplies[operative.id];

            reply.edit("**Wait for your spymaster to give you a clue...**", { components: null })
        });
        game.teams[game.currentTeam ? 0 : 1].spymasters.forEach(spymaster => {
            let reply = game.playerReplies[spymaster.id];

            reply.edit("**The opponent spymaster is playing, wait for your turn...**", { components: game.gridButtonsSpy })
        });
        game.teams[game.currentTeam ? 0 : 1].operatives.forEach(operative => {
            let reply = game.playerReplies[operative.id];

            reply.edit("**The opponent spymaster is playing, wait for your turn...**", { components: null })
        });
        /* 
                const filter = m => game.teams[game.currentTeam].spymasters.includes(m.author);
                button.channel.awaitMessages(filter, { max: 1 })
                    .then(collected => {
                        console.log(collected)
                    }) */

        await button.defer();
    } else if (button.id.includes(",")) {
        if (button.id.startsWith("spy"))
            return await button.defer();

        if (game.currentTeam != teamIndex)
            return await button.defer();

        if (team.spymasters.includes(player))
            return await button.defer();

        if (!game.clue)
            return await button.defer();

        let j = parseInt(button.id.split(",")[0]);
        let i = parseInt(button.id.split(",")[1]);
        console.log(j, i)

        let btn = game.gridButtons[j].components[i];
        console.log(btn);

        if (team.ready?.includes(player)) {
            await game.makeGuess(j, i);
        } else {
            if (btn.style != 3)
                btn.setStyle("green")
            else
                btn.setStyle("gray")
        }
        await game.updateMessage();
        await button.defer();
    } else if (button.id == "ready") {
        if (game.currentTeam != teamIndex)
            return await button.defer();

        if (!game.teams[teamIndex].ready)
            game.teams[teamIndex].ready = [player];
        else
            game.teams[teamIndex].ready.push(player);
        let reply = game.playerReplies[player.id];
        reply.edit("**Try to guess a word.**", { buttons: [createButton("I'm ready", "green", "notready"), createButton("End Guessing", "green", "endGuessing")] })
        await button.defer();
    } else if (button.id == "notready") {
        if (game.currentTeam != teamIndex)
            return await button.defer();

        if (!game.teams[teamIndex].ready)
            game.teams[teamIndex].ready = [];
        else
            game.teams[teamIndex].ready.splice(game.teams[teamIndex].ready.indexOf(player), 1);
        let reply = game.playerReplies[player.id];
        reply.edit("**Try to guess a word.**", { buttons: [createButton("Press to be ready to guess!", "red", "ready"), createButton("End Guessing", "green", "endGuessing")] })
        await button.defer();
    } else if (button.id == "endGuessing") {
        if (game.currentTeam != teamIndex)
            return await button.defer();

        game.nextRound();
        await button.defer();
    } else if (button.id == "nextGame") {
        if (player.id != game.moderator.id)
            return await button.defer();

        game.resetGame();
        await button.defer();
    }

    function addTeamComponents(components, isModerator, activeOnly) {
        components.push(new MessageActionRow()
            .addComponent(createButton("Join as Operative", "red", "op_red", activeOnly))
            .addComponent(createButton("Join as Operative", "blurple", "op_blue", activeOnly))
        );
        components.push(new MessageActionRow()
            .addComponent(createButton("Join as Spymaster", "red", "spy_red", activeOnly))
            .addComponent(createButton("Join as Spymaster", "blurple", "spy_blue", activeOnly))
        );
        if (activeOnly) {
            let team = activeOnly.split("_")[1] == "red" ? "Blue" : "Red";
            components.push(new MessageActionRow()
                .addComponent(createButton("Switch to " + team + " Team", team == "Red" ? "red" : "blurple", "switch"))
            );
        }
        if (!isModerator)
            components.push(new MessageActionRow()
                .addComponent(createButton("Leave the Game", "gray", "leave"))
            );
        else
            addModerationComponents(components);
    }
    function addModerationComponents(components) {
        components.push(new MessageActionRow()
            .addComponent(createButton("Randomize Teams", "gray", "randomize"))
            .addComponent(createButton("Reset Teams", "gray", "reset"))
        );
        components.push(new MessageActionRow()
            .addComponent(createButton("Start New Game", "green", "start"))
            .addComponent(createButton("Leave the Game", "gray", "leave"))
        );
    }
});

function createButton(label, style, id, activeOnly) {
    return new MessageButton()
        .setLabel(label)
        .setStyle(style)//red,green,blurple,gray,url
        .setID(id)
        .setDisabled(activeOnly ? activeOnly != id : false)
}

client.ws.on('INTERACTION_CREATE', async interaction => {
    if (interaction.data.name != "clue")
        return;

    let clue = interaction.data.options.find(o => o.name == "clue").value;
    let clueCount = interaction.data.options.find(o => o.name == "clue_count").value;

    let game = games.find(g => g.players.some(p => p.id == interaction.member.user.id));
    let player = game.players.find(p => p.id == interaction.member.user.id);

    if (!game)
        return client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    content: `**You are NOT in a game!**`,
                    flags: 1 << 6,
                },
            },
        });

    let teamIndex = game.findTeamIndex(player);
    let team = game.teams[teamIndex];

    if (!team.spymasters.includes(player))
        return client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    content: `**You are NOT a spymaster!**`,
                    flags: 1 << 6,
                },
            },
        });

    if (game.currentTeam != teamIndex)
        return client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    content: `**Please wait your turn!**`,
                    flags: 1 << 6,
                },
            },
        });

    game.giveClue(clue, clueCount);

    client.api.interactions(interaction.id, interaction.token).callback.post({
        data: {
            type: 4,
            data: {
                content: `Waiting your operatives!`,
                flags: 1 << 6,
            },
        },
    });


})
client.login(process.env.TOKEN);