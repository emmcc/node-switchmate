var SwitchmateDevice = require('./SwitchmateDevice');

var SwitchmateDiscovery = function ()
{
    console.log("Discovering Switchmates.");
    console.log("Discovery will finish in 30 seconds.");
    SwitchmateDevice.SCAN_DUPLICATES = false;
    var timeouts = 2;
    var onDiscover = function (sm)
    {
        console.log('Switchmate found.');
        console.log('{ "id" : "' + sm.id + '" }');
    };
    SwitchmateDevice.discoverAll(onDiscover);

    setTimeout(DiscoveryTimeout, 15000);
    function DiscoveryTimeout()
    {
        timeouts -= 1;
        if (timeouts === 0)
        {
            SwitchmateDevice.stopDiscoverAll(onDiscover);
            console.log("Discovery ended.");
            process.exit(0);
        }
        else
        {
            console.log((timeouts * 15) + ' seconds left...');
            setTimeout(DiscoveryTimeout, 15000);
        }
    }
};
module.exports = SwitchmateDiscovery;