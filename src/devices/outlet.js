let wallboxAPI = require('../wallboxapi').default
let enumerations = require('../enumerations')

class basicOutlet {
	constructor(platform, log, config) {
		this.log = log
		this.platform = platform
		this.wallboxapi = new wallboxAPI(this.platform, log)
		this.enumeration =  new enumerations.list(this, log)
	}

	createOutletService(device, type) {
		this.log.info('Adding outlet for %s charger ', device.name)
		this.log.debug('create new outlet')
		let outletService = new Service.Outlet(type, device.id)
		let outletOn = false
		if (device.statusDescription == 'Charging') {
			outletOn = true
		}
		outletService
			.setCharacteristic(Characteristic.On, outletOn)
			.setCharacteristic(Characteristic.Name, device.name + ' ' + type)
			.setCharacteristic(Characteristic.StatusFault, false)
		return outletService
	}

	configureOutletService(device, outletService) {
		this.log.debug('configured %s outlet for %s', outletService.getCharacteristic(Characteristic.Name).value, device.name)
		outletService.getCharacteristic(Characteristic.On).on('get', this.getOutletValue.bind(this, outletService))
		outletService.getCharacteristic(Characteristic.On).on('set', this.setOutletValue.bind(this, device, outletService))
	}

	async setOutletValue(device, outletService, value, callback) {
		let statusCode
		let currentMode
		if (outletService.getCharacteristic(Characteristic.StatusFault).value == Characteristic.StatusFault.GENERAL_FAULT) {
			callback('error')
		} else {
			outletService.getCharacteristic(Characteristic.On).updateValue(value)
			let chargerData = await this.wallboxapi.getChargerData(this.platform.token, device.id).catch(err => {
				this.log.error('Failed to get charger data. \n%s', err)
			})
			try {
				statusCode = chargerData.status
				currentMode = this.enumeration.list(statusCode).mode
				this.log.debug('checking status code = %s, current mode = %s', statusCode, currentMode)
			} catch (error) {
				statusCode = 'unknown'
				currentMode = 'unknown'
				this.log.error('failed current mode check')
			}
			switch (currentMode) {
				case 'lockedMode':
				case 'readyMode':
					if (statusCode == 210) {
						this.log.info('Charger must be unlocked for this operation')
						this.log.warn('Car Connected. Unlock charger to start session')
					} else {
						this.log.info('Car must be connected for this operation')
					}
					outletService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
				case 'standbyMode':
					this.log.info('Waiting for a charge request')
					if (outletService.getCharacteristic(Characteristic.StatusFault).value == Characteristic.StatusFault.GENERAL_FAULT) {
						callback('error')
					} else {
						let response = await this.wallboxapi.remoteAction(this.platform.token, device.id, 'resume').catch(err => {
							this.log.error('Failed to resume. \n%s', err)
						})
						switch (response.status) {
							case 200:
								outletService.getCharacteristic(Characteristic.On).updateValue(value)
								this.log.info('Charging resumed')
								break
							default:
								outletService.getCharacteristic(Characteristic.On).updateValue(!value)
								this.log.info('Failed to start charging')
								this.log.debug(response.data)
								break
						}
					}
					callback()
					break
				case 'chargingMode':
					this.log.debug('toggle outlet %s', outletService.getCharacteristic(Characteristic.Name).value)
					if (outletService.getCharacteristic(Characteristic.StatusFault).value == Characteristic.StatusFault.GENERAL_FAULT) {
						callback('error')
					} else {
						let response = await this.wallboxapi.remoteAction(this.platform.token, device.id, 'pause').catch(err => {
							this.log.error('Failed to pause. \n%s', err)
						})
						switch (response.status) {
							case 200:
								outletService.getCharacteristic(Characteristic.On).updateValue(value)
								this.log.info('Charging paused')
								break
							default:
								outletService.getCharacteristic(Characteristic.On).updateValue(!value)
								this.log.info('Failed to stop charging')
								this.log.debug(response.data)
								break
						}
					}
					callback()
					break
				case 'firmwareUpdate':
				case 'errorMode':
					this.log.info('This opertation cannot be completed at this time, status %s', statusCode)
					this.log.error('the charger %s has a fault condition with code=%s', device.name, statusCode)
					outletService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
				default:
					this.log.info('This opertation cannot be completed at this time, status %s', statusCode)
					outletService.getCharacteristic(Characteristic.On).updateValue(!value)
					callback()
					break
			}
		}
	}

	getOutletValue(outletService, callback) {
		if (outletService.getCharacteristic(Characteristic.StatusFault).value == Characteristic.StatusFault.GENERAL_FAULT) {
			callback('error')
		} else {
			let currentValue = outletService.getCharacteristic(Characteristic.On).value
			callback(null, currentValue)
		}
	}
}
module.exports = basicOutlet
