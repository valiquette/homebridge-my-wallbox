let wallboxAPI=require('../wallboxapi')

function sensor (platform,log){
	this.log=log
	this.platform=platform
	this.wallboxapi=new wallboxAPI(this,log)
}

sensor.prototype={

  createSensorService(device, type){
		this.log.info('Adding sensor for %s charger ', device.name)
		this.log.debug("create new sensor")
		let humiditySensor = new Service.HumiditySensor(type, device.id)
		let stateOfCharge=0
		if(device.stateOfCharge)(stateOfCharge=device.stateOfCharge)
		humiditySensor = new Service.HumiditySensor(type, device.id)
		humiditySensor
			.setCharacteristic(Characteristic.Name, device.name+' '+type)
			.setCharacteristic(Characteristic.CurrentRelativeHumidity, stateOfCharge)
    return humiditySensor
  },

	configureSensorService(device,sensorStatus){
		this.log.debug("configured %s sensor for %s",sensorStatus.getCharacteristic(Characteristic.Name).value, device.name)
		sensorStatus
			.getCharacteristic(Characteristic.CurrentRelativeHumidity)
	},

}

module.exports = sensor