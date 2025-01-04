let wallboxAPI = require('../wallboxapi')

class battery {
	constructor(platform, log) {
		this.log = log
		this.platform = platform
		this.wallboxapi = new wallboxAPI(this.platform, log)
	}

	createBatteryService(device) {
		this.log.info('Adding battery service for %s charger ', device.name)
		this.log.debug('create battery service for %s', device.name)
		let batteryStatus
		let stateOfCharge = 0
		if (device.stateOfCharge) {
			stateOfCharge = device.stateOfCharge
		}
		batteryStatus = new Service.Battery(device.name, device.id)
		batteryStatus
			.setCharacteristic(Characteristic.StatusLowBattery, Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL)
			.setCharacteristic(Characteristic.BatteryLevel, stateOfCharge)
			.setCharacteristic(Characteristic.ChargingState, Characteristic.ChargingState.NOT_CHARGING)
			.setCharacteristic(Characteristic.ActiveIdentifier, device.maxAvailableCurrent)
		return batteryStatus
	}

	configureBatteryService(batteryStatus) {
		this.log.debug('configured battery service for %s', batteryStatus.getCharacteristic(Characteristic.Name).value)
		batteryStatus.getCharacteristic(Characteristic.StatusLowBattery)
	}

	getStatusLowBattery(batteryStatus, callback) {
		let batteryValue = batteryStatus.getCharacteristic(Characteristic.BatteryLevel).value
		let currentValue = batteryStatus.getCharacteristic(Characteristic.StatusLowBattery).value
		if (batteryValue <= 10) {
			this.log.warn('Battery Status Low %s%', batteryValue)
			batteryStatus.setCharacteristic(Characteristic.StatusLowBattery, Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW)
			currentValue = Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
		}
		callback(null, currentValue)
	}
}
module.exports = battery
