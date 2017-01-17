#!/usr/bin/env node
var SwitchmateDevice = require('../index').SwitchmateDevice;
(validateArgs()) ?  createTestSession() : displayUsage();


/**
 * Validate commandline arguments.
 * @returns {Boolean} True on valid, false on invalid.
 */
function validateArgs()
{
    var valid = (process.argv.length>=2);
    var invalidDataType = (typeof process.argv[2] === 'undefined');
    valid = valid && !invalidDataType;
    return valid;
}

function createTestSession()
{
    var sm_id = process.argv[2].toLowerCase();
    console.log('Finding ' + sm_id + '.');
    /*var Discovery = new DiscoverySession();
    Discovery.FindSwitchmate(sm_id, onFound);*/
    SwitchmateDevice.discoverById(sm_id, onFound);
}

function displayUsage()
{
    console.log('Usage for pollingtest.js:');
    console.log('Tests the state of the Switchmate during manual toggles.\n');
    console.log('pollingtest.js  <switchmate_id>\n');
    process.exit();
}

function onFound(Switchmate)
{
    SwitchmateDevice.stopDiscoverAll(onFound);
    console.log('found');
    Switchmate.connectAndSetup(function ()
    {
        console.log('connected');
        Switchmate.disconnect();
    });
    Switchmate.on('disconnect', function ()
    {
        console.log('disconnect');
        Switchmate.startPollingSwitchmate();
    });
    Switchmate.on('toggleStateChange', function (state, id)
    {
        console.log(id+' changed to ' + state);
    });
    
    Switchmate.on('unreachable', function (id)
    {
        console.log(id+' is now unreachable.');
    });
    
    Switchmate.on('reachable', function (id)
    {
        console.log(id + ' is now reachable.');
    });
}
