var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 * Session for performing Toggle Commands on Switchmate.
 * @argument {SwitchmateDevice} sm_device
 */
var SwitchmateToggleSession = function(sm_device) {
    if (!(this instanceof SwitchmateToggleSession))
        return new SwitchmateToggleSession();

    var self = this;
    self.Switchmate = sm_device;
    self.event = new EventEmitter();
    self.connectAttempts = 0;
    self.ToggleSuccess = false;
    self.TargetState = null;
    self.TargetBool = null;
    self.Identify = null;
    self.CmdInProgress = false;
    self._toggleTimeout = null;
    self._connectTimeout = null;

    self.onConnect = function() {
        clearTimeout(self._connectTimeout, self.onToggleFail);
        self.connectAttempts += 1;
        self.event.emit('msg', 'Connected to Switchmate ' + self.Switchmate.id + '.');
        self.Switchmate.notifyToggleResult(function(err) {

            if (!err) {
                self.doToggle();
            }
        });
    };

    self.doToggle = function() {
        self.event.emit('msg', 'Turning Switchmate v' + (self.Switchmate._version === 3 ? 3 : '1/2') + ' ' + self.blnToWords(self.TargetBool) + ".");
        self._toggleTimeout = setTimeout(self.onToggleFail, 5 * 1000); //five seconds to work.

        self.Switchmate.toggle(self.TargetBool);
    };

    self.onDisconnect = function() {
        if (self.ToggleSuccess === true) {
            self.Switchmate.CmdInProgress = false;
            self.ToggleSuccess = false;
            self.TargetState = null;
            self.TargetBool = null;
            self.Identify = null;
            self._toggleTimeout = null;
            self._connectTimeout = null;
            self.connectAttempts = 0;
            self.event.emit('success', true);
            self.event.emit('toggleDone', true);
        } else if (self.connectAttempts < 3) {
            self._connectTimeout = setTimeout(self.onToggleFail, 10 * 1000); //five seconds to work.
            self.event.emit('msg', 'Retrying...');
            self.Switchmate.connectAndSetUp(self.onConnect);
        } else {
            self.Switchmate.CmdInProgress = false;
            self.event.emit('fail', '');
            self.event.emit('toggleDone', false);
        }
    };

    self.onToggleSuccess = function(response) {
        if (self.Switchmate._version === 1 || response === self.TargetBool) {
            clearTimeout(self._toggleTimeout);
            if (self.TargetState === "identify" && self.Identify === null) {
                self.Identify = true;
                self.TargetBool = !self.TargetBool;
                self.doToggle();
            } else {
                self.ToggleSuccess = true;
                self.Switchmate.disconnect();
            }
        }
    };

    /**
     * If Toggling the Switchmate fails without the worst error code, return this.
     */
    self.onToggleFail = function(data) {
        clearTimeout(self._toggleTimeout);
        clearTimeout(self._connectTimeout);
        self.ToggleSuccess = false;
        self.event.emit('msg', 'Attempt failed.');
        self.Switchmate.disconnect();
    };

    /**
     * If the Switchmate returns a certain error code during toggle, it resets itself completely.
     * :(
     */
    self.onSwitchmateReset = function() {
        clearTimeout(self._toggleTimeout);
        self.ToggleSuccess = false;
        self.event.emit('msg', 'Your Switchmate received the wrong AuthCode and has reset itself.  You will need to pair it again with all your devices.');
        self.connectAttempts = 999; //give up, the command will never work now.
        self.Switchmate.disconnect();
    };

    self.blnToWords = function(bln) {
        return (bln) ? 'on' : 'off';
    };

    self.Switchmate.on('toggleFail', self.onToggleFail);
    self.Switchmate.on('toggleSuccess', self.onToggleSuccess);
    self.Switchmate.on('disconnect', self.onDisconnect);
    self.Switchmate.on('switchmateReset', self.onSwitchmateReset);
};

/**
 * Identifies a paired Switchmate/
 * Changes Switchmate to opposite Toggle State, then reverts it back.
 * @returns {undefined}
 */
SwitchmateToggleSession.prototype.IdentifySwitchmate = function() {
    var self = this;
    if (!self.Switchmate.CmdInProgress === true || typeof self.Switchmate.CmdInProgress === 'undefined') {
        var Sm = this.Switchmate;
        self.Switchmate.CmdInProgress = true;
        this.TargetBool = !Sm.ToggleState;
        this.TargetState = "identify";
        setTimeout(function() {
            Sm.CmdInProgress = false;
        }, 60 * 1000);
        this._connectTimeout = setTimeout(this.onToggleFail, 10 * 1000);
        Sm.connectAndSetUp(this.onConnect);
    }
};

/**
 * Turns on a paired Switchmate
 */
SwitchmateToggleSession.prototype.TurnOn = function() {
    var self = this;
    if (!self.Switchmate.CmdInProgress === true || typeof self.Switchmate.CmdInProgress === 'undefined') {
        var Sm = this.Switchmate;

        console.log('*** on Sm.ToggleState', Sm.ToggleState);
        if (Sm.ToggleState === true) {
            this.event.emit('msg', 'Switchmate is already on!');
            this.event.emit('success');
        } else {
            self.Switchmate.CmdInProgress = true;
            this.TargetBool = true;
            this.TargetState = "on";
            setTimeout(function() {
                Sm.CmdInProgress = false;
            }, 60 * 1000);
            this._connectTimeout = setTimeout(this.onToggleFail, 10 * 1000);
            Sm.connectAndSetUp(this.onConnect);
        }
    }
};

/**
 * Turns off a paired Switchmate.
 */
SwitchmateToggleSession.prototype.TurnOff = function() {
    var self = this;
    if (!self.Switchmate.CmdInProgress === true) {
        var Sm = this.Switchmate;

        console.log('*** off Sm.ToggleState', Sm.ToggleState);
        if (Sm.ToggleState === false) {
            self.event.emit('msg', 'Switchmate is already off!');
            self.event.emit('success');
        } else {
            Sm.CmdInProgress = true;
            self.TargetBool = false;
            self.TargetState = "off";
            self._connectTimeout = setTimeout(self.onToggleFail, 10 * 1000);
            setTimeout(function() {
                Sm.CmdInProgress = false;
            }, 60 * 1000);
            Sm.connectAndSetUp(this.onConnect);
        }
    }
};

SwitchmateToggleSession.prototype.Reset = function() {
    var self = this;

    if (!self.Switchmate.CmdInProgress === true) {
        self.connectAttempts = 0;
        self.ToggleSuccess = false;
        self.TargetState = null;
        self.TargetBool = null;
        self.Identify = null;
        self._toggleTimeout = null;
    }
};
util.inherits(SwitchmateToggleSession, EventEmitter);
module.exports = SwitchmateToggleSession;
