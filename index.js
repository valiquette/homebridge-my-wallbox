const PlatformWallbox = require('./wallboxplatform')

module.exports = (homebridge) => {
  PlatformAccessory = homebridge.platformAccessory
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  UUIDGen = homebridge.hap.uuid
  PluginName = 'homebridge-my-wallbox'
  PlatformName = 'wallbox'
  
  homebridge.registerPlatform(PluginName, PlatformName, PlatformWallbox, true)
}