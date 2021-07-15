const ABORT_REASON = {
    TimedOut: 'TimedOut',
    ShadowVariableMismatch: 'ShadowVariableMismatch',
    GameException: 'GameException'
};
const MATCH_TYPE = {
    realTimePvp: "REAL_TIME_PVP",
    asyncPvp: "ASYNC_PVP",
    singlePlayer: "SINGLE_PLAYER"
};
const GAME_TYPE = {
    realTimePvp: "REAL_TIME_PVP",
    asyncPvp: "ASYNC_PVP",
    singlePlayer: "SINGLE_PLAYER",
    singleAndRealTime: "SINGLE_PLAYER_AND_REAL_TIME_PVP",
    singleAsync: "SINGLE_PLAYER_AND_ASYNC_PVP"
};
const PHOTON_EVENT = {
    GAME_START: 1,
    UPDATE_STATE: 2,
    UPDATE_FINAL_STATE: 3,
    ABORT_GAME: 4,
    PAUSE_GAME: 5,
    RESUME_GAME: 6,
    CHAT: 7,
    FINISHED_GAME: 99
}

const GAME_NOT_STARTED = 'Error: game not started yet!';
const NO_WEBVIEW_BRIDGE = 'The webview bridge has not been injected yet!';
const EMIT_TO_WEBVIEW = 'Emit data to web view';
const VERSION = 'version';
const MATCH_INFO = 'match_info';
const CURRENT_USER = 'current_user';
const OTHER_PLAYERS = 'other_players';
const OPPONENT_JOINED = 'opponent_joined';
const OPPONENT_LEFT = 'opponent_left';
const START_GAME = 'start_game';
const CURRENT_SCORE = 'current_score';
const FINAL_SCORE = 'final_score';
const STOP_GAME = 'stop_game';
const ABORT_GAME = 'abort_game';
const SDK_INJECTED = 'sdk_injected';
const CUSTOM_EVENT = 'custom_event';
const HIDE_QUIT_BUTTON = 'hide_quit_button';
const SET_CUSTOM_DATA = 'set_custom_data';
const GET_CUSTOM_DATA = 'get_custom_data';
const PAUSE_GAME = 'pause_game';
const RESUME_GAME = 'resume_game';
const CHAT = 'chat';
const SHOW_AVATAR = 'show_avatar';
class GoPlaySDK {
    version = '1.0.1';
    versionCode = 0;
    matchType = MATCH_TYPE.singlePlayer;
    gameType = GAME_TYPE.singlePlayer;
    currentUser = {}
    otherPlayers = [];
    currentScore = 0;
    finalScore = 0;
    gameStarted = false;
    webViewBridge = null;
    state = {};
    isSDKReady = false;
    callbacks = {};
    chatEmojis = []
    loadingExpiredAt = 0;
    matchInfo = {};
    aesKey;
    isFlutterApp = false;
    constructor() {
        var number = 1;
        var versionCode = 0;
        this.version.split('.').reverse().forEach(function (code) {
            versionCode = versionCode + number * code
            number = number * 100;
        });
        this.versionCode = versionCode;
        console.log('SDK constructor run: ' + this.version + " : " + this.versionCode + " : " + versionCode);

        if (this.isWebView()) {
            this.addWebViewListeners();
        } else {
            this.addParentFrameListeners();
        }
    }

    // Listen event from parent frame for web version.
    addParentFrameListeners() {
        window.addEventListener('message', (event) => {
            const eventName = event.data.eventName || null;
            const payload = event.data.data || null;
            this.triggerSingleOpponentJoined = () => {
                this.otherPlayers.forEach((opponent) => {
                    this.onOpponentJoined(opponent, true)
                })
            }
            switch (eventName) {
                case MATCH_INFO:
                    console.log('Received match info', payload);
                    this.matchType = payload.matchType;
                    this.gameType = payload.gameType;
                    this.currentUser = payload.current_user;
                    this.otherPlayers = payload.other_players ?? [];
                    this.state = payload.state ?? {};
                    this.chatEmojis = payload.chatEmojis;
                    this.loadingExpiredAt = payload.loadingExpiredAt;
                    this.aesKey = payload.aesKey;
                    this.matchInfo = payload;
                    this.isSDKReady = true;
                    this.onReady();
                    this.triggerSingleOpponentJoined();
                    break;
                case CURRENT_USER:
                    console.log('Received current user', payload);

                    this.currentUser = payload;
                    if (!this.isSDKReady) {
                        this.isSDKReady = true;
                        this.onReady();
                    }
                    break;
                case OPPONENT_LEFT:
                    console.log('Opponent left', payload);
                    this.otherPlayers.forEach((other) => {
                        if (payload.name === other.id) {
                            delete this.otherPlayers[other.id];
                        }
                    });
                    this.onOpponentLeft(payload);
                    break;
                case OTHER_PLAYERS:
                    console.log('Received other players', payload);
                    this.otherPlayers = payload;
                    this.triggerSingleOpponentJoined();

                    break;
                case OPPONENT_JOINED:
                    this.otherPlayers.push(payload);
                    this.onOpponentJoined(payload, false)
                    break;
                case CUSTOM_EVENT:
                    const eventCode = payload.eventCode;
                    const eventData = payload.data;
                    const userId = payload.userId;
                    this.onEvent(eventCode, eventData, userId);
                    break;
                case GET_CUSTOM_DATA:
                case SET_CUSTOM_DATA:
                    console.log(eventName + ': ' + payload);
                    const responseData = payload.data || null;
                    const responseError = payload.error || null;
                    const callbackKey = event.data.callbackKey || null;
                    if (this.callbacks[callbackKey]) {
                        this.callbacks[callbackKey](responseData, responseError);
                    }
                    break;
            }
        }, false)
        //emit sdk version
        this.emit(SDK_INJECTED, this.versionCode);
    }

    iframeCallbackHandler(callbackKey, callback) {
        this.callbacks[callbackKey] = callback;
    }

    addWebViewListeners() {
        window.addEventListener("ns-brige-ready", (e) => {
            console.log('Web view bridge is ready now!.GoPlay SDK is ready now');
            this.webViewBridge = e.detail || window.nsWebViewBridge;

            this.webViewBridge.on(MATCH_INFO, (payload) => {
                console.log('Received match info', payload);
                this.matchType = payload.matchType;
                this.currentUser = payload.current_user;
                this.otherPlayers = payload.other_players ?? [];
                this.state = payload.state ?? {};

                this.isSDKReady = true;
                this.onReady();
                this.triggerSingleOpponentJoined();
            })

            this.webViewBridge.on(CURRENT_USER, (payload) => {
                console.log('Received current user', payload);
                this.currentUser = payload;
                if (!this.isSDKReady) {
                    this.isSDKReady = true;
                    this.onReady();
                }

            })

            this.webViewBridge.on(OPPONENT_LEFT, (payload) => {
                console.log('Opponent left', payload);
                this.otherPlayers.forEach((other) => {
                    if (payload.name === other.id) {
                        delete this.otherPlayers[other.id];
                    }
                });
                this.onOpponentLeft(payload);
            })

            this.webViewBridge.on(OTHER_PLAYERS, (payload) => {
                console.log('Received other players', payload);
                this.otherPlayers = payload;
                this.triggerSingleOpponentJoined();

            });

            this.webViewBridge.on(OPPONENT_JOINED, (payload) => {
                this.otherPlayers.push(payload);
                this.onOpponentJoined(payload, false);
                console.log('New opponent joined', payload);
            });

            this.triggerSingleOpponentJoined = () => {
                this.otherPlayers.forEach((opponent) => {
                    this.onOpponentJoined(opponent, true)
                })
            }

            this.webViewBridge.on(CUSTOM_EVENT, (payload) => {
                const eventCode = payload.eventCode;
                const eventData = payload.data;
                const userId = payload.userId;

                this.onEvent(eventCode, eventData, userId);
            });
            this.emit(SDK_INJECTED, this.versionCode);
        })
    }



    /**
     * Emit data to native script application via the webview bridge (auto injected to web view)
     * Check: https://github.com/Notalib/nativescript-webview-ext
     * @param {string} signal
     * @param {*} data
     */
    emit(signal, data, callbackKey) {
        if (this.isFlutterApp){
            this.emitToFlutter(signal, data);
        } else if (this.isWebView()) {
            this.emitToNativeScript(signal, data);

        } else {
            this.emitToParentWindow(signal, data, callbackKey);
        }
    }

    isWebView() {
        // The web view is not in iframe. for the web version. the game attached in the iframe. so we check if it's not a frame/iframe
        const isWebView = window.self == window.top;
        console.log('Is webview: ', isWebView);
        return isWebView;
    }

    // emit from the iframe to parent window
    emitToParentWindow(signal, data, callbackKey) {
        window.parent.postMessage({ eventName: signal, data: JSON.stringify(data), callbackKey: callbackKey }, "*");
    }

    // emit from webview to native script.
    emitToNativeScript(signal, data) {
        const bridge = this.webViewBridge || window.nsWebViewBridge;
        if (bridge) {
            bridge.emit(signal, data);
            console.log(`${EMIT_TO_WEBVIEW}: signal >>> ${signal}, `, ` data >>> ${data}`);
        } else {
            console.log(NO_WEBVIEW_BRIDGE);
        }
    }

    emitToFlutter(signal,data) {
        FlutterBridge.postMessage(JSON.stringify({"signal": signal, "data":data}));
    }

    /**
     * Get sdk version
     */
    getVersion() {
        this.emit(VERSION, this.version);
        return this.version;
    }

    /**
     * Returns current user's public info. The current user is the local user that launched the game/platform.
     * @param {Function} onSuccess
     * @param {Function} onFailed
     */
    getCurrentPlayer(onSuccess = null, onFailed = null) {
        if (!this.gameStarted) {
            if (onFailed) {
                onFailed(GAME_NOT_STARTED)
            }
            return;
        }

        if (onSuccess) {
            onSuccess(this.currentUser);

        }
        return this.currentUser;
    }

    // On the SDK is ready to communicate with the app (platform), Override to use it.
    onReady() {
        // Override to use it
    }

    // On Receive custom event. Override to use it.
    onEvent(eventCode, data, userId) {
        // Override to use it
    }

    // On the opponent joined the game/room, Override to use it.
    onOpponentJoined(opponent, flag) {
        // Override to use it
    }

    // On the opponent left the game/room, Override to use it.
    onOpponentLeft(opponent) {
        // Override to use it
    }

    /*  Returns array of current user's opponents.
        The opponents is the player local user is playing against. Returns null for single-player games.*/
    getOtherPlayers(onSuccess = null, onFailed = null) {
        if (!this.gameStarted) {
            if (onFailed) {
                onFailed(GAME_NOT_STARTED)
            }
            return;
        }

        if (onSuccess) {
            onSuccess(this.otherPlayers);
            return this.otherPlayers;
        }

    }


    /*  Will be called when an HTML5 game is launched and gameplay is about to begin,
        this call must be made to the platform indicating a game session has begun.
        Further gameplay API calls will be ignored until StartGame() has been called.
        This should also be called on each new round of game play. */
    startGame() {
        console.log("start game");
        this.gameStarted = true;
        this.emit(START_GAME, { score: this.currentScore, state: this.state });
    }
    /*  Each time the game score changes, call this to report the latest score.
        This is used to help prevent cheating and to help re-establish lost connections.
        Available only after StartGame(). */
    updateCurrentScore(score, onSuccess = null, onFailed = null, gameTime = null) {
        if (!this.gameStarted) {
            if (onFailed) {
                onFailed(GAME_NOT_STARTED)
            }
            return;
        }

        this.currentScore = score;
        this.emit(CURRENT_SCORE, { score: this.currentScore, state: this.state });

        if (onSuccess) {
            onSuccess(this.currentScore);
        }


    }

    /*  Called by the client to report the final score earned by the player.
        Any additional calls to game APIs are ignored with the exception of StartGame().
        Available only after StartGame(). */
    updateFinalScore(score, onSuccess = null, onFailed = null, stopGame = true, save = true) {
        if (!this.gameStarted) {
            if (onFailed) {
                onFailed(GAME_NOT_STARTED);
            }
            return;
        }

        this.finalScore = score;
        this.emit(FINAL_SCORE, { score: this.finalScore, state: this.state, stopGame: stopGame, save: save });
        if (onSuccess) {
            onSuccess(this.finalScore);
        }

    }

    updateSecureFinalScore(score, gameData, stopGame = true, save = true, onSuccess = null, onFailed = null) {
        if (!this.gameStarted) {
            if (onFailed) {
                onFailed(GAME_NOT_STARTED);
            }
            return;
        }

        this.finalScore = score;
        this.emit(FINAL_SCORE, { score: this.finalScore, gameData, state: this.state, stopGame: stopGame, save: save });
        if (onSuccess) {
            onSuccess(this.finalScore);
        }

    }
    /*
        Called to end the game session. Aborted games score lower than 0 in matched games.
        reason:
           + TimedOut - game session took too long to complete due to device sleeping, cheating, etc.
           + ShadowVariableMismatch - game detected variable tampering (mismatch with shadow variable)
           + GameException - trapped exception
    */

    abortGame(reason, onSuccess = null, onFailed = null) {
        if (!this.gameStarted) {
            if (onFailed) {
                onFailed(GAME_NOT_STARTED)
            }
            return;
        }
        this.emit(ABORT_GAME, reason);
        if (onSuccess) {
            onSuccess(reason);
        }
    }

    /*
       Called to pause the game session due app to background or player click on pause button.
       - Platform will don't count the time for ghost profile until sendResume called.
       - Other players will received the custom_event PAUSE_GAME: 5
   */
    sendPause(data = {}) {
        this.emit(PAUSE_GAME, data);
    }

    /*
       Called to resume the game (sendPause must be called later).
       - Platform will continue count the time for ghost profile.
       - Other players will received the custom_event RESUME_GAME: 6
   */

    sendResume(data = {}) {
        this.emit(RESUME_GAME, data);
    }
    /*
           Called to send chat message.
           data:
              -- data.emoji(optional) : {id: string, src: string}
              -- data.message(optional): string
       */

    sendChat(data) {
        this.emit(CHAT, data);
    }
    // Send custom event
    /**
     * Send custom event
     * @param {number} eventCode
     * @param {*} data
     *  @param {boolean} save: save this event to the ghost profile
     */

    sendEvent(eventCode, data = {}, save = false) {
        this.emit(CUSTOM_EVENT, { eventCode: eventCode, data: data, save });
    }

    setCustomData(valueObj, callback) {
        console.log('>>>> Registed event set_custom_data!')
        if (this.isWebView()) {
            this.emit(SET_CUSTOM_DATA, { valueObj: valueObj });
            this.webViewBridge.on(SET_CUSTOM_DATA, (payload) => {
                const success = payload.success;
                const error = payload.error;
                callback(success, error);
                this.webViewBridge.off(SET_CUSTOM_DATA, () => {
                    console.log('>>>> Unregisted event set_custom_data!')
                })
            })
        } else {

            const callbackKey = new Date().getTime() + '_SET_CUSTOM_DATA';
            this.emit(SET_CUSTOM_DATA, { valueObj: valueObj }, callbackKey);
            this.iframeCallbackHandler(callbackKey, callback)
        }

    }

    getCustomData(properties = [], callback) {
        if (this.isWebView()) {
            this.emit(GET_CUSTOM_DATA, { properties: properties });
            console.log('>>>> Registed event get_custom_data!')

            this.webViewBridge.on(GET_CUSTOM_DATA, (payload) => {
                const data = payload.data;
                const error = payload.error;
                callback(data, error);
                this.webViewBridge.off(GET_CUSTOM_DATA, () => {
                    console.log('>>>> Unregisted event get_custom_data!')
                })
            })
        } else {
            const callbackKey = new Date().getTime() + '_GET_CUSTOM_DATA';
            this.emit(GET_CUSTOM_DATA, { properties: properties }, callbackKey);
            this.iframeCallbackHandler(callbackKey, callback)
        }

    }
    hidePlatformQuitButton() {
        if (!this.gameStarted) {
            return;
        }
        this.emit(HIDE_QUIT_BUTTON, { hide: true });
    }
    showAvatar(userId) {
        this.emit(SHOW_AVATAR, { userId });
    }

    //flutter process
    setMatchInfo(matchInfo) {
        console.log('Received current user', matchInfo);
        this.aesKey = matchInfo.aesKey;
        this.matchType = matchInfo.matchType;
        this.currentUser = matchInfo.current_user;
        this.otherPlayers = matchInfo.other_players ?? [];
        this.state = matchInfo.state ?? {};
        this.isSDKReady = true;
        this.onReady();
    }

}
window.PHOTON_EVENT = PHOTON_EVENT;
window.MATCH_TYPE = MATCH_TYPE;
window.GoPlaySDK = new GoPlaySDK();
GoPlaySDK = window.GoPlaySDK

function markRunAsFlutter(){
    window.GoPlaySDK.isFlutterApp = true;
}

function setCurrentUser(userData) {
    window.GoPlaySDK.setCurrentUser("");
}

function setMatchInfo(matchInfo) {
    var jObject = JSON.parse(matchInfo);
    window.GoPlaySDK.setMatchInfo(jObject);
}
