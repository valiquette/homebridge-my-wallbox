let wallboxAPI=require('homebridge-my-wallbox/wallboxapi')

function sensor (platform,log){
	this.log=log
	this.platform=platform
	this.wallboxapi=new wallboxAPI(this,log)
}

sensor.prototype={

  createSensorService(device, type){
		let humiditySensor
		let stateOfCharge=0
		if(device.stateOfCharge)(stateOfCharge=device.stateOfCharge)

		this.log.debug("create sensor service for %s",device.name )
		humiditySensor = new Service.HumiditySensor(name, device.id)

    humiditySensor
			.setCharacteristic(Characteristic.Name, device.name+' '+type)
			.setCharacteristic(Characteristic.CurrentRelativeHumidity, stateOfCharge)
    return humiditySensor
  },

  configureSensorService(device,sensorStatus){
    this.log.info("Configured %s sensor for %s",sensorStatus.getCharacteristic(Characteristic.Name).value, device.name)
    sensorStatus
			.getCharacteristic(Characteristic.CurrentRelativeHumidity)
  },

}

module.exports = sensor