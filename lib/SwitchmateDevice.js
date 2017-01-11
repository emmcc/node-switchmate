"use strict";
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var NobleDevice = require('noble-device');

var SM_SERVICE_UUID = '000015231212efde1523785feabcd123';
var SM_AUTH_CHAR = '000015291212efde1523785feabcd123';
var SM_TOGGLE_CHAR = '000015261212efde1523785feabcd123';


var SwitchmateDevice = function (sm_peripheral)
{
    var self = this;
    if (!(this instanceof SwitchmateDevice))
        return new SwitchmateDevice();
    NobleDevice.call(this, sm_peripheral);
    EventEmitter.call(this);
    this.ToggleState = null;
    this._authCode = null;
    this._onCmd = null;
    this._offCmd = null;
    this.AuthString = null;
    this._pollInterval = 6;
    this._pollTimeoutObj = null;
    this._unreachableTimeoutObj = null;
    this.Reachable = true;
    this.CmdInProgress = false;
    this._unreachableTries = 0;
    if (typeof sm_peripheral.advertisement.serviceData[0] === "object")
    {
        this.ToggleState = sm_peripheral.advertisement.serviceData[0].data[4] % 2 === 1;
    }

    this._updateToggleState = function (sm_ref)
    {
        //updating from refreshed version of self...
        self._unreachableTries = 0;
        if (self.Reachable === false)
        {
            self.Reachable = true; //device was found, so set to true.
            self.emit('reachable', self.id);
        }
        if (!self.ToggleState === sm_ref.ToggleState)
        {
            self.ToggleState = sm_ref.ToggleState;
            self.emit('toggleStateChange', self.ToggleState, self.id);
        }
    };
    
    self._unreachable = function ()
    {
        self._unreachableTries += 1;
        if (self._unreachableTries>=5 && self.Reachable===true)
        {
            self.CmdInProgress = false;
            self.Reachable = false;
            self.emit('unreachable', self.id);
        }
    };

    self._doToggleStateCheck = function ()
    {
        if (!self.connectedAndSetUp) //if this device is not connected and active.
        {
            self._unreachableTimeoutObj = setTimeout(self._unreachable, self._pollInterval * 1000);
            //get a refresh of the Bluetooth LE Advertisement for updating the Toggle State.
            SwitchmateDevice.discoverById(self.id, onDiscover);
            function onDiscover (sm)
            {
                clearTimeout(self._unreachableTimeoutObj);
                self._updateToggleState(sm); //when the device is found, perform update.
                SwitchmateDevice.stopDiscover(onDiscover);
            }
        }
        //if device is connected, or if refresh is successful, do it again after number of Seconds specified.
        self._pollTimeoutObj = setTimeout(self._doToggleStateCheck, self._pollInterval * 1000);
    };

    self._signOnOff = function ()
    {
        self._onCmd = self._sign_cmd('on', self._authCode);
        self._offCmd = self._sign_cmd('off', self._authCode);
        console.log('{ "id" : "' + sm.id + '" }');
        self.AuthString = '{"id" : "' + this.id + '", "authCode" : "'+ self._authCode.toString('base64')+'"}';
    };

    self._sign_cmd = function (opt, auth)
    {
        var _on = Buffer.from('0101', 'hex');
        var _off = Buffer.from('0100', 'hex');
        var cmd;
        if (opt === 'on')
        {
            cmd = _on;
        }
        else
        {
            cmd = _off;
        }
        var blob = Buffer.concat([cmd, auth]);
        var i = 0;
        var x = blob[0] << 7;
        var l = blob.length;
        while (i < blob.length)
        {
            x = ((1000003 * x) ^ (blob[i] & 255)) ^ l;
            i += 1;
        }
        if (x === -1)
        {
            x = -2;
        }
        var sigBytes = new Buffer.alloc(6);
        x = _ToUint32(x);
        sigBytes.writeUIntLE(x, 0, 4);
        cmd.copy(sigBytes, 4);
        return sigBytes;
    };
    
    function _modulo(a, b)
    {
        return a - Math.floor(a / b) * b;
    }

    function _ToUint32(x)
    {
        return _modulo(_ToInteger(x), Math.pow(2, 32));
    }
    function _ToInteger(x)
    {
        x = (x - 0); // try and assure x becomes a number
        return x < 0 ? Math.ceil(x) : Math.floor(x);
    }
};
SwitchmateDevice.SCAN_UUIDS = [SM_SERVICE_UUID];
SwitchmateDevice.SCAN_DUPLICATES = true;

// inherit noble device
util.inherits(SwitchmateDevice, EventEmitter);
NobleDevice.Util.inherits(SwitchmateDevice, NobleDevice);

SwitchmateDevice.is = function (sm_peripheral)
{
    return (sm_peripheral.advertisement.localName === 'beacon');
};

SwitchmateDevice.prototype.setAuthCode = function (authCodeEncoded)
{
    this._authCode = Buffer.from(authCodeEncoded, 'base64');
    this._signOnOff();
};

SwitchmateDevice.prototype.pair = function (done)
{
    this.writeDataCharacteristic(SM_SERVICE_UUID, SM_AUTH_CHAR, new Buffer([0x00, 0x00, 0x00, 0x00, 0x01]), done);
};

SwitchmateDevice.prototype.onPairResult = function (data)
{
    if (data.equals(new Buffer([0x20, 0x01, 0x03])))
    {
        this.emit('pairFail', data);
    }
    else
    {
        this.emit('pairSuccess', data);
        this._authCode = data.slice(3, data.length);
        this._signOnOff();
    }
};

SwitchmateDevice.prototype.notifyPairResult = function (callback)
{
    this.onPairResultBinded = this.onPairResult.bind(this);
    this.notifyCharacteristic(SM_SERVICE_UUID, SM_AUTH_CHAR, true, this.onPairResultBinded, callback);
};

SwitchmateDevice.prototype.setOn = function (done)
{
    this.writeDataCharacteristic(SM_SERVICE_UUID, SM_TOGGLE_CHAR, this._onCmd, done);
    this.ToggleState = true;
};

SwitchmateDevice.prototype.setOff = function (done)
{
    this.writeDataCharacteristic(SM_SERVICE_UUID, SM_TOGGLE_CHAR, this._offCmd, done);
    this.ToggleState = false;
};

SwitchmateDevice.prototype.onToggleResult = function (data)
{
    if (data.equals(new Buffer([0x20, 0x01, 0x04])))
    {
        this.emit('switchmateReset', data);
    }
    else if (data.equals(new Buffer([0x20, 0x01, 0x00])))
    {
        this.emit('toggleSuccess', data);
    }
    else
    {
        this.emit('toggleFail', data);
    }
};

SwitchmateDevice.prototype.notifyToggleResult = function (callback)
{
    this.onToggleResultBinded = this.onToggleResult.bind(this);
    this.notifyCharacteristic(SM_SERVICE_UUID, SM_TOGGLE_CHAR, true, this.onToggleResultBinded, callback);
};

SwitchmateDevice.prototype.startPollingSwitchmate = function ()
{
    var self = this;
    self._doToggleStateCheck();
};

SwitchmateDevice.prototype.stopPollingSwitchmate = function ()
{
    var self = this;
    clearTimeout(self._pollTimeoutObj);
    self._pollTimeoutObj = null; //reset the timeout object.
};

SwitchmateDevice.prototype.setPollInterval = function (seconds)
{
    this._pollInterval = seconds;
};

SwitchmateDevice.prototype.ToggleMode = function()
{
    var self = this;
    if (typeof self._toggleMode === 'undefined')
    {
        var SwitchmateToggle = require('./SwitchmateToggleSession');
        self._toggleMode = new SwitchmateToggle(self);
    }
    else
    {
        self._toggleMode.Reset();
    }
    return self._toggleMode;
};

SwitchmateDevice.prototype.PairMode = function()
{
    var self = this;
    if (typeof self._PairMode === 'undefined')
    {
        var SwitchmatePair = require('./SwitchmatePairingSession');
        self._pairMode = new SwitchmatePair(self);
    }
    else
    {
        self._pairMode.Reset();
    }
    return self._pairMode;
};
// export your device
module.exports = SwitchmateDevice;