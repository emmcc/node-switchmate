var util = require('util');
var EventEmitter = require('events').EventEmitter;

var SwitchmatePairingSession = function (sm_device)
{
    if (!(this instanceof SwitchmatePairingSession))
        return new SwitchmatePairingSession();
    var self = this;
    self.Switchmate = sm_device;
    self.event = new EventEmitter();
    self._pairAttempts = 0;
    self._paired = false;

    self.onConnect = function ()
    {
        self._pairAttempts +=1;
        self.event.emit('msg', 'Connected to Switchmate ' + self.Switchmate.id + '.');
        self.Switchmate.notifyPairResult(function ()
        {
            //notify the user when to push the button.
            self.event.emit('msg', 'Press your Switchmate NOW to pair!'); 
        });
        self.Switchmate.pair(function (error)
        {
            if (error)
            {
                self.event.emit('debug',error);
            }
        });
        
    };

    self.onDisconnect = function ()
    {
        self.event.emit('debug','Switchmate '+self.Switchmate.id+' disconnected');
        if (self._paired === true)
        {
            self.event.emit('success', self.Switchmate);
        }
        else if (self._pairAttempts <= 3)
        {
            self.event.emit('msg', 'Retrying...');
            this.event.emit('debug','Reconnecting to '+self.Switchmate.id);
            self.Switchmate.connectAndSetUp(self.onConnect);
        }
        else
        {
            self.event.emit('fail',self.Switchmate);
        }
    };

    self.onPairSuccess = function (data)
    {
        self._paired = true;
        self.event.emit('debug','Pairing successful');
        self.Switchmate.disconnect();
    };

    self.onPairFail = function ()
    {
        self._paired = false;
        self.event.emit('msg', 'You waited too long to pair your Switchmate.');
        self.Switchmate.disconnect();
    };
    
    self.Switchmate.on('pairSuccess', self.onPairSuccess);
    self.Switchmate.on('pairFail', self.onPairFail);
    self.Switchmate.on('disconnect',self.onDisconnect);
};

/**
 * Starts the pairing process for the Switchmate.
 */
SwitchmatePairingSession.prototype.PairSwitchmate = function ()
{
    var Sm = this.Switchmate;
    this.event.emit('debug','Connecting to '+Sm.id);
    Sm.connectAndSetUp(this.onConnect);
};

SwitchmatePairingSession.prototype.Reset = function ()
{
    var self = this;
    self._pairAttempts = 0;
    self._paired = false;
};
util.inherits(SwitchmatePairingSession, EventEmitter);
module.exports = SwitchmatePairingSession;