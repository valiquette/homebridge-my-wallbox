let wallboxAPI=require('homebridge-my-wallbox/wallboxapi')

function sensor (platform,log){
	this.log=log
	this.platform=platform
	this.wallboxapi=new wallboxAPI(this,log)
}

sensor.prototype={

  createSensorService(device){
		let humiditySensor
		let stateOfCharge=0
		if(device.stateOfCharge)(stateOfCharge=device.stateOfCharge)

		this.log.debug("create sensor service for %s",device.name )
		humiditySensor = new Service.HumiditySensor(device.name+' SOC', device.id)

    humiditySensor
			.setCharacteristic(Characteristic.CurrentRelativeHumidity, stateOfCharge)
    return humiditySensor
  },

  configureSensorService(batteryStatus){
    this.log.debug("configured sensor service for %s",batteryStatus.getCharacteristic(Characteristic.Name).value)
    batteryStatus
			.getCharacteristic(Characteristic.CurrentRelativeHumidity)
  },

}

module.exports = sensor