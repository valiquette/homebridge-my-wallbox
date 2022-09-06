let packageJson=require('../package.json')
let wallboxAPI=require('../wallboxapi')

function control (platform,log,config){
	this.log=log
	this.platform=platform
	this.wallboxapi=new wallboxAPI(this,log)
}

control.prototype={

  createControlService(device, type){
    this.log.debug('adding new control')
		let currentAmps
		if(this.platform.useFahrenheit){
		currentAmps=((device.maxAvailableCurrent-32)*5/9).toFixed(2)
		}
		else{
			currentAmps=device.maxAvailableCurrent
		}
		let controlService=new Service.Thermostat(type, device.id)
    controlService 
      .setCharacteristic(Characteristic.Name, type)
      .setCharacteristic(Characteristic.StatusFault,Characteristic.StatusFault.NO_FAULT)
			.setCharacteristic(Characteristic.TargetTemperature, currentAmps) //4.4444
			.setCharacteristic(Characteristic.CurrentTemperature, currentAmps) 
			.setCharacteristic(Characteristic.TemperatureDisplayUnits,this.platform.useFahrenheit)
			.setCharacteristic(Characteristic.TargetHeatingCoolingState,0) //off
			.setCharacteristic(Characteristic.CurrentHeatingCoolingState,0)
    return controlService
  },

  configureControlService(device, controlService){
		let min
		let max
		let step
		if(this.platform.useFahrenheit){
			min=-14.5
			max=4.5 
			step=.5
			if(device.maxAvailableCurrent==48){max=9}
		}
		else{
			min=6
			max=40
			step=1
			if(device.maxAvailableCurrent==48){max=48}
		}
		
    this.log.info("Configured %s control for %s" , controlService.getCharacteristic(Characteristic.Name).value, device.name)
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
					minStep:step,
					minValue:min,
					maxValue:max
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
			amps=(value*1.8+32).toFixed(2)
		}
		else{
			amps=value
		}
		this.wallboxapi.getChargerData(this.platform.token,device.id).then(response=>{
			try{
				connected=response.data.data.chargerData.status
				this.log.debug('check connected state = %s',connected)
			}catch(error){
				connected=209
				this.log.error("failed connected state check")
			}		
			switch (connected){
				case 161: //no car
				case 209:
					this.log.info('Car must be connected for this operation')
					controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(!value)
					//controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(!value)
					callback()
					break
				case 210: //car locked
					this.log.info('Charger must be unlocked for this operation')
					this.log.warn('Car Connected. Unlock charger to start session')
					controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(!value)
					//controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(!value)
					callback()
					break
				case 181:
					this.log.info('Waiting for a charge request')
					controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(!value)
					//controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(!value)
					callback()
					break
				case 178: //car unocked 
				case 182:	
				case 194:
					this.log.debug('set amps %s',controlService.getCharacteristic(Characteristic.Name).value)
					if(controlService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
						callback('error')
					}
					else{
						this.wallboxapi.setAmps(this.platform.token,device.id,value).then(response=>{
							switch(response.status){
								case 200:
									controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(value)
									break
								default:
									controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(!value)
									//controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(!value)
									this.log.info('Failed to change charging amps %s',response.data.title)
									this.log.debug(response.data)
									break
								}
							})	
						callback()
					} 
					break
				default:
					this.log.info('This opertation cannot be competed at this time')
					controlService.getCharacteristic(Characteristic.TargetTemperature).updateValue(!value)
					//controlService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(!value)
					callback()
					break
			}
		})
  },

	setControlState(device, controlService, value, callback){
		this.wallboxapi.getChargerData(this.platform.token,device.id).then(response=>{
			try{
				connected=response.data.data.chargerData.status
				this.log.debug('check connected state = %s',connected)
			}catch(error){
				connected=209
				this.log.error("failed connected state check")
			}	
			switch (connected){
				case 161: //no car
				case 209:
					this.log.info('Car must be connected for this operation')
					controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(!value)
					//controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(!value)
					callback()
					break
				case 210: //car locked
					this.log.info('Charger must be unlocked for this operation')
					this.log.warn('Car Connected. Unlock charger to start session')
					controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(!value)
					//controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(!value)
					callback()
					break
				case 181:
					this.log.info('Waiting for a charge request')
					controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(!value)
					//controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(!value)
					callback()
					break
				case 178: //car unocked 
				case 182:	
				case 194:
					this.log.debug('toggle outlet state %s',controlService.getCharacteristic(Characteristic.Name).value)
					if(controlService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
						callback('error')
					}
					else{
						if(value){
							this.wallboxapi.remoteAction(this.platform.token,device.id,'start').then(response=>{
								switch(response.status){
									case 200:
										controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(value)
										//controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(!value)
										this.log.info('Charging resumed')
										break
									default:
										controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(!value)
										//controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(!value)
										this.log.info('Failed to start charging')
										this.log.debug(response.data)
										break
								}
							})	
						} 
						else {
							this.wallboxapi.remoteAction(this.platform.token,device.id,'pause').then(response=>{
								switch(response.status){
									case 200:
										controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(value)
										//controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(!value)
										this.log.info('Charging paused')
										break
									default:
										controlService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(!value)
										//controlService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(!value)
										this.log.info('Failed to stop charging')
										this.log.debug(response.data)
										break
								}
							})	
						}
					}	
					callback()
					break
				default:
					this.log.info('This opertation cannot be competed at this time')
					controlService.getCharacteristic(Characteristic.On).updateValue(!value)
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
			//if(this.platform.useFahrenheit){
				//if(currentValue>4.5){currentValue=4.44444}
			//}
			//else{
				//if(currentValue>40){currentValue=40}
			//}
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