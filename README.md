# node-switchmate
A Node.js API for [Switchmate](http://www.myswitchmate.com).  Switchmate is a Bluetooth LE lightswitch cover which allows for the automation of lightswitches without needing to rewire your home.

This API was developed using the "Rocker" models of the Switchmate (RSM0001 & RSM0002), though the Toggle models (TSM0001 & TSM0002)  will ***hopefully*** work too.   
This is still somewhat experimental and may need further refinement.

## Prerequisites & Installation
Be sure to install the following pre-requisites before installing node-switchmate.  The prerequisites and detailed instructions for these plugins are provided on their GitHub pages and websites:

* **[Node.js](https://nodejs.org)**
* **[Noble](https://github.com/sandeepmistry/noble#prerequisites)** ```npm install -g noble```
* **[Noble-Device](https://github.com/sandeepmistry/noble-device#prerequisites)**

### Note for Raspberry Pi 3 Users
If you are using a Raspberry Pi 3, you may wish to use a third-party USB Bluetooth adapter.  There have been issues with the Pi disconnecting, especially if its internal Wi-Fi is in use.  The [IOGEAR GBU521](https://www.amazon.com/dp/B007GFX0PY/) is a decent and compact Bluetooth 4.0 adapter which works really well with the Pi 3 and this library.

### Installing node-switchmate
Install node-switchmate with the Node Package Manager: ```npm install -g node-switchmate```

## Setting up your Switchmate
Open a console or terminal to */node_modules/node-switchmate/bin* and execute the following commands to setup your Switchmate.

1. Discover your Switchmate(s): ```./discover.switchmate```  The command will run for 30 seconds and display the IDs of any Switchmates found in your computer's Bluetooth range.  The IDs returned by macOS and Linux devices are different.

2. Pair your Switchmate: ```./pair.switchmate <switchmate_id>```. You will be prompted to PUSH your Switchmate to receive an authentication code from your Switchmate.  This code is used to sign commands that are sent to your Switchmate.

3. Toggle your Switchmate: ```./toggle.switchmate <switchmate_id> <target_state> <auth_code>```.  Valid toggle states include *on*, *off*, and *identify*.  ***Ensure your authorization code is correct!***

## Important Considerations:
### Reversed Light Switches:
If your light switches are reversed, you can open the Switchmate App on your smartphone and set it to 'reversed mode'. There is nothing you need to do with this API, as the orientation will be correct in this API after the setting is applied in your Switchmate app.

### Avoiding an accidental Switchmate Reset:
If you provide the **wrong** auth_code when toggling your Switchmate, your Switchmate will kindly reset itself.  This means you will need to relink it to your Smartphone and re-create any timers or schedules you have setup within the Switchmate app.

