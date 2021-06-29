var OpponentListFromJS = {}
var Opponent = null;

class CustomTimer {
	constructor(duration, timerUpdateCallback, updateInterval = 1000) {
		this.startTime = new Date().getTime();
		this.pauseTime = this.startTime;
		this.endTime = this.startTime + duration;
		this.updateInterval = updateInterval;
		this.timerUpdateCallback = timerUpdateCallback;
		this.resumeTimer();
	}

	resumeTimer() {
		if (!this.pauseTime)
			return;

		this.extendTimer(new Date().getTime() - this.pauseTime);
		this.pauseTime = null;
		this.timerInterval = setInterval(() => {
			this.updateTimer();
		}, this.updateInterval);
	}

	updateTimer() {
		var timeRemaining = this.endTime - new Date().getTime();
		if (this.timerUpdateCallback) {
			if (timeRemaining < 0) {
				timeRemaining = 0;
				clearInterval(this.timerInterval);
			}
			this.timerUpdateCallback(timeRemaining);
		}
	}

	pause() {
		if (this.pauseTime)
			return;

		this.pauseTime = new Date().getTime();
		clearInterval(this.timerInterval);
		this.updateTimer();

		return true;
	}

	pauseForDuration(duration) {
		if (this.pause()) {
			setTimeout(() => {
				// resume timer
				this.resumeTimer();
			}, duration);
		}
	}

	extendTimer(duration, updateTimer = true) {
		this.endTime += duration;

		if (updateTimer)
			this.updateTimer();
	}
}

function sdkSound(src, loop = false) {
	this.sound = new Audio(src);
	this.sound.loop = loop;
	this.sound.playing = false;
	this.userStartedSound = false;

	this.play = function () {
		if (this.isPaused()) {
			this.sound.play();

			if (!this.isPaused()) {
				this.userStartedSound = true;
			}
		}
	}
	this.pause = function () {
		this.sound.pause();
	}
	this.stop = function () {
		this.pause();
		this.sound.currentTime = 0;
	}
	this.isPaused = function () {
		return !this.sound.playing;
	}

	this.playAudioSilently = () => {
		if (!this.userStartedSound)
			this.sound.volume = 0;
		if (!this.sound.playing)
			this.sound.play();
		if (!this.userStartedSound) {
			this.stop();
		}
		this.sound.volume = 1;

		window.removeEventListener("touchstart", this.playAudioSilently)
	}

	window.addEventListener("touchstart", this.playAudioSilently);
}

/*
function sdkSound(src, loop = false) {
	this.sound = document.createElement("audio");
	this.sound.src = src;
	this.sound.loop = loop;
	this.sound.paused = true;
	this.sound.setAttribute("preload", "auto");
	this.sound.setAttribute("controls", "none");
	this.sound.style.display = "none";
	document.body.appendChild(this.sound);
	this.play = function(){
		if (this.isPaused()){
			this.sound.play();
		}
	}
	this.pause = function(){
		this.sound.pause();
	}
	this.stop = function(){
		this.sound.pause();
		this.sound.currentTime = 0;
	}
	this.isPaused = function() {
		return this.sound.paused;
	}
}
*/
var App = function () {
	const FINISHED_GAME = 99;
	const ABORT_GAME = 4;
	const UPDATE_SCORE = 2;
	const UPDATE_FINAL_SCORE = 3;
	const READY_TO_PLAY = 1;

	var _this = this;
	this.goPlaySDK = GoPlaySDK;
	this.score = 0;
	this.opponents = {};
	this.finishedCount = 0;
	this.isKicked = false;
	this.readyPlayers = [];

	this.onAllFished = null;
	this.isFinishedGameWaitingForOpponent = false;
	this.finalScoreSent = false;
	this.loadedData = null;
	this.loadProperties = null;
	this.loadCallback = null;
	this.countdownDate = null;
	this.timer = null;
	this.timerDiv = null;
	this.timerFill = null;
	this.timerText = null;
	this.gameOverOverlayShown = false;
	this.isTimeBased = true;
	this.kickPlayerTimer = null;
	this.isSaveProfile = false;
	this.gameStarted = false;
	this.timerObj = null;

	// scoreboard
	this.selfScoreLabel = null;
	this.opponentScore = 0;
	this.opponentScoreLabel = null;

	// Anti-Cheat validation: add on 13/01/2021 - san.phan
	this.gameStateData = null;

	this.opponentCount = function () {
		return Object.keys(this.opponents).length;
	}

	this.isSDKReady = function () {
		return _this.goPlaySDK.isSDKReady;
	}

	this.loadingExpiredAt = function () {
		return _this.goPlaySDK.loadingExpiredAt;
	}

	var otherPlayers = this.goPlaySDK.otherPlayers;
	for (var i = 0; i < otherPlayers.length; i++) {
		_this.opponents[otherPlayers[i].id] = otherPlayers[i];
	}

	// Start the game
	this.goPlaySDK.onReady = function () {
		// AnhTQ.postMessage("onReady" + (_this.loadProperties && _this.loadCallback) );
		if (_this.loadProperties && _this.loadCallback) {
			_this.loadGameData(_this.loadProperties, _this.loadCallback);
		}
	}

	this.goPlaySDK.getCurrentPlayer = function (e) {
		if (!_this.goPlaySDK.currentUser.firstName || _this.goPlaySDK.currentUser.firstName === "") {
			_this.goPlaySDK.currentUser.firstName = _this.goPlaySDK.currentUser.displayName;
		}
		if (e) {
			e(_this.goPlaySDK.currentUser);
		}

		return _this.goPlaySDK.currentUser;
	}

	// Catch the custom event from
	this.goPlaySDK.onEvent = function (code, eventData, userId) {
		if (code == READY_TO_PLAY) {
			console.log("##=> Received Ready to play of: " + userId);
		}
		else {
			console.log('New event data -->' + JSON.stringify(eventData));
		}

		switch (code) {
			case READY_TO_PLAY: {
				_this.playerReady(userId);
				_this.checkToStartGame();
				break;
			}
			case UPDATE_FINAL_SCORE: {
				break;
			}

			case FINISHED_GAME: {
				console.log('@@=> Somebody finished game!');
				_this.finishedCount++;
				_this.checkToQuitGame();
				break;
			}

			case UPDATE_SCORE: {
				var newScore = eventData.score ? eventData.score : 0;
				var tmpOpponent = _this.opponents[userId] || null;
				console.log("##=> Opponent", tmpOpponent)
				var tmpOpponentName = tmpOpponent !== null ? (tmpOpponent.firstName + ' ' + tmpOpponent.lastName) : userId;
				//_this.lblOpponentChangeScore.innerText = tmpOpponentName + " reached new score " + newScore;
				_this.opponentScore = newScore;
				_this.updateOpponentScore(userId, tmpOpponentName, newScore);
				_this.checkToQuitGame();
				break;
			}

			case ABORT_GAME: {
				console.log("##=> Opponent abort the game!");
				_this.updateFinalScore();
				break;
			}

			default:
				_this.sdkOnEvent(code, eventData, userId);
		}
	}

	// Fetch from the App all opponents
	this.goPlaySDK.onOpponentJoined = function (opponent, flag) {
		if (!opponent.firstName || opponent.firstName === "")
			opponent.firstName = opponent.displayName;
		_this.opponents[opponent.id] = opponent;
		// console.log("##=> Add new opponent -->", opponent);
		// console.log("##=> My opponents -->", _this.opponents);
		// console.log("##=> My opponent count: " + _this.opponentCount());
	}


	// On the Opponent leave the game
	this.goPlaySDK.onOpponentLeft = function (opponent) {
		if (typeof _this.opponents[opponent.id] !== undefined) {
			delete _this.opponents[opponent.id];
		}

		console.log("##=> Opponent left", opponent);
		if (Object.keys(_this.opponents).length == 0) {
			_this.goPlaySDK.updateFinalScore(_this.score, function () {
				console.log('@@=> Update final score! OK');
			}, function () {
				console.log('@@=> Update final score! NOT OK');
			}, !_this.isSinglePlayer(), !_this.isSinglePlayer() && _this.finalScoreSent && _this.isSaveProfile);
		}
	}

	this.playerReady = function (opponentID) {
		const allOpponents = Object.keys(this.opponents);
		if (allOpponents.indexOf(opponentID) != -1) {
			if (this.readyPlayers.indexOf(opponentID) == -1) {
				this.readyPlayers.push(opponentID);
			}
		}
		else {
			console.log("##=> [playerReady] opponent with id " + opponentID + " was not joined the game");
		}
	}

	this.startGame = function () {
		this.goPlaySDK.startGame();

		//check for start ourown game if opponent has already started their game.
		console.log("##=> [gpsdk][startGame] check for ready");
		this.checkToStartGame();
	}

	this.checkToStartGame = function () {
		if (this.isKicked == true) {
			console.log("##=> Player has been kicked before, so we end the game now!");
			_this.setScore(0);
			_this.goPlaySDK.sendEvent(FINISHED_GAME);
			_this.goPlaySDK.sendEvent(ABORT_GAME);
			_this.checkToQuitGame(false, true);
		}
		else {
			console.log("##=> [gpsdk][checkToStartGame], opponent count: " + _this.opponentCount());
			if (!this.gameStarted && (this.readyPlayers.length >= _this.opponentCount())) {
				this.gameStarted = true;
				this.onOpponentsReady();
			}
		}
	}

	this.updateOpponentScore = function (opponentID, opponentName, opponentScore) {
		console.log(opponentName + "'s new score is " + opponentScore);

		if (this.opponentScoreLabel) {
			this.opponentScoreLabel.innerHTML = opponentScore;
		}
	}

	this.setAndUpdateFinalScore = function (score, forceQuit = false, saveProfile = true) {
		this.score = score;
		this.goPlaySDK.updateFinalScore(this.score, function () {
			console.log('@@=> Update final score! OK');
		}, function () {
			console.log('@@=> Update final score! NOT OK');
		}, forceQuit || !this.isSinglePlayer() || (this.isSinglePlayer() && this.goPlaySDK.matchType == MATCH_TYPE.singlePlayer), (!this.isSinglePlayer() && saveProfile) || this.isSaveProfile);
	}

	this.updateFinalScore = function (saveProfile = true) {
		this.stopTimer();

		if (this.finalScoreSent) {
			return;
		}

		this.finalScoreSent = true;
		this.isSaveProfile = saveProfile && !this.isSinglePlayer();
		this.goPlaySDK.sendEvent(FINISHED_GAME);
		this.checkToQuitGame(saveProfile);
	}

	this.checkToQuitGame = function (saveProfile = true, forceQuit = false) {
		let isCanUpdateFinalScore = false;

		if (this.finalScoreSent) {
			if ((this.finishedCount >= Object.keys(this.opponents).length ||
				(!this.isTimeBased && this.opponentScore >= this.score))) {
				isCanUpdateFinalScore = true;
			}
		}

		if (forceQuit || isCanUpdateFinalScore) {
			// this.goPlaySDK.updateFinalScore(_this.score, function () {
			// 	console.log('Update final score! OK');
			// }, function () {
			// 	console.log('Update final score! NOT OK');
			// }, !this.isSinglePlayer() || (this.isSinglePlayer() && this.goPlaySDK.matchType == MATCH_TYPE.singlePlayer), (!this.isSinglePlayer() && saveProfile) || this.isSaveProfile);

			let isStopGame = !this.isSinglePlayer() || (this.isSinglePlayer() && this.goPlaySDK.matchType == MATCH_TYPE.singlePlayer);
			let isSave = (!this.isSinglePlayer() && saveProfile) || this.isSaveProfile;
			this.onSuccess = function () { console.log('@@=> Update final score! OK'); }
			this.onFail = function () { console.log('@@=> Update final score! NOT OK'); }
			this.goPlaySDK.updateSecureFinalScore(_this.score, _this.gameStateData, isStopGame, isSave, this.onSuccess, this.onFail);
		}
	}

	//Update the score
	this.increaseScore = function (score) {
		this.setScore(this.score + score);
	};

	this.setScore = function (score) {
		if (this.score != score) {
			this.score = score;

			this.goPlaySDK.updateCurrentScore(this.score, function (updateScore) {
				console.log('@@=> Update score OK', updateScore)
			}, function (updateScore) {
				console.log('@@=> Update score FAILED', updateScore)
			});

			if (this.selfScoreLabel)
				this.selfScoreLabel.innerHTML = this.score;
		}
	};

	this.isSinglePlayer = function () {
		return this.goPlaySDK.matchType == "SINGLE_PLAYER";
	}

	this.isAsyncPVP = function () {
		return this.goPlaySDK.matchType == "ASYNC_PVP";
	}

	// Wait until other finished
	this.waitAllFinished = function (onFinished) {
		_this.btnUpdateScore.classList.add('hide');
		_this.lblWaitingOpponent.classList.remove('hide');
	}

	// data : json object format
	this.saveGameData = function (data) {
		this.loadedData = data;
		_this.goPlaySDK.setCustomData(data, function (success, error) {
			//this.loadedData = data;
			console.log("##=>set custom data success >> ", success);
		});
	}

	// data : array of params to retrieve
	this.loadGameData = function (properties, callback) {
		if (this.goPlaySDK.isSDKReady) {
			if (!this.loadedData) {
				// create an overlay to block user input
				var overlay = document.createElement("div");
				overlay.style.width = "100%";
				overlay.style.height = "100%";
				overlay.style.backgroundColor = "black";
				overlay.style.color = "white";
				overlay.style.fontFamily = "monospace";
				overlay.style.zIndex = "999";
				overlay.style.opacity = "0.8";
				overlay.style.position = "absolute";

				var textDiv = document.createElement("div");
				textDiv.style.textAlign = "center";
				textDiv.style.width = "100%";
				textDiv.style.top = "50%";
				textDiv.style.msTransform = "translateY(-50%)";
				textDiv.style.transform = "translateY(-50%)";
				textDiv.style.position = "absolute";

				overlay.appendChild(textDiv);

				var text = document.createTextNode("Loading game data");
				textDiv.appendChild(text);

				document.getElementsByTagName("BODY")[0].prepend(overlay);

				_this.goPlaySDK.getCustomData(properties, (data, error) => {
					if (!error) {
						_this.loadedData = data;
						overlay.remove();
						callback(data);
					}
					else {
						textDiv.innerHTML = "Failed to fetch load data. Please restart the game";
					}
				});
			}
			else {
				callback(_this.loadedData);
			}
		}
		else {
			_this.loadProperties = properties;
			_this.loadCallback = callback;
		}
	}

	this.beginCountdown = function (duration, timerUpdateCallback, updateInterval = 1000) {
		var countdownDate = new Date().getTime() + (duration * 1000);

		this.isTimeBased = true;

		var timer = setInterval(function () {
			var now = new Date().getTime();

			var distance = countdownDate - now;

			if (distance < 0) {
				distance = 0;
			}

			if (timerUpdateCallback)
				timerUpdateCallback(distance / 1000);

			if (distance == 0) {
				clearInterval(timer);
			}
		}, updateInterval);
	}

	this.startCountdownTimer = function (duration, callback, parentDiv) {
		if (!this.countdownDate) {
			this.countdownDate = new Date().getTime() + (duration * 1000);

			if (!this.timerDiv) {
				// Create timer display
				this.timerDiv = document.createElement("div");
				this.timerDiv.style.height = "15px";
				this.timerDiv.style.backgroundColor = "#000000bf";
				this.timerDiv.style.zIndex = "1000";
				this.timerDiv.style.position = "absolute";
				this.timerDiv.style.left = 0;
				this.timerDiv.style.right = 0;
				this.timerDiv.style.marginLeft = "auto";
				this.timerDiv.style.marginRight = "auto";

				this.timerFill = document.createElement("div");
				this.timerFill.style.height = "100%";
				this.timerFill.style.backgroundColor = "#2fe06b";

				this.timerDiv.appendChild(this.timerFill);

				var timerFillEmboss = document.createElement("div");
				timerFillEmboss.style.height = "5px";
				timerFillEmboss.style.width = "100%";
				timerFillEmboss.style.backgroundColor = "#21b553";
				timerFillEmboss.style.position = "relative";
				timerFillEmboss.style.height = "5px";
				timerFillEmboss.style.top = "10px";

				this.timerFill.appendChild(timerFillEmboss);

				var timerImage = document.createElement("img");
				timerImage.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAoCAYAAAAG0SEsAAAJrUlEQVRYhZ1YCVRU1xn+Zt4sDAwzw8AwLMqwM26IogYxWneJEY2pJ53UpMlpYjwxbY1NN5PT5bRJ0+ak5xjTaqOpNV2UmsTWTBpFjUXElTUoGEGUAQZmGGD2jVlez72PQRAImO8ceHDfff9373///7v/vTyWZfEASASwFMDDANIBRAHoBHABwBEAoQcxBkI+hR8ty7LH2clxgWXZ+VO0ianMvBTAxwCE4TALo2UQvdYA3L4wQiEW0VF85KVJIJcKwOMNf/MJgBcBdE9kVFNWCsEUiIkh3O7yoaHVTQkTlULIohkIGB68/jCqGp2wu4JYoJUiN01CBrERgATA2q8yPh65ZmhdtQA2kIb6Fje+NHiQnxWDPI2Ekt4PqyOI2lsuNLa5UVIUh9hoZg2Ad4a8VgPAc/83I90eB2A/gG+N7GCxBXD6qg0rC+VIThDRtvM9dbjjNMIT9EElicO8+DzkyKaDmKpscMDjC+GRxXH3c30KYBdx4nhup8T+wTCqqvvQ0e2FLFYAuUICtVJIiTtcJrxydQ+uWZrGzPzNhS/h21klmJcbA33VALp7/egxeyAS8ZGbEQuxiE+8uArAIgA3Rrr9T4TY6Q7i+Z/Wos86OGyUzwdWLUvB6oUK8Hg8DIYDeEG7+UaaNMkqYcShXp9VXG1pTmm1d2q4L1hcqTbj8D9ugQQogTRagB1PZ2LdMjWJgwoA+SQYI25vBDBn2+463Olwjxscv/vJbCycO8aVY/DWgRaUnzeP++7n39dieZGK/PmBpqz0WTLzPELsdAUnJF6hZTAjJ5ZGemu7Cx3dHjicQQRDLGKiGUxLkkCbFQtJFANNSjQEfBbB8Nig/MuxdkoeYsPLI24naoWqmr4xnWOYEHZmGaCJCWD/IRkXTN7xRYzP56FwjgKluQHsnXMTb7ZkotMbNapPt9kHmyMAhUyoMej0iYLbjs6cbNl0uD2jjebLnXgpoxMfGtX4bUs8SSbaLhLwkK4WIUHOUFFxesJoNw/C4Qmj+gsrqr8AcqUavJLdjs8t8dCbVKPsMvxhj4QEf23RB99YsANLFsTjYNld2vrd6Z0okDvwWnM2+ga59FqQK8HGIhkW5kogFPDgG2RhtgWhSRTSFGs1+nGy2onTdS60uGLwoxt5+F5mB16f0Yq32zJgGxQgJ12KWKkATdY7WF++k2EMK/kFRYmz181ITIVKKcbTj2uQ6DXjx5eTYA8KkSBj8Mun1NiyVI7MZNHwyIm8mqxBJMVxshovE9ABrp4fi3ZTAN0DQVyxKpAt9WLXU2kwBqV4ZosG6oQo/LezChU9tb9n5FtyQ3V9t7Y9mbUW2gw5ncWuQzY4fSyykkV458UUSnqs0o78jHtrGCXiU+KRKK91YVqCEJsWy2Bzh9HS5UetTYZZizOHiVvsHdhW9Xo9C+zhG3T6a2Zv//kebz8184f3W2FzBpCkFOCt55OgkDK0fetKxbiBNhKPLIyFSs55Yudj8VgzX0rfvn2wFVY7px37bn6EMMteoEFKfp0s2duQLk1G7XUrrjYM0I9f1SVCHsNMSvhV2PV4AlIThCDidfjjDtrzmZxH3UMyy5FPi1EXkueHnxlphxX5UiilDA2gr4s+RwjnGlzYvl5JLZyqMNE0mxefF2PQ6fMj5KkMj/8weVFznUunby6VUbevLZTiwg03ztS58GAFDxAfy2DFXCmKZ0bT2RNBqrhiibxeFSGnItPQbKMEZM3ypolpDxLZ5GMS2T87ZEL9be+EZE0GH45fdAz/T5ZOLOQyY+msaPqsa7LR54DfQbdqQZ/P9lBClALtRm671U4XjzJKBvBYsYx64WiFHZ9cceLZ1TJovF2AzwNDVBoOVPjh8ITwXIly3IHN1JAssaPNwMm3kM/MpeQWny2fkFttXDSq5Aw8/jCEDI+KSQTRYj6eWxcHiz2IlnMN0Ag4QYoOGLB+0SrqId5YOYc/wEKt4FKyz+rnvhFI5NTt7qCX6t9ggFtUUqU0d/hh6A2MOwuyLEs0wXv/C31YohWPS0zwr/M2iEXcy2CQ42B4fBrofIvXSt+QwoHA5Q1jQY4E2Smi8a0RpGcDgiGBycgGmIlT8jur46hNgigx188b4jwgMLh6aBQlqzj1mmjGo6BMANaWAoEAECWZtHvHkM3kxCEOZw998mv7btKaamaOjDbc6vLT6J4UjGBKxAT1bVyWkD2f4Ia1ja4bv6Kn7ir5g+w4qngxzcez9S4MOEOobpk4tSYD2WprW700eC82cZm0eB6XDY0Dt02UfDAcuHjCUEkD5tHlSfRlWYWdRnqaSvi1yUVCHhLkAhyvctABKBUiPFTAkZ/tvlaJIZFpKLtTThs3l6SQKoOm0+HTVqjjJjtTTIyIwByt4IRl66bpEAh4+KzzIozu3jOU3KDThy6ZG4+Wd10erjIJTlx2QH/lnmKRSmUykBlGZNjqCuEXH5hpnpO13rg6mba/23wMQzU8t7EAeP9XdQfhDLixqjgRm9ak0Ma9J/px5H/cyE/VTL7JXG720OqGZMzL+3tg7A9AHiukVSup8Y60nUKz9c5HBp2+b5jcoNOf6/ZY/n2y8xI1sn1rBrQ5sXQWh8qt2PVeDwoyRxeDZGlGajnBklkx+LzehR3vGimxOIrBr384E0mqKFK5YHc1OR7gjUj/4UVdnJi/+4nMNZtDYRb/qTQhe4YMPBEfX9504PpdH3b8sRsz08R4eHYMtNPEUCkEWDIzGndNg2g3B1B320t3wIigKOJEmF+oRHWrHVmaGCxPLoRGmvz3yg0HGiKcI89q64h3DSYvjp/nREAk5KMoT4ET5d24WNs/pUAjUb1lfSpc4TAcHk6Gn1iZglROxL4BgEb6qLPanhtHa1+e/STS1BIU5MhABlFSlIgkpRiFsxQwmrw4d9mChmY7PVw4XJxqMQwPqWru0FBcqERRgRJCIR8uTxDHK030mZzA7ZQlp37Qdqpk772RRm4J0o5uWPfP2yfHXD009rey13qbxrSHwyzr84fGvao403V1TNtZ4zU27eiGZSP4Rp1SL5CAuGRuxLKkeViomoVqSxNerdmHQDhIYgLF6jlYpJoFrSIdChE9eZKjDwyuHtT336Kn1zPGq+j32UHOAqRvcnQ8rlma8VrNPpoQI5do1LWIpqz0PQAv3LeMtWQjilQ8ETA8PkR84fAOdR/0Q7caI/GpQacfbiNrHslzCoNOvx2ADsAhAK1Dz2KDTk9uKlYC+M3QEXeAzHiImJyzbgH4G4BtANQGnZ5ci/yZVFe0hOFEhdzRjMKDXoWN9BLZnMUGnX7MdceUvi8rxf8BIJ2fEOZcRXAAAAAASUVORK5CYII=";
				timerImage.style.width = "20px";
				timerImage.style.position = "relative";
				timerImage.style.float = "right";
				timerImage.style.bottom = "10px";
				timerImage.style.left = "10px";

				this.timerFill.appendChild(timerImage);

				if (parentDiv && parentDiv.nodeName.toLowerCase() != "canvas") {
					parentDiv.prepend(this.timerDiv);
					parentDiv.style.overflowX = "hidden";

					this.timerDiv.style.width = Math.min(window.innerWidth, parentDiv.offsetWidth) + "px";

					window.addEventListener("resize", () => {
						this.timerDiv.style.width = Math.min(window.innerWidth, parentDiv.offsetWidth) + "px";
					});
				}
				else {
					document.getElementsByTagName("BODY")[0].prepend(this.timerDiv);
					document.getElementsByTagName("BODY")[0].style.overflowX = "hidden";
				}
			}

			this.timer = setInterval(function () {
				this.isTimeBased = true;
				var now = new Date().getTime();

				var distance = _this.countdownDate - now;

				if (distance < 0) {
					distance = 0;
				}

				if (_this.timerFill && _this.timerDiv) {
					var progress = distance / (duration * 1000);
					_this.timerFill.style.width = (progress * _this.timerDiv.offsetWidth) + "px";
				}

				//var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
				//var seconds = Math.floor((distance % (1000 * 60)) / 1000);

				/*
				if (_this.timerText){
					_this.timerText.innerHTML = minutes + ":" + seconds;
				}
				*/

				if (distance == 0) {
					_this.stopTimer();

					if (callback)
						callback();
				}
			}, 1000);
		}
		else {
			console.log("##=>Timer already started");
		}
	}

	this.sdkOnEvent = function (code, eventData, userId) {
		console.log('Unknow event', code, eventData);
	};

	this.stopTimer = function () {
		if (this.countdownDate) {
			var now = new Date().getTime();
			var remainingTime = _this.countdownDate - now;

			this.countdownDate = null;
			clearInterval(this.timer);

			// return remaining time in milliseconds for score calculation
			return Math.ceil(remainingTime);
		}

		return 0;
	}

	this.showGameOverOverlay = function (gameOverText = "Game completed. Waiting for opponent.") {
		if (!this.gameOverOverlayShown) {
			this.gameOverOverlayShown = true;

			// create an overlay to block user input
			var gameOverOverlay = document.createElement("div");
			gameOverOverlay.style.width = "100%";
			gameOverOverlay.style.height = "100%";
			gameOverOverlay.style.backgroundColor = "black";
			gameOverOverlay.style.color = "white";
			gameOverOverlay.style.fontFamily = "monospace";
			gameOverOverlay.style.zIndex = "999";
			gameOverOverlay.style.opacity = "0.8";
			gameOverOverlay.style.position = "absolute";

			var gameOverlayTextDiv = document.createElement("div");
			gameOverlayTextDiv.style.textAlign = "center";
			gameOverlayTextDiv.style.width = "100%";
			gameOverlayTextDiv.style.top = "50%";
			gameOverlayTextDiv.style.msTransform = "translateY(-50%)";
			gameOverlayTextDiv.style.transform = "translateY(-50%)";
			gameOverlayTextDiv.style.position = "absolute";

			gameOverOverlay.appendChild(gameOverlayTextDiv);

			var text = document.createTextNode(gameOverText);
			gameOverlayTextDiv.appendChild(text);

			document.getElementsByTagName("BODY")[0].prepend(gameOverOverlay);
		}
	}

	this.restartGame = function () {
		this.score = 0;
		this.finalScoreSent = false;
		this.stopTimer();
	}

	this.showScoreBoard = function (parentDiv) {
		var head = document.getElementsByTagName("head")[0];
		var link = document.createElement("link");
		link.rel = "stylesheet";
		link.type = "text/css";
		link.href = "https://h5game.gogame.net/core/gpscoreboard.css";
		link.media = "all";
		head.appendChild(link);

		var gpScoreboard = document.createElement("div");
		gpScoreboard.id = "gpScoreboard";

		for (let i = 0; i < 2; i++) {
			let opponentIndex = i - 1;

			if (i == 0 || opponentIndex < Object.keys(this.opponents).length) {
				let userData = (i == 0 ? this.goPlaySDK.getCurrentPlayer() : this.opponents[Object.keys(this.opponents)[opponentIndex]]);

				let gpPlayerProfile = document.createElement("div");
				gpPlayerProfile.classList.add("gpPlayerProfile");
				if (i == 1) {
					gpPlayerProfile.style.right = "0";
				}

				let gpProfileImage = document.createElement("img");
				gpProfileImage.classList.add("gpProfileImage");

				if (userData.avatar && userData.avatar.link)
					gpProfileImage.src = userData.avatar.link;
				else
					gpProfileImage.src = "data:image/png;base64,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";

				if (i == 0)
					gpProfileImage.style.left = "4%";
				else
					gpProfileImage.style.right = "4%";

				gpPlayerProfile.appendChild(gpProfileImage);

				let gpPlayerName = document.createElement("div");
				gpPlayerName.innerHTML = userData.displayName;
				gpPlayerName.classList.add("gpPlayerName");

				if (i == 0)
					gpPlayerName.style.left = "33%";
				else
					gpPlayerName.style.right = "33%";

				gpPlayerProfile.appendChild(gpPlayerName);

				let gpPlayerScore = document.createElement("div");
				gpPlayerScore.innerHTML = 0;
				gpPlayerScore.classList.add("gpPlayerScore");

				if (i == 0) {
					this.selfScoreLabel = gpPlayerScore;
					gpPlayerScore.style.left = "33%";
				}
				else {
					this.opponentScoreLabel = gpPlayerScore;
					gpPlayerScore.style.right = "33%";
				}

				gpPlayerProfile.appendChild(gpPlayerScore);

				gpScoreboard.appendChild(gpPlayerProfile);
			}
			else {
				break;
			}
		}

		var body = (parentDiv.nodeName.toLowerCase() == "canvas") ? document.getElementsByTagName("BODY")[0] : parentDiv;
		//var body = parentDiv;
		body.append(gpScoreboard);
		body.style.overflow = "hidden";

		//parentDiv.appendChild(gpScoreboard);
		//gpScoreboard.style.width = (parentDiv.offsetWidth + 2) + "px";
		this.resizeScoreboard(gpScoreboard, parentDiv);
		/*
		gpScoreboard.style.width = Math.min(window.innerWidth, (parentDiv.offsetWidth + 2)) + "px";
		gpScoreboard.style.paddingTop = (0.132 * gpScoreboard.offsetWidth) + "px";
		gpScoreboard.style.fontSize = (12 * (gpScoreboard.offsetWidth / 388)) + "px";
		*/

		window.addEventListener("resize", () => {
			this.resizeScoreboard(gpScoreboard, parentDiv);
			/*
			gpScoreboard.style.width = (parentDiv.offsetWidth + 2) + "px";
			gpScoreboard.style.paddingTop = (0.132 * gpScoreboard.offsetWidth) + "px";
			gpScoreboard.style.fontSize = (12 * (gpScoreboard.offsetWidth / 388)) + "px";
			*/
		});
	}

	this.resizeScoreboard = function (scoreboard, otherParentDiv) {
		scoreboard.style.width = Math.min(window.innerWidth, (otherParentDiv.offsetWidth + 2)) + "px";
		scoreboard.style.paddingTop = (0.132 * scoreboard.offsetWidth) + "px";
		scoreboard.style.fontSize = (12 * (scoreboard.offsetWidth / 388)) + "px";
	}

	/*
	window.addEventListener("focusout", function(){
		console.log("##=>focus out");
	});*/

	document.addEventListener("visibilitychange", function () {
		if (!_this.finalScoreSent && !_this.isSinglePlayer()) {
			if (document.hidden) {
				if (!_this.kickPlayerTimer) {
					_this.kickPlayerTimer = setTimeout(() => {
						console.log("##=> Kick user!");
						_this.isKicked = true;
						_this.setScore(0);

						//_this.goPlaySDK.sendEvent(FINISHED_GAME);
						//_this.goPlaySDK.a(ABORT_GAME);
						_this.goPlaySDK.abortGame({});
						//_this.checkToQuitGame(false, true);
					}, 10000);
				}
			}
			else if (_this.kickPlayerTimer) {
				clearTimeout(_this.kickPlayerTimer);
				_this.kickPlayerTimer = null;
			}
		}
	}, false);

	this.onOpponentsReady = function () {
		console.log("##=> [gpsdk][onOpponentsReady] not overridden. Game should NOT start.");
	}

	this.beginCountdown = function (duration, timerUpdateCallback, updateInterval = 1000) {
		if (this.timerObj != null) {
			clearInterval(this.timerObj.timerInterval);
			this.timerObj = null;
		}

		this.timerObj = new CustomTimer(duration, timerUpdateCallback, updateInterval);
	}

	this.freezeTimer = function (duration) {
		if (this.timerObj) {
			this.timerObj.pauseForDuration(duration);
		}
	}

	this.extendTimer = function (duration) {
		if (this.timerObj) {
			this.timerObj.extendTimer(duration);
		}
	}

	this.resumeTimer = function () {
		if (this.timerObj)
			this.timerObj.resumeTimer();
	}

	this.pauseTimer = function () {
		if (this.timerObj)
			this.timerObj.pause();
	}

	this.showOpponentProfile = function (userId) {
		this.goPlaySDK.showAvatar(userId)
	}

	console.log("##=>SDK initialized");

	//#region Add on 13/01/2021 - san.phan
	this.setGameState = function (gameStateData) {
		this.gameStateData = gameStateData;
	};

	this.getGameState = function () {
		return this.gameStateData;
	};

	this.getAESKey = function () {
		return this.goPlaySDK.aesKey;
	};
	//#endregion
};

var gpSDK = new App();
