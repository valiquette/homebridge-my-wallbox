let wallboxAPI=require('../wallboxapi')
let packageJson=require('../package.json')

class lockMechanism {
	constructor(platform, log) {
		this.log = log
		this.platform = platform
		this.wallboxapi = new wallboxAPI(this, log)
	}

	createLockAccessory(device, config, uuid, platformAccessory) {
		if(!platformAccessory){
			this.log.info('Adding lock for %s charger ', device.name)
			this.log.debug('create Lock Accessory %s', device.name)
			platformAccessory = new PlatformAccessory(device.name, uuid)
			let lockService = new Service.LockMechanism(device.name, device.id)
			lockService.addCharacteristic(Characteristic.Identifier)
			lockService.addCharacteristic(Characteristic.StatusFault)
			lockService.addCharacteristic(Characteristic.OutletInUse)
			lockService.addCharacteristic(Characteristic.AccessoryIdentifier)
			platformAccessory.addService(lockService)
		}
		else{
			this.log.debug('update Lock Accessory %s', device.name)
		}
		platformAccessory.getService(Service.AccessoryInformation)
			.setCharacteristic(Characteristic.Name, device.name)
			.setCharacteristic(Characteristic.Manufacturer, "Wallbox")
			.setCharacteristic(Characteristic.SerialNumber, device.serialNumber)
			.setCharacteristic(Characteristic.Model, device.chargerType)
			.setCharacteristic(Characteristic.Identify, true)
			.setCharacteristic(Characteristic.FirmwareRevision, config.software.currentVersion)
			.setCharacteristic(Characteristic.HardwareRevision, config.part_number)
			.setCharacteristic(Characteristic.SoftwareRevision, packageJson.version)

		platformAccessory.getService(Service.LockMechanism)
			.setCharacteristic(Characteristic.Name, device.name)
			.setCharacteristic(Characteristic.Identifier, device.serialNumber)
			.setCharacteristic(Characteristic.StatusFault, Characteristic.StatusFault.NO_FAULT)
			.setCharacteristic(Characteristic.OutletInUse, false)
			.setCharacteristic(Characteristic.AccessoryIdentifier, device.uniqueIdentifier)

		return platformAccessory
	}

	createLockService(device) {
		this.log.debug("create lock service for %s, serial number %s", device.name, device.serialNumber)
		let lockService = new Service.LockMechanism(device.name, device.id)
		lockService
			.setCharacteristic(Characteristic.Identifier, device.serialNumber)
			.setCharacteristic(Characteristic.StatusFault, Characteristic.StatusFault.NO_FAULT)
			.setCharacteristic(Characteristic.OutletInUse, false)
			.setCharacteristic(Characteristic.AccessoryIdentifier, device.uid)
		return lockService
	}

	configureLockService(device, lockService) {
		this.log.debug("configured %s lock for %s", lockService.getCharacteristic(Characteristic.Name).value, device.name)
		lockService
			.setCharacteristic(Characteristic.LockCurrentState, device.locked)
			.setCharacteristic(Characteristic.LockTargetState, device.locked)
		lockService
			.getCharacteristic(Characteristic.LockTargetState)
			.on('get', this.getLockTargetState.bind(this, lockService))
			.on('set', this.setLockTargetState.bind(this, device, lockService))
		lockService
			.getCharacteristic(Characteristic.LockCurrentState)
			.on('get', this.getLockCurrentState.bind(this, device, lockService))
		//.on('set', this.setLockCurrentState.bind(this, device, lockService))
	}

	async getLockCurrentState(device, lockService, callback) {
		let currentValue = lockService.getCharacteristic(Characteristic.LockCurrentState).value
		callback(null, currentValue)
		this.platform.startLiveUpdate(device) //may slowdown plugin
	}

	setLockCurrentState(device, lockService, value, callback) {
		this.log.info('Set State %s', lockService.getCharacteristic(Characteristic.Name).value)
		if (lockService.getCharacteristic(Characteristic.StatusFault).value == Characteristic.StatusFault.GENERAL_FAULT) {
			callback('error')
		}
		else {
			if (value == true) {
				this.log.info('%s locked', lockService.getCharacteristic(Characteristic.Name).value)
				lockService.getCharacteristic(Characteristic.LockCurrentState).updatevalue(Characteristic.LockCurrentState.SECURED)
			}
			else {
				this.log.info('%s unlocked', lockService.getCharacteristic(Characteristic.Name).value)
				lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(Characteristic.LockCurrentState.UNSECURED)
			}
			callback()
		}
	}

	getLockTargetState(lockService, callback) {
		let currentValue = lockService.getCharacteristic(Characteristic.LockTargetState).value
		callback(null, currentValue)
	}

	async setLockTargetState(device, lockService, value, callback) {
		if (lockService.getCharacteristic(Characteristic.StatusFault).value == Characteristic.StatusFault.GENERAL_FAULT) {
			callback('error')
		}
		else {
			if (value == true) {
				this.log.info('Locking %s', lockService.getCharacteristic(Characteristic.Name).value)
				lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.SECURED)
				let chargerId = lockService.getCharacteristic(Characteristic.Identifier).value
				let response = await this.wallboxapi.lock(this.platform.token, chargerId, value).catch(err => { this.log.error('Failed to unlock. \n%s', err) })
				try {
					switch (response.status) {
						case 200:
							lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(response.data.data.chargerData.locked)
							break
						default:
							lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(!response.data.data.chargerData.locked)
							this.log.info('Failed to lock WallBox')
							break
					}
				} catch (error) {
					this.log.error('Failed to lock Wallbox')
				}
			}
			else {
				this.log.info('Unlocking %s', lockService.getCharacteristic(Characteristic.Name).value)
				lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.UNSECURED)
				let chargerId = lockService.getCharacteristic(Characteristic.Identifier).value
				let response = await this.wallboxapi.lock(this.platform.token, chargerId, value).catch(err => { this.log.error('Failed to unlock. \n%s', err) })
				try {
					switch (response.status) {
						case 200:
							lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(response.data.data.chargerData.locked)
							break
						default:
							lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(!response.data.data.chargerData.locked)
							this.log.info('Failed to unlock WallBox')
							break
					}
				} catch (error) {
					this.log.error('Failed to unlock Wallbox')
				}
			}
			callback()
		}
	}
}
module.exports = lockMechanism