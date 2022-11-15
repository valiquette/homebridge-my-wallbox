let wallboxAPI=require('../wallboxapi')
let enumeration=require('../enumerations')

function control (platform,log,config){
	this.log=log
	this.platform=platform
	this.wallboxapi=new wallboxAPI(this,log)
	this.enumeration=enumeration
}

control.prototype={

  createControlService(device, type){
		this.log.info('Adding amperage control for %s charger ', device.name)
		this.log.debug('create new control')
		let currentAmps
		if(this.platform.useFahrenheit){
		currentAmps=((device.maxAvailableCurrent-32+.01)*5/9).toFixed(2)
		}
		else{
			currentAmps=device.maxAvailableCurrent
		}
		let controlService=new Service.Thermostat(type, device.id)
    controlService
      .setCharacteristic(Characteristic.Name, device.name+' '+type)
      .setCharacteristic(Characteristic.StatusFault,Characteristic.StatusFault.NO_FAULT)
			.setCharacteristic(Characteristic.TargetTemperature, currentAmps)
			.setCharacteristic(Characteristic.CurrentTemperature, currentAmps)
			.setCharacteristic(Characteristic.TemperatureDisplayUnits,this.platform.useFahrenheit)
			.setCharacteristic(Characteristic.TargetHeatingCoolingState,0)
			.setCharacteristic(Characteristic.CurrentHeatingCoolingState,0)
    return controlService
  },

  configureControlService(device, controlService){
		let min
		let max
		let step
		if(this.platform.useFahrenheit){
			min=-14.5
			max=4.5 //4.45
			step=.5
			if(device.maxAvailableCurrent==48){max=9}
		}
		else{
			min=6
			max=40
			step=1
			if(device.maxAvailableCurrent==48){max=48}
		}

    this.log.debug("configured %s control for %s" , controlService.getCharacteristic(Characteristic.Name).value, device.name)
		controlService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
			.setProps({
					minValue:0,
					maxValue:1
				})
      .on('get', this.getControlState.bind(this, controlService))
      .on('set', this.setControlState.bind(this, device, controlService))
		controlService
      .getCharacteristic(Characteristic.TargetTemperature)
			.setProps({
					minValue:min,
					maxValue:max,
					minStep:step
			})
      .on('get', this.getControlAmps.bind(this, controlService))
      .on('set', this.setControlAmps.bind(this, device, controlService))
		controlService
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
			.on('get', this.getControlUnits.bind(this, controlService))
      .on('set', this.setControlUnits.bind(this, device, controlService))
  },

	setControlAmps(device, controlService, value, callback){
		let amps
		if(this.platform.useFahrenheit){
			amps=(value*1.8+32+.01).toFixed(2)
		}
		else{
			amps=value
		}
		this.wallboxapi.getChargerData(this.platform.token,device.id).then(response=>{
			try{
				statusCode=response.data.data.chargerData.status
				currentMode=this.enumeration.items.filter(result=>result.status == statusCode)[0].mode
				this.log.debug('checking current mode = %s',currentMode)
			}catch(error){
				currentMode='unknown'
				this.log.error('failed current mode check')
			}
			switch(currentMode){
				case 'lockedMode':
					switch(statusCode){
						case 209:
							this.log.info('Car must be connected for this operation')
							controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(!value)
							controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(!value)
							callback()
							break
						case 210:
							this.log.info('Charger must be unlocked for this operation')
							this.log.warn('Car Connected. Unlock charger to start session')
							controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(!value)
							controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(!value)
							callback()
							break
					}
				case 'standbyMode':
				case 'chargingMode':
					this.log.debug('set amps to %s',amps)
					if(controlService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
						callback('error')
					}
					else{
						this.wallboxapi.setAmps(this.platform.token,device.id,amps).then(response=>{
							switch(response.status){
								case 200:
									controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(value)
									controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(value)
									break
								default:
									controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(!value)
									controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(!value)
									this.log.info('Failed to change charging amps %s',response.data.title)
									this.log.debug(response.data)
									break
								}
							})
					}
					callback()
					break
				case 'firmwareUpdate':
				case 'errorMode':
					this.log.info('This opertation cannot be completed at this time, status %s',statusCode)
					this.log.error('the charger %s has a fault condition with code=%s', device.name,statusCode)
					controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(!value)
					controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(!value)
					callback()
					break
				default:
					this.log.info('This opertation cannot be completed at this time, status %s',statusCode)
					controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(!value)
					controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(!value)
					callback()
					break
			}
		})
  },

	setControlState(device, controlService, value, callback){
		this.wallboxapi.getChargerData(this.platform.token,device.id).then(response=>{
			try{
				statusCode=response.data.data.chargerData.status
				currentMode=this.enumeration.items.filter(result=>result.status == statusCode)[0].mode
				this.log.debug('checking current mode = %s',currentMode)
			}catch(error){
				currentMode='unknown'
				this.log.error('failed current mode check')
			}
			switch(currentMode){
				case 'lockedMode':
				case 'readyMode':
					if(statusCode==210){
						this.log.info('Charger must be unlocked for this operation')
						this.log.warn('Car Connected. Unlock charger to start session')
					}
					else{
						this.log.info('Car must be connected for this operation')
					}
					controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(!value)
					controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(!value)
					callback()
					break
				case 'standbyMode':
					this.log.info('Waiting for a charge request')
					if(controlService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
						callback('error')
					}
					else{
						this.wallboxapi.remoteAction(this.platform.token,device.id,'resume').then(response=>{
							switch(response.status){
								case 200:
									controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(value)
									controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(value)
									this.log.info('Charging resumed')
									break
								default:
									controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(!value)
									controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(!value)
									this.log.info('Failed to start charging')
									this.log.debug(response.data)
									break
							}
						})
					}
					callback()
					break
				case 'chargingMode':
					this.log.debug('toggle control %s',controlService.getCharacteristic(Characteristic.Name).value)
					if(controlService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
						callback('error')
					}
					else{
						this.wallboxapi.remoteAction(this.platform.token,device.id,'pause').then(response=>{
							switch(response.status){
								case 200:
									controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(value)
									controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(value)
									this.log.info('Charging paused')
									break
								default:
									controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(!value)
									controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(!value)
									this.log.info('Failed to stop charging')
									this.log.debug(response.data)
									break
							}
						})
					}
					callback()
					break
				case 'firmwareUpdate':
				case 'errorMode':
					this.log.info('This opertation cannot be completed at this time, status %s',statusCode)
					this.log.error('the charger %s has a fault condition with code=%s', device.name,statusCode)
					controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(!value)
					controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(!value)
					callback()
				default:
					this.log.info('This opertation cannot be completed at this time, status %s',statusCode)
					controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(!value)
					controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(!value)
					callback()
					break
			}
		})
  },

	setControlUnits(device, controlService, value, callback){
		//this.platform.useFahrenheit=value
		this.log.debug("change unit value")
		callback()
		},

	getControlState(controlService, callback){
		if(controlService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
			callback('error')
		}
		else{
			let currentValue=controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).value
			callback(null, currentValue)
		}
	},

	getControlAmps(controlService, callback){
		if(controlService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
			callback('error')
		}
		else{
			let currentValue=controlService.getCharacteristic(Characteristic.CurrentTemperature).value
			callback(null, currentValue)
		}
	},

	getControlUnits(controlService, callback){
		if(controlService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
			callback('error')
		}
		else{
			let currentValue=controlService.getCharacteristic(Characteristic.TemperatureDisplayUnits).value
			this.platform.useFahrenheit=currentValue
			callback(null, currentValue)
		}
	}

}

module.exports = control