let wallboxAPI=require('../wallboxapi')

function battery (platform,log){
	this.log=log
	this.platform=platform
	this.wallboxapi=new wallboxAPI(this,log)
}

battery.prototype={

  createBatteryService(device){
		let batteryStatus
		this.log.debug("create battery service for %s",device.name )
		batteryStatus=new Service.Battery(device.name,device.id)
    batteryStatus
			.setCharacteristic(Characteristic.StatusLowBattery,Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL)
			.setCharacteristic(Characteristic.BatteryLevel, device.stateOfCharge)
			.setCharacteristic(Characteristic.ChargingState, Characteristic.ChargingState.NOT_CHARGING)
    return batteryStatus
  },
  
  configureBatteryService(batteryStatus){
    this.log.debug("configured battery service for %s",batteryStatus.getCharacteristic(Characteristic.Name).value)
    batteryStatus
			.getCharacteristic(Characteristic.StatusLowBattery)
			//.on('get', this.getStatusLowBattery.bind(this, batteryStatus))
  },

	getStatusLowBattery(batteryStatus,callback){
		let batteryValue=batteryStatus.getCharacteristic(Characteristic.BatteryLevel).value
		let currentValue = batteryStatus.getCharacteristic(Characteristic.StatusLowBattery).value
		if(batteryValue<=10){
			this.log.warn('Battery Status Low %s%',batteryValue)
			batteryStatus.setCharacteristic(Characteristic.StatusLowBattery,Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW)
			currentValue = Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
			}
		callback(null,currentValue)
	}
	
}

module.exports = battery