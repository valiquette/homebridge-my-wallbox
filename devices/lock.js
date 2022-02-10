let packageJson=require('../package.json')
let wallboxAPI=require('../wallboxapi')

function lockMechanism (platform,log){
	this.log=log
	this.platform=platform
	this.wallboxapi=new wallboxAPI(this,log)
}

lockMechanism.prototype={

  createLockAccessory(device,uuid){
    this.log.debug('Create Lock Accessory %s',device.name)
    let newPlatformAccessory=new PlatformAccessory(device.name, uuid)
    newPlatformAccessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Name, device.name)
      .setCharacteristic(Characteristic.Manufacturer, "Wallbox")
      .setCharacteristic(Characteristic.SerialNumber, device.serialNumber)
      .setCharacteristic(Characteristic.Model, device.chargerType)
      .setCharacteristic(Characteristic.Identify, true)
      .setCharacteristic(Characteristic.FirmwareRevision, device.softwareVersion)
      .setCharacteristic(Characteristic.HardwareRevision, "device.part_number")
      .setCharacteristic(Characteristic.SoftwareRevision, packageJson.version)
    return newPlatformAccessory
  },

  createLockService(device){
    this.log.debug("create Lock service for %s, serial number %s",device.name, device.serialNumber )
		let lockService=new Service.LockMechanism(device.name,device.id)
		lockService
		.setCharacteristic(Characteristic.SerialNumber, device.serialNumber)
			.setCharacteristic(Characteristic.StatusFault, Characteristic.StatusFault.NO_FAULT)
			.setCharacteristic(Characteristic.AccessoryIdentifier, device.uid)
    return lockService
  },

  configureLockService(lockService,currentState){
    this.log.debug("configured Lock for %s",lockService.getCharacteristic(Characteristic.Name).value)
    lockService
			.setCharacteristic(Characteristic.LockCurrentState, currentState)
			.setCharacteristic(Characteristic.LockTargetState, currentState)
		lockService
			.getCharacteristic(Characteristic.LockTargetState)
			.on('get', this.getLockTargetState.bind(this, lockService))
      .on('set', this.setLockTargetState.bind(this, lockService))
		lockService
			.getCharacteristic(Characteristic.LockCurrentState)
			.on('get', this.getLockCurrentState.bind(this, lockService))
			//.on('set', this.setLockCurrentState.bind(this, lockService))
  },

	getLockCurrentState: function (lockService, callback) {
		//this.log.info('get state')
		let currentValue=lockService.getCharacteristic(Characteristic.LockCurrentState).value
		callback(null,currentValue)
	},

	setLockCurrentState: function (lockService, value, callback) {
		this.log.info('set state')
			if(lockService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
				callback('error')
			}
			else{
			if (value == true) {
				this.log.info('locked')
				lockService.getCharacteristic(Characteristic.LockCurrentState).updatevalue(Characteristic.LockCurrentState.SECURED)
				//close routine
			} else {
				this.log.info('unlocked')
				lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(Characteristic.LockCurrentState.UNSECURED)
				//open routine
			}
			callback()
		}
	},

	getLockTargetState: function (lockService, callback) {
		//this.log.info('get target')
		let currentValue=lockService.getCharacteristic(Characteristic.LockTargetState).value
		callback(null,currentValue)
	},

	setLockTargetState: function (lockService, value, callback) {
		//this.log.info('set target')
		if(lockService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
			callback('error')
		}
		else{
			if (value == true) {
				this.log.info('locking')
				lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.SECURED)
				let chargerId=lockService.getCharacteristic(Characteristic.SerialNumber).value
				this.wallboxapi.lock(this.platform.token,chargerId,value).then(response=>{
					lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(response.data.data.chargerData.locked)
				})
				//close routine
			} else {
				this.log.info('unlocking')
				lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.UNSECURED)
				lockService.getCharacteristic(Characteristic.LockTargetState).updateValue(Characteristic.LockTargetState.SECURED)
				let chargerId=lockService.getCharacteristic(Characteristic.SerialNumber).value
				this.wallboxapi.lock(this.platform.token,chargerId,value).then(response=>{
					lockService.getCharacteristic(Characteristic.LockCurrentState).updateValue(response.data.data.chargerData.locked)
				})
				//open routine
			}
			callback()
		}
	}
}

module.exports = lockMechanism