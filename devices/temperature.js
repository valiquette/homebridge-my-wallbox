let wallboxAPI=require('../wallboxapi')

function temperature (platform,log){
	this.log=log
	this.platform=platform
	this.wallboxapi=new wallboxAPI(this,log)
}

temperature.prototype={

	createTemperatureService(device, name){
		this.log.debug("Create temperature status for %s",device.name )
		let temperatureSensor = new Service.TemperatureSensor(device.name+' Level', device.id)

		return temperatureSensor
	},

  configureTemperatureService(temperatureSensor){
    this.log.debug("Configured temperature service for %s",temperatureSensor.getCharacteristic(Characteristic.Name).value)
		return temperatureSensor.setCharacteristic(Characteristic.CurrentTemperature,0)
  },

	updateTemperatureService(temperatureSensor, stateOfCharge){
		if(!temperatureSensor){return}
    this.log.debug("Update temperature service for %s",temperatureSensor.getCharacteristic(Characteristic.Name).value)
		return temperatureSensor.getCharacteristic(Characteristic.CurrentTemperature).updateValue(stateOfCharge)
  }

}

module.exports = temperature
