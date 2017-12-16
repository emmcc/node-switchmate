"use strict";
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var NobleDevice = require('noble-device');

var SM1_SERVICE_UUID = '000015231212efde1523785feabcd123';
var SM1_AUTH_CHAR = '000015291212efde1523785feabcd123';
var SM1_TOGGLE_CHAR = '000015261212efde1523785feabcd123';

var SM3_SERVICE_UUID = 'a22bd383ebdd49acb2e740eb55f5d0ab';
var SM3_TOGGLE_CHAR = 'a22b0090ebdd49acb2e740eb55f5d0ab';
var SM3_STATUS_CHAR = 'a22b0070ebdd49acb2e740eb55f5d0ab';


var SwitchmateDevice = function(sm_peripheral) {
    var self = this;
    if (!(this instanceof SwitchmateDevice))
        return new SwitchmateDevice();
    NobleDevice.call(self, sm_peripheral);
    EventEmitter.call(self);
    self.ToggleState = null;
    self._version = null;

    if (
        sm_peripheral.advertisement.serviceUuids.indexOf(SM3_SERVICE_UUID) !== -1 &&
        sm_peripheral.advertisement.manufacturerData &&
        sm_peripheral.advertisement.manufacturerData.length === 6
    ) {
        self.ToggleState = (sm_peripheral.advertisement.manufacturerData[0] & 0x01) === 1;
        self._version = 3;
    } else if (
        sm_peripheral.advertisement.serviceUuids.indexOf(SM1_SERVICE_UUID) !== -1 &&
        Array.isArray(sm_peripheral.advertisement.serviceData) &&
        sm_peripheral.advertisement.serviceData[0]
    ) {
        self.ToggleState = sm_peripheral.advertisement.serviceData[0].data[4] % 2 === 1;
        self._version = 1;
    }
    self._authCode = null;
    self._onCmd = null;
    self._offCmd = null;
    self.AuthString = null;
    self._pollInterval = 10;
    self._pollTimeoutObj = null;
    self._unreachableTimeoutObj = null;
    self.Reachable = true;
    self.CmdInProgress = false;
    self._reachableTimeout = null;

    self._updateToggleState = function(sm_ref) {
        //updating from refreshed version of self...
        self._unreachableTries = 0;
        if (self.Reachable === false) {
            self.Reachable = true; //device was found, so set to true.
            self.emit('reachable', self.id);
        }
        if (sm_ref.ToggleState === null) {
            return false;
        }
        if (self.ToggleState !== sm_ref.ToggleState) {
            self.ToggleState = sm_ref.ToggleState;
            self.emit('toggleStateChange', self.ToggleState, self.id);
        }
        return true;
    };

    self._unreachable = function() {
        self._unreachableTries += 1;
        if (self._unreachableTries >= 5 && self.Reachable === true) {
            self.CmdInProgress = false;
            self.Reachable = false;
            self.emit('unreachable', self.id);
        }
    };

    self._doToggleStateCheck = function() {
        //if this device is not connected and active.
        if (!self.connectedAndSetUp) {
            self._unreachableTimeoutObj = setTimeout(self._unreachable, self._pollInterval * 1000);

            var onDiscover = function(sm) {
                clearTimeout(self._unreachableTimeoutObj);
                if (self._updateToggleState(sm)) {
                    SwitchmateDevice.stopDiscover(onDiscover);
                }
            };
            //get a refresh of the Bluetooth LE Advertisement for updating the Toggle State.
            SwitchmateDevice.discoverById(self.id, onDiscover);
        }

        self._pollTimeoutObj = setTimeout(self._doToggleStateCheck, self._pollInterval * 1000);
    };

    self._signOnOff = function() {
        self._onCmd = self._sign_cmd('on', self._authCode);
        self._offCmd = self._sign_cmd('off', self._authCode);
        self.AuthString = '{"id" : "' + self.id + '", "authCode" : "' + self._authCode.toString('base64') + '"}';
    };

    self._sign_cmd = function(opt, auth) {
        var _on = Buffer.from('0101', 'hex');
        var _off = Buffer.from('0100', 'hex');
        var cmd;
        if (opt === 'on') {
            cmd = _on;
        } else {
            cmd = _off;
        }
        var blob = Buffer.concat([cmd, auth]);
        var i = 0;
        var x = blob[0] << 7;
        var l = blob.length;
        while (i < blob.length) {
            x = ((1000003 * x) ^ (blob[i] & 255)) ^ l;
            i += 1;
        }
        if (x === -1) {
            x = -2;
        }
        var sigBytes = new Buffer.alloc(6);
        x = _ToUint32(x);
        sigBytes.writeUIntLE(x, 0, 4);
        cmd.copy(sigBytes, 4);
        return sigBytes;
    };

    function _modulo(a, b) {
        return a - Math.floor(a / b) * b;
    }

    function _ToUint32(x) {
        return _modulo(_ToInteger(x), Math.pow(2, 32));
    }

    function _ToInteger(x) {
        x = (x - 0); // try and assure x becomes a number
        return x < 0 ? Math.ceil(x) : Math.floor(x);
    }
};
SwitchmateDevice.SCAN_UUIDS = [SM1_SERVICE_UUID, SM3_SERVICE_UUID];
SwitchmateDevice.SCAN_DUPLICATES = true;

// inherit noble device
util.inherits(SwitchmateDevice, EventEmitter);
NobleDevice.Util.inherits(SwitchmateDevice, NobleDevice);

SwitchmateDevice.prototype.toggle = function(setOn, done) {
    if (this._version === 3) {
        this.writeDataCharacteristic(SM3_SERVICE_UUID, SM3_TOGGLE_CHAR, new Buffer([setOn ? 1 : 0]), done);
    } else {
        this.writeDataCharacteristic(SM1_SERVICE_UUID, SM1_TOGGLE_CHAR, setOn ? this._onCmd : this._offCmd, done);
    }
    this.ToggleState = setOn;
};

SwitchmateDevice.prototype.onToggleResult = function(data) {
    if (this._version === 3) {
        if (data.length > 0 && (data[0] === 0x01 || data[0] === 0x00)) {
            this.ToggleState = data[0] !== 0x0;
            this.emit('toggleSuccess', data[0] !== 0x0);
        } else {
            this.emit('toggleFail', data);
        }
    } else {
        if (data.equals(new Buffer([0x20, 0x01, 0x04]))) {
            this.emit('switchmateReset', data);
        } else if (data.equals(new Buffer([0x20, 0x01, 0x00]))) {
            this.emit('toggleSuccess', data);
        } else {
            this.emit('toggleFail', data);
        }
    }
};

SwitchmateDevice.prototype.notifyToggleResult = function(callback) {
    this.onToggleResultBinded = this.onToggleResult.bind(this);
    if (this._version === 3) {
        this.notifyCharacteristic(SM3_SERVICE_UUID, SM3_STATUS_CHAR, true, this.onToggleResultBinded, callback);
    } else {
        this.notifyCharacteristic(SM1_SERVICE_UUID, SM1_TOGGLE_CHAR, true, this.onToggleResultBinded, callback);
    }
};

SwitchmateDevice.prototype.foundMe = function(seconds) {
    seconds = seconds || 60;
    var self = this;
    if (self.Reachable === false) {
        self.emit('reachable', self.id);
        self.Reachable = true;
    }
    if (self._reachableTimeout !== null) {
        clearTimeout(self._reachableTimeout);
    }
    self._reachableTimeout = setTimeout(function() {
        self.Reachable = false;
        self.emit('unreachable', self.id);
    }, seconds * 1000);
};

SwitchmateDevice.prototype.ToggleMode = function() {
    var self = this;
    if (typeof self._toggleMode === 'undefined') {
        var SwitchmateToggle = require('./SwitchmateToggleSession');
        self._toggleMode = new SwitchmateToggle(self);
    } else {
        self._toggleMode.Reset();
    }
    return self._toggleMode;
};

SwitchmateDevice.prototype.PairMode = function() {
    var self = this;
    if (typeof self._PairMode === 'undefined') {
        var SwitchmatePair = require('./SwitchmatePairingSession');
        self._pairMode = new SwitchmatePair(self);
    } else {
        self._pairMode.Reset();
    }
    return self._pairMode;
};

SwitchmateDevice.prototype.setAuthCode = function(authCodeEncoded) {
    this._authCode = Buffer.from(authCodeEncoded, 'base64');
    this._signOnOff();
};

SwitchmateDevice.prototype.pair = function(done) {
    this.writeDataCharacteristic(SM1_SERVICE_UUID, SM1_AUTH_CHAR, new Buffer([0x00, 0x00, 0x00, 0x00, 0x01]), done);
};

SwitchmateDevice.prototype.onPairResult = function(data) {
    if (data.equals(new Buffer([0x20, 0x01, 0x03]))) {
        this.emit('pairFail', data);
    } else {
        this.emit('pairSuccess', data);
        this._authCode = data.slice(3, data.length);
        this._signOnOff();
    }
};

SwitchmateDevice.prototype.notifyPairResult = function(callback) {
    this.onPairResultBinded = this.onPairResult.bind(this);
    this.notifyCharacteristic(SM1_SERVICE_UUID, SM1_AUTH_CHAR, true, this.onPairResultBinded, callback);
};

SwitchmateDevice.prototype.startPollingSwitchmate = function() {
    var self = this;
    self._doToggleStateCheck();
};

SwitchmateDevice.prototype.stopPollingSwitchmate = function() {
    var self = this;
    clearTimeout(self._pollTimeoutObj);
    self._pollTimeoutObj = null; //reset the timeout object.
};

SwitchmateDevice.prototype.setPollInterval = function(seconds) {
    this._pollInterval = seconds;
};

// export your device
module.exports = SwitchmateDevice;